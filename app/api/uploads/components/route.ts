// app/api/uploads/components/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import * as XLSX from "xlsx";
import * as fs from "fs/promises";
import * as path from "path";

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ROWS_PER_CHUNK = 10000;

function getUploadDir() {
  return process.env.UPLOAD_DIR || './uploads';
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // ✅ Check content type to determine if this is a file upload or chunk processing
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // ========================================
      // FILE UPLOAD (save to disk + pre-parse into chunks)
      // ========================================
      return await handleFileUpload(request, user);
    } else {
      // ========================================
      // CHUNK PROCESSING (read pre-parsed JSON chunk, process rows)
      // ========================================
      return await handleChunkProcessing(request, user);
    }
  } catch (error) {
    console.error("[Components] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle file upload — save file to disk, pre-parse into JSON chunks.
 * Returns totalRows and totalChunks so client knows exactly how many chunks to process.
 */
async function handleFileUpload(request: NextRequest, user: any) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const type = (formData.get("type") as string) || "HO";

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 500MB)" }, { status: 400 });
  }

  console.log(`[Components] Uploading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) type=${type}`);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Save original file to disk
  const uploadDir = getUploadDir();
  await fs.mkdir(uploadDir, { recursive: true });

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const baseName = `${type}_${timestamp}_${sanitizedName}`;
  const filePath = path.join(uploadDir, baseName);

  await fs.writeFile(filePath, buffer);
  console.log(`[Components] File saved: ${baseName}`);

  // ✅ Parse file ONCE and split into JSON chunk files
  console.time('[Components] Parse + Split');
  let allRows: any[] = [];

  if (file.name.endsWith(".csv")) {
    const content = buffer.toString("utf-8");
    const parseResult = parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });
    allRows = parseResult.data as any[];
  } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    allRows = XLSX.utils.sheet_to_json(sheet);
  } else {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  const totalRows = allRows.length;
  const totalChunks = Math.ceil(totalRows / ROWS_PER_CHUNK);

  console.log(`[Components] Parsed ${totalRows} rows, splitting into ${totalChunks} chunks`);

  // Create chunk directory
  const chunkDir = path.join(uploadDir, `${baseName}_chunks`);
  await fs.mkdir(chunkDir, { recursive: true });

  // Write chunk files in parallel
  const chunkWritePromises = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * ROWS_PER_CHUNK;
    const end = start + ROWS_PER_CHUNK;
    const chunkData = allRows.slice(start, end);
    const chunkPath = path.join(chunkDir, `chunk_${i}.json`);
    chunkWritePromises.push(fs.writeFile(chunkPath, JSON.stringify(chunkData)));
  }
  await Promise.all(chunkWritePromises);

  console.timeEnd('[Components] Parse + Split');
  console.log(`[Components] ${totalChunks} chunk files written`);

  // Free memory
  allRows = [];

  return NextResponse.json({
    success: true,
    filePath: baseName,
    fileName: file.name,
    fileSize: file.size,
    fileUrl: `/uploads/${baseName}`,
    totalRows,
    totalChunks,
  });
}

/**
 * Handle chunk processing — read pre-parsed JSON chunk, process rows into DB.
 * No more re-parsing the entire Excel file!
 */
async function handleChunkProcessing(request: NextRequest, user: any) {
  const body = await request.json();
  const { filePath, fileName, type, chunkIndex, totalChunks } = body;

  if (!filePath || !fileName || !type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (chunkIndex === undefined) {
    return NextResponse.json({ error: "Missing chunkIndex" }, { status: 400 });
  }

  console.log(`[Components] Processing chunk ${chunkIndex + 1}/${totalChunks || '?'} of ${fileName}`);

  const uploadDir = getUploadDir();
  const chunkDir = path.join(uploadDir, `${filePath}_chunks`);
  const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}.json`);

  // ✅ Read only the specific chunk file (fast! no Excel parsing)
  let chunkRows: any[];
  try {
    const chunkData = await fs.readFile(chunkPath, 'utf-8');
    chunkRows = JSON.parse(chunkData);
  } catch {
    // No more chunks to process
    return NextResponse.json({
      success: true,
      chunkIndex,
      inserted: 0,
      processed: 0,
      hasMore: false,
      message: "No more chunks to process",
    });
  }

  // ✅ If no rows in this chunk, we're done
  if (chunkRows.length === 0) {
    return NextResponse.json({
      success: true,
      chunkIndex,
      inserted: 0,
      processed: 0,
      hasMore: false,
      message: "No more rows to process",
    });
  }

  // ✅ Process chunk
  const componentsData = chunkRows
    .filter(row => {
      const employeeNo = String(row["Employee No"] || "").trim();
      const komponen = String(row["Komponen"] || "").trim();
      const bulanReport = String(row["Bulan Report"] || "").trim();
      return employeeNo && komponen && bulanReport;
    })
    .map(row => ({
      employeeNo: String(row["Employee No"]).trim(),
      komponen: String(row["Komponen"]).trim(),
      nilai: String(row["Nilai"] || "").trim(),
      remark: row["Remark"] ? String(row["Remark"]).trim() : null,
      remark2: row["Remark2"] ? String(row["Remark2"]).trim() : null,
      remark3: row["Remark3"] ? String(row["Remark3"]).trim() : null,
      bulanReport: String(row["Bulan Report"]).trim(),
      type,
      uploadedBy: user.id,
    }));

  // ✅ Insert in smaller batches
  let inserted = 0;
  const batchSize = 2000;

  for (let i = 0; i < componentsData.length; i += batchSize) {
    const batch = componentsData.slice(i, i + batchSize);
    try {
      const result = await prisma.employeeComponent.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += result.count;
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`Batch insert failed:`, error);
    }
  }

  const hasMore = totalChunks ? chunkIndex < totalChunks - 1 : true;
  console.log(`[Components] Chunk ${chunkIndex + 1}: ${inserted}/${chunkRows.length} rows inserted`);

  // ✅ Clean up chunk file after processing to save disk space
  try {
    await fs.unlink(chunkPath);
  } catch {
    // Ignore cleanup errors
  }

  // If this is the last chunk, clean up the chunk directory
  if (!hasMore) {
    try {
      await fs.rm(path.join(uploadDir, `${filePath}_chunks`), { recursive: true, force: true });
      console.log(`[Components] Cleaned up chunk directory`);
    } catch {
      // Ignore cleanup errors
    }
  }

  return NextResponse.json({
    success: true,
    chunkIndex,
    inserted,
    processed: chunkRows.length,
    hasMore,
  });
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
      maxFileSize: MAX_FILE_SIZE / (1024 * 1024) + "MB",
    });

  } catch (error) {
    console.error("[Components] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch info" },
      { status: 500 }
    );
  }
}