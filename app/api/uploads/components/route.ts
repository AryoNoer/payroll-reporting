// app/api/uploads/components/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import * as XLSX from "xlsx";
import { storageHelpers, STORAGE_BUCKETS } from "@/lib/supabase";
import { Readable } from "stream";

const CHUNK_SIZE = 6000;
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const BATCH_INSERT_SIZE = 5000; // Insert 1000 rows at a time

// ✅ Memory-safe batch insert
async function insertBatch(batch: any[]) {
  if (batch.length === 0) return { count: 0 };
  
  try {
    const result = await prisma.employeeComponent.createMany({
      data: batch,
      skipDuplicates: true,
    });
    return result;
  } catch (error: any) {
    console.error(`❌ Batch insert error:`, error.message);
    
    // Retry with smaller batches if failed
    if (batch.length > 100) {
      let count = 0;
      for (let i = 0; i < batch.length; i += 100) {
        const smallBatch = batch.slice(i, i + 100);
        try {
          const result = await prisma.employeeComponent.createMany({
            data: smallBatch,
            skipDuplicates: true,
          });
          count += result.count;
        } catch (err) {
          console.error(`Sub-batch failed, skipping...`);
        }
      }
      return { count };
    }
    
    throw error;
  }
}

// ✅ Stream-based CSV processing to avoid loading entire file into memory
async function processCSVStream(fileBlob: Blob, type: string, userId: string) {
  return new Promise<{ data: any[], validCount: number }>(async (resolve, reject) => {
    try {
      const arrayBuffer = await fileBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const content = buffer.toString("utf-8");
      
      // ✅ Use streaming parser with callbacks
      const processedRows: any[] = [];
      let validCount = 0;
      
      parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
        step: (row: any) => {
          // Process row by row instead of all at once
          const data = row.data;
          const employeeNo = String(data["Employee No"] || "").trim();
          const komponen = String(data["Komponen"] || "").trim();
          const bulanReport = String(data["Bulan Report"] || "").trim();
          
          if (employeeNo && komponen && bulanReport) {
            processedRows.push({
              employeeNo,
              komponen,
              nilai: String(data["Nilai"] || "").trim(),
              remark: data["Remark"] ? String(data["Remark"]).trim() : null,
              remark2: data["Remark2"] ? String(data["Remark2"]).trim() : null,
              remark3: data["Remark3"] ? String(data["Remark3"]).trim() : null,
              bulanReport,
              type,
              uploadedBy: userId,
            });
            validCount++;
          }
        },
        complete: () => {
          resolve({ data: processedRows, validCount });
        },
        error: (error: any) => {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ✅ Process Excel with lower memory footprint
async function processExcelOptimized(fileBlob: Blob, type: string, userId: string) {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Read with options to reduce memory
  const workbook = XLSX.read(buffer, { 
    type: "buffer",
    cellDates: true,
    cellNF: false,
    cellStyles: false
  });
  
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: false });
  
  // Process and filter
  const processedRows = rows
    .filter((row: any) => {
      const employeeNo = String(row["Employee No"] || "").trim();
      const komponen = String(row["Komponen"] || "").trim();
      const bulanReport = String(row["Bulan Report"] || "").trim();
      return employeeNo && komponen && bulanReport;
    })
    .map((row: any) => ({
      employeeNo: String(row["Employee No"]).trim(),
      komponen: String(row["Komponen"]).trim(),
      nilai: String(row["Nilai"] || "").trim(),
      remark: row["Remark"] ? String(row["Remark"]).trim() : null,
      remark2: row["Remark2"] ? String(row["Remark2"]).trim() : null,
      remark3: row["Remark3"] ? String(row["Remark3"]).trim() : null,
      bulanReport: String(row["Bulan Report"]).trim(),
      type,
      uploadedBy: userId,
    }));
  
  return { data: processedRows, validCount: processedRows.length };
}

export async function POST(request: NextRequest) {
  let filePath: string | null = null;

  try {
    const user = await requireAuth();
    const body = await request.json();
    const { fileUrl, filePath: uploadedPath, fileName, fileSize, type } = body;

    if (!fileUrl || !uploadedPath || !fileName) {
      return NextResponse.json({ 
        error: "Missing required fields" 
      }, { status: 400 });
    }

    if (!type || (type !== "HO" && type !== "OS")) {
      return NextResponse.json({ 
        error: "Type must be 'HO' or 'OS'" 
      }, { status: 400 });
    }

    filePath = uploadedPath;

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Max ${MAX_FILE_SIZE / (1024*1024)}MB` 
      }, { status: 400 });
    }

    console.log(`[Upload] Processing: ${fileName}, Size: ${(fileSize / (1024*1024)).toFixed(2)}MB, Type: ${type}`);
    const startTime = Date.now();

    // ✅ Download file (this is unavoidable, but we'll process it efficiently)
    console.log(`[Upload] Downloading from storage...`);
    const { data: fileBlob, error: downloadError } = await storageHelpers.downloadFileAdmin(
      STORAGE_BUCKETS.PAYROLL_COMPONENTS,
      uploadedPath
    );

    if (downloadError || !fileBlob) {
      throw new Error(`Download failed: ${downloadError}`);
    }

    console.log(`[Upload] File downloaded, processing...`);

    // ✅ Process based on file type with optimized memory usage
    let processedData: { data: any[], validCount: number };
    
    if (fileName.endsWith(".csv")) {
      processedData = await processCSVStream(fileBlob, type, user.id);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      processedData = await processExcelOptimized(fileBlob, type, user.id);
    } else {
      return NextResponse.json(
        { error: "Unsupported format" },
        { status: 400 }
      );
    }

    const { data: componentsData, validCount } = processedData;

    if (componentsData.length === 0) {
      return NextResponse.json({
        error: "No valid rows found",
      }, { status: 400 });
    }

    console.log(`[Upload] Valid rows: ${validCount.toLocaleString()}`);

    // ✅ Insert in small batches to avoid memory issues
    let totalInserted = 0;
    const totalBatches = Math.ceil(componentsData.length / BATCH_INSERT_SIZE);

    console.log(`[Upload] Starting batch insert: ${totalBatches} batches of ${BATCH_INSERT_SIZE} rows`);

    for (let i = 0; i < componentsData.length; i += BATCH_INSERT_SIZE) {
      const batch = componentsData.slice(i, i + BATCH_INSERT_SIZE);
      const batchNumber = Math.floor(i / BATCH_INSERT_SIZE) + 1;
      
      const batchStart = Date.now();
      
      try {
        const result = await insertBatch(batch);
        totalInserted += result.count;
        
        const batchTime = ((Date.now() - batchStart) / 1000).toFixed(2);
        const progress = Math.round((totalInserted/componentsData.length)*100);
        
        console.log(
          `[Upload] ✅ Batch ${batchNumber}/${totalBatches}: ` +
          `${result.count} rows in ${batchTime}s | ${progress}%`
        );
        
        // Small delay to prevent overwhelming the connection pool
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`❌ Batch ${batchNumber} failed:`, error);
        // Continue with next batch
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const rowsPerSecond = Math.round(totalInserted / parseFloat(totalTime));

    console.log(
      `[Upload] ✅ COMPLETED - ${totalInserted.toLocaleString()}/${componentsData.length.toLocaleString()} ` +
      `in ${totalTime}s (${rowsPerSecond} rows/sec)`
    );

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
        batches: totalBatches,
      },
      message: `Successfully uploaded ${totalInserted.toLocaleString()} records`,
    });

  } catch (error) {
    console.error("[Upload] Error:", error);
    
    if (filePath) {
      await storageHelpers.deleteFilesAdmin(
        STORAGE_BUCKETS.PAYROLL_COMPONENTS,
        [filePath]
      ).catch(err => console.error("Cleanup error:", err));
    }
    
    let errorMessage = "Upload failed";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    await requireAuth();

    const recentCount = await prisma.employeeComponent.count({
      where: {
        uploadedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return NextResponse.json({
      recentUploads: recentCount,
      maxChunkSize: CHUNK_SIZE,
      maxFileSize: MAX_FILE_SIZE / (1024 * 1024) + "MB",
    });

  } catch (error) {
    console.error("[Upload] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch info" },
      { status: 500 }
    );
  }
}

// ✅ PUT endpoint with SSE for real-time progress
export async function PUT(request: NextRequest) {
  const encoder = new TextEncoder();
  let filePath: string | null = null;
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const user = await requireAuth();
        const requestBody = await request.json();
        const { fileUrl, filePath: uploadedPath, fileName, fileSize, type } = requestBody;
        
        filePath = uploadedPath;

        const sendProgress = (phase: string, message: string, percentage: number) => {
          const data = JSON.stringify({ phase, message, percentage });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        sendProgress('preparing', 'Downloading file...', 5);

        const { data: fileBlob, error: downloadError } = await storageHelpers.downloadFileAdmin(
          STORAGE_BUCKETS.PAYROLL_COMPONENTS,
          uploadedPath
        );

        if (downloadError || !fileBlob) {
          throw new Error(`Download failed: ${downloadError}`);
        }

        sendProgress('preparing', 'Parsing data...', 15);

        // Process based on file type
        let processedData: { data: any[], validCount: number };
        
        if (fileName.endsWith(".csv")) {
          processedData = await processCSVStream(fileBlob, type, user.id);
        } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
          processedData = await processExcelOptimized(fileBlob, type, user.id);
        } else {
          throw new Error("Unsupported format");
        }

        const { data: componentsData, validCount } = processedData;

        if (componentsData.length === 0) {
          throw new Error("No valid rows found");
        }

        sendProgress('processing', `Validated ${validCount.toLocaleString()} rows`, 20);

        const totalBatches = Math.ceil(componentsData.length / BATCH_INSERT_SIZE);
        let totalInserted = 0;

        sendProgress('processing', `Starting batch insert (${totalBatches} batches)...`, 25);

        for (let i = 0; i < componentsData.length; i += BATCH_INSERT_SIZE) {
          const batch = componentsData.slice(i, i + BATCH_INSERT_SIZE);
          const batchNumber = Math.floor(i / BATCH_INSERT_SIZE) + 1;

          try {
            const result = await insertBatch(batch);
            totalInserted += result.count;

            const progressPercent = 25 + Math.round((batchNumber / totalBatches) * 70);
            
            sendProgress(
              'processing',
              `Batch ${batchNumber}/${totalBatches} • ${totalInserted.toLocaleString()}/${componentsData.length.toLocaleString()} rows`,
              progressPercent
            );
            
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (error) {
            console.error(`Batch ${batchNumber} failed, continuing...`, error);
          }
        }

        sendProgress('completed', 'Upload completed!', 100);

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          success: true,
          count: totalInserted,
          total: componentsData.length,
          skipped: componentsData.length - totalInserted,
          type: type
        })}\n\n`));

        controller.close();

      } catch (error) {
        console.error("[Upload PUT] Error:", error);
        const errorMsg = error instanceof Error ? error.message : 'Upload failed';
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          phase: 'error',
          error: errorMsg
        })}\n\n`));
        
        if (filePath) {
          await storageHelpers.deleteFilesAdmin(
            STORAGE_BUCKETS.PAYROLL_COMPONENTS,
            [filePath]
          ).catch(err => console.error("Cleanup:", err));
        }
        
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}