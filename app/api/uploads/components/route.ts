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
const ROWS_PER_REQUEST = 10000;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // ✅ Check content type to determine if this is a file upload or chunk processing
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // ========================================
      // FILE UPLOAD (save to disk only, no processing)
      // ========================================
      return await handleFileUpload(request, user);
    } else {
      // ========================================
      // CHUNK PROCESSING (read saved file, process rows)
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
 * Handle file upload — save file to disk, return file path.
 * Does NOT process the data (no DB inserts here).
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

  // Save to disk
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  await fs.mkdir(uploadDir, { recursive: true });

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${type}_${timestamp}_${sanitizedName}`;
  const filePath = path.join(uploadDir, fileName);

  await fs.writeFile(filePath, buffer);

  console.log(`[Components] File saved: ${fileName}`);

  return NextResponse.json({
    success: true,
    filePath: fileName,
    fileName: file.name,
    fileSize: file.size,
    fileUrl: `/uploads/${fileName}`,
  });
}

/**
 * Handle chunk processing — read saved file, process a chunk of rows into DB.
 */
async function handleChunkProcessing(request: NextRequest, user: any) {
  const body = await request.json();
  const { fileUrl, filePath, fileName, fileSize, type, chunkIndex } = body;

  if (!fileUrl || !filePath || !fileName || !type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (chunkIndex === undefined) {
    return NextResponse.json({ error: "Missing chunkIndex" }, { status: 400 });
  }

  console.log(`[Components] Processing chunk ${chunkIndex + 1} of ${fileName}`);

  // Read file from Railway Volume
  const fullPath = path.join(process.env.UPLOAD_DIR || './uploads', filePath);
  const buffer = await fs.readFile(fullPath);

  let allRows: any[] = [];

  // ✅ Parse based on file type
  if (fileName.endsWith(".csv")) {
    const content = buffer.toString("utf-8");
    const parseResult = parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });
    allRows = parseResult.data as any[];
  } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    allRows = XLSX.utils.sheet_to_json(sheet);
  } else {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  // ✅ Get chunk rows
  const startIdx = chunkIndex * ROWS_PER_REQUEST;
  const endIdx = startIdx + ROWS_PER_REQUEST;
  const chunkRows = allRows.slice(startIdx, endIdx);

  // ✅ If no rows in this chunk, we're done
  if (chunkRows.length === 0) {
    return NextResponse.json({
      success: true,
      chunkIndex,
      inserted: 0,
      processed: 0,
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

  console.log(`[Components] Chunk ${chunkIndex + 1}: ${inserted}/${chunkRows.length} rows inserted`);

  return NextResponse.json({
    success: true,
    chunkIndex,
    inserted,
    processed: chunkRows.length,
    hasMore: endIdx < allRows.length,
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