// app/api/uploads/components/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import * as XLSX from "xlsx";

// ✅ Configuration for chunked processing
const CHUNK_SIZE = 2000; // Process 5000 rows at a time
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB limit

async function insertWithRetry(chunk: any[], maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // ✅ TAMBAH: Reconnect sebelum insert untuk fresh connection
      if (attempt > 1) {
        await prisma.$disconnect().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const result = await prisma.employeeComponent.createMany({
        data: chunk,
        // skipDuplicates: true,
      });
      return result;
    } catch (error: any) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      // ✅ TAMBAH: Handle connection errors juga
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
  try {
    const user = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!type || (type !== "HO" && type !== "OS")) {
      return NextResponse.json({ 
        error: "Type is required and must be either 'HO' or 'OS'" 
      }, { status: 400 });
    }

    // ✅ Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024*1024)}MB` 
      }, { status: 400 });
    }

    console.log(`[Upload Components] File: ${file.name}, Size: ${(file.size / (1024*1024)).toFixed(2)}MB, Type: ${type}`);

    const startTime = Date.now();

    // ✅ Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let rows: any[] = [];

    // Parse based on file type
    if (file.name.endsWith(".csv")) {
      const content = buffer.toString("utf-8");
      const parseResult = parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
      });
      rows = parseResult.data as any[];
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
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

    // âœ… Filter invalid rows SEBELUM transform (hemat memory)
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

// âœ… Hapus validasi invalidRows karena sudah difilter di atas
// const invalidRows = componentsData.filter(row => !row.bulanReport);
// if (invalidRows.length > 0) { ... } <- HAPUS BLOCK INI (Line 158-166)

    const transformTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Upload Components] Transformed data in ${transformTime}s`);

    let totalInserted = 0;
const totalChunks = Math.ceil(componentsData.length / CHUNK_SIZE);

    // âœ… CHUNKED INSERT dengan transaction batching
console.log(`[Upload Components] Starting chunked insert (${CHUNK_SIZE} rows/batch)`);
console.log(`[Upload Components] Estimated time: ~${Math.ceil(totalChunks * 1.5 / 60)} minutes`);


// âœ… Process in larger transaction batches (10 chunks per transaction)
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
      `[Upload Components] âœ… Chunk ${chunkNumber}/${totalChunks}: ` +
      `Inserted ${result.count}/${chunk.length} rows in ${chunkTime}s ` +
      `(Total: ${totalInserted}/${componentsData.length}, ${Math.round((totalInserted/componentsData.length)*100)}%)`
    );
    
    // âœ… Only delay after every N chunks (not every chunk)
    if (chunkNumber < totalChunks && chunkNumber % TRANSACTION_BATCH_SIZE === 0) {
      console.log(`â¸ï¸  Batch checkpoint at ${chunkNumber}/${totalChunks} - brief pause...`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } catch (error) {
    console.error(`â Chunk ${chunkNumber}/${totalChunks} failed:`, error);
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

    return NextResponse.json({
      success: true,
      count: totalInserted,
      total: componentsData.length,
      skipped: componentsData.length - totalInserted,
      type: type,
      performance: {
        totalTime: `${totalTime}s`,
        rowsPerSecond,
        chunks: totalChunks,
      },
      message: `Successfully uploaded ${totalInserted.toLocaleString()} records (Type: ${type})`,
    });

  } catch (error) {
    console.error("[Upload Components] Error:", error);
    
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

// ✅ Add GET endpoint to check upload status (for future streaming implementation)
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
    });

  } catch (error) {
    console.error("[Upload Components] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch upload info" },
      { status: 500 }
    );
  }
}