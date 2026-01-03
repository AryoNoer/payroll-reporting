// app/api/uploads/components/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import * as XLSX from "xlsx";
import { storageHelpers, STORAGE_BUCKETS } from "@/lib/supabase";

// ✅ Configuration for chunked processing
const CHUNK_SIZE = 5000; // Process 5000 rows at a time
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB limit

async function insertWithRetry(chunk: any[], maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // ✅ Reconnect sebelum insert untuk fresh connection
      if (attempt > 1) {
        await prisma.$disconnect().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const result = await prisma.employeeComponent.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      return result;
    } catch (error: any) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      // ✅ Handle connection errors
      const isConnectionError = error.code === 'P1001' || 
                                error.code === 'P1017' ||
                                error.message?.includes("Can't reach database") ||
                                error.message?.includes('closed') ||
                                error.message?.includes('timeout') ||
                                error.code === '57014';
      
      if (attempt === maxRetries || !isConnectionError) {
        throw error;
      }
      
      // Wait longer for connection errors
      const waitTime = isConnectionError ? 5000 * attempt : 2000 * attempt;
      console.log(`⏳ Waiting ${waitTime}ms before retry (attempt ${attempt}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error("All retry attempts failed");
}

export async function POST(request: NextRequest) {
  let filePath: string | null = null;

  try {
    const user = await requireAuth();

    // ✅ NEW: Accept JSON body dengan file URL dari Supabase Storage
    const body = await request.json();
    const { fileUrl, filePath: uploadedPath, fileName, fileSize, type } = body;

    if (!fileUrl || !uploadedPath || !fileName) {
      return NextResponse.json({ 
        error: "Missing required fields: fileUrl, filePath, or fileName" 
      }, { status: 400 });
    }

    if (!type || (type !== "HO" && type !== "OS")) {
      return NextResponse.json({ 
        error: "Type is required and must be either 'HO' or 'OS'" 
      }, { status: 400 });
    }

    // Store filePath for cleanup in case of error
    filePath = uploadedPath;

    // ✅ Check file size
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024*1024)}MB` 
      }, { status: 400 });
    }

    console.log(`[Upload Components] Processing: ${fileName}, Size: ${(fileSize / (1024*1024)).toFixed(2)}MB, Type: ${type}`);
    console.log(`[Upload Components] Storage path: ${uploadedPath}`);

    const startTime = Date.now();

    // ✅ NEW: Download file dari Supabase Storage
    console.log(`[Upload Components] Downloading file from storage...`);
    const { data: fileBlob, error: downloadError } = await storageHelpers.downloadFile(
      STORAGE_BUCKETS.PAYROLL_COMPONENTS,
      uploadedPath
    );

    if (downloadError || !fileBlob) {
      throw new Error(`Failed to download file: ${downloadError}`);
    }

    // ✅ Convert Blob to Buffer
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Upload Components] File downloaded, size: ${buffer.length} bytes`);

    let rows: any[] = [];

    // Parse based on file type
    if (fileName.endsWith(".csv")) {
      const content = buffer.toString("utf-8");
      const parseResult = parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
      });
      rows = parseResult.data as any[];
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet);
    } else {
      return NextResponse.json(
        { error: "Unsupported file format. Please use CSV or Excel." },
        { status: 400 }
      );
    }

    const parseTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Upload Components] Parsed ${rows.length} rows in ${parseTime}s`);

    // Validate file not empty
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    // ✅ Filter invalid rows SEBELUM transform (hemat memory)
    const validRows = rows.filter(row => {
      const employeeNo = String(row["Employee No"] || "").trim();
      const komponen = String(row["Komponen"] || "").trim();
      const bulanReport = String(row["Bulan Report"] || "").trim();
      return employeeNo && komponen && bulanReport;
    });

    console.log(`[Upload Components] Valid rows: ${validRows.length}/${rows.length}`);

    if (validRows.length === 0) {
      return NextResponse.json({
        error: "No valid rows found. Please check Employee No, Komponen, and Bulan Report columns.",
      }, { status: 400 });
    }

    // Transform hanya valid rows
    const componentsData = validRows.map((row) => ({
      employeeNo: String(row["Employee No"]).trim(),
      komponen: String(row["Komponen"]).trim(),
      nilai: String(row["Nilai"] || "").trim(),
      remark: row["Remark"] ? String(row["Remark"]).trim() : null,
      remark2: row["Remark2"] ? String(row["Remark2"]).trim() : null,
      remark3: row["Remark3"] ? String(row["Remark3"]).trim() : null,
      bulanReport: String(row["Bulan Report"]).trim(),
      type: type,
      uploadedBy: user.id,
    }));

    const transformTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Upload Components] Transformed data in ${transformTime}s`);

    let totalInserted = 0;
    const totalChunks = Math.ceil(componentsData.length / CHUNK_SIZE);

    // ✅ CHUNKED INSERT dengan transaction batching
    console.log(`[Upload Components] Starting chunked insert (${CHUNK_SIZE} rows/batch)`);
    console.log(`[Upload Components] Estimated time: ~${Math.ceil(totalChunks * 1.5 / 60)} minutes`);

    // ✅ Process in larger transaction batches (10 chunks per transaction)
    const TRANSACTION_BATCH_SIZE = 10;

    for (let i = 0; i < componentsData.length; i += CHUNK_SIZE) {
      const chunk = componentsData.slice(i, i + CHUNK_SIZE);
      const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
      
      const chunkStart = Date.now();
      
      try {
        // Insert chunk
        const result = await insertWithRetry(chunk);
        totalInserted += result.count;
        
        const chunkTime = ((Date.now() - chunkStart) / 1000).toFixed(2);
        
        console.log(
          `[Upload Components] ✅ Chunk ${chunkNumber}/${totalChunks}: ` +
          `Inserted ${result.count}/${chunk.length} rows in ${chunkTime}s ` +
          `(Total: ${totalInserted}/${componentsData.length}, ${Math.round((totalInserted/componentsData.length)*100)}%)`
        );
        
        // ✅ Only delay after every N chunks (not every chunk)
        if (chunkNumber < totalChunks && chunkNumber % TRANSACTION_BATCH_SIZE === 0) {
          console.log(`⏸️ Batch checkpoint at ${chunkNumber}/${totalChunks} - brief pause...`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`❌ Chunk ${chunkNumber}/${totalChunks} failed:`, error);
        throw error; // Will be caught by outer try-catch
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const rowsPerSecond = Math.round(totalInserted / parseFloat(totalTime));

    console.log(
      `[Upload Components] ✅ COMPLETED - ` +
      `Inserted ${totalInserted}/${componentsData.length} records ` +
      `in ${totalTime}s (${rowsPerSecond} rows/sec)`
    );

    // ✅ Optional: Delete file from storage after successful processing
    // Uncomment jika ingin auto-delete setelah berhasil
    // await storageHelpers.deleteFiles(STORAGE_BUCKETS.PAYROLL_COMPONENTS, [filePath]);
    // console.log(`[Upload Components] 🗑️ Cleaned up storage file: ${filePath}`);

    return NextResponse.json({
      success: true,
      count: totalInserted,
      total: componentsData.length,
      skipped: componentsData.length - totalInserted,
      type: type,
      storagePath: filePath,
      performance: {
        totalTime: `${totalTime}s`,
        rowsPerSecond,
        chunks: totalChunks,
      },
      message: `Successfully uploaded ${totalInserted.toLocaleString()} records (Type: ${type})`,
    });

  } catch (error) {
    console.error("[Upload Components] Error:", error);
    
    // ✅ Cleanup: Delete uploaded file jika processing gagal
    if (filePath) {
      console.log(`[Upload Components] 🗑️ Cleaning up failed upload: ${filePath}`);
      await storageHelpers.deleteFiles(
        STORAGE_BUCKETS.PAYROLL_COMPONENTS,
        [filePath]
      ).catch(err => console.error("Cleanup error:", err));
    }
    
    // ✅ Better error messages
    let errorMessage = "Failed to upload components";
    if (error instanceof Error) {
      if (error.message.includes("out of memory")) {
        errorMessage = "File too large - out of memory. Please split into smaller files.";
      } else if (error.message.includes("timeout")) {
        errorMessage = "Upload timeout. Please try with a smaller file.";
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// ✅ Add GET endpoint to check upload status
export async function GET(_request: NextRequest) {
  try {
    await requireAuth();

    // Get recent uploads count
    const recentCount = await prisma.employeeComponent.count({
      where: {
        uploadedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    return NextResponse.json({
      recentUploads: recentCount,
      maxChunkSize: CHUNK_SIZE,
      maxFileSize: MAX_FILE_SIZE / (1024 * 1024) + "MB",
      storageEnabled: true,
    });

  } catch (error) {
    console.error("[Upload Components] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch upload info" },
      { status: 500 }
    );
  }
}