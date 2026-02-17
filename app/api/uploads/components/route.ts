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
const EMPLOYEES_PER_CHUNK = 2000; // Grouped employees per chunk (not raw rows)

function getUploadDir() {
  return process.env.UPLOAD_DIR || './uploads';
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      return await handleFileUpload(request, user);
    } else {
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
 * Handle file upload — save file, parse, GROUP BY employeeNo, split into chunks.
 * Each employee becomes 1 row with all komponen as JSON instead of 24 separate rows.
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

  // ✅ Parse file ONCE
  console.time('[Components] Parse + Group');
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

  const totalRawRows = allRows.length;
  console.log(`[Components] Parsed ${totalRawRows} raw rows`);

  // ✅ GROUP BY employeeNo — merge all komponen into JSON per employee
  const employeeMap = new Map<string, { bulanReport: string; data: Record<string, any> }>();

  allRows.forEach(row => {
    const employeeNo = String(row["Employee No"] || "").trim();
    const komponen = String(row["Komponen"] || "").trim();
    const nilai = String(row["Nilai"] || "").trim();
    const bulanReport = String(row["Bulan Report"] || "").trim();

    if (!employeeNo || !komponen || !bulanReport) return;

    const key = `${employeeNo}__${bulanReport}`;

    if (!employeeMap.has(key)) {
      employeeMap.set(key, { bulanReport, data: {} });
    }

    const entry = employeeMap.get(key)!;
    entry.data[komponen] = nilai;

    // Also store remark fields if present
    if (row["Remark"]) entry.data[`${komponen}_remark`] = String(row["Remark"]).trim();
    if (row["Remark2"]) entry.data[`${komponen}_remark2`] = String(row["Remark2"]).trim();
    if (row["Remark3"]) entry.data[`${komponen}_remark3`] = String(row["Remark3"]).trim();
  });

  // Convert Map to array of grouped employees
  const groupedEmployees = Array.from(employeeMap.entries()).map(([key, value]) => ({
    employeeNo: key.split('__')[0],
    bulanReport: value.bulanReport,
    data: value.data,
  }));

  const totalEmployees = groupedEmployees.length;
  const totalChunks = Math.ceil(totalEmployees / EMPLOYEES_PER_CHUNK);

  console.log(`[Components] ${totalRawRows} rows → ${totalEmployees} employees (${totalChunks} chunks)`);

  // Write chunk files
  const chunkDir = path.join(uploadDir, `${baseName}_chunks`);
  await fs.mkdir(chunkDir, { recursive: true });

  const chunkWritePromises = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * EMPLOYEES_PER_CHUNK;
    const end = start + EMPLOYEES_PER_CHUNK;
    const chunkData = groupedEmployees.slice(start, end);
    const chunkPath = path.join(chunkDir, `chunk_${i}.json`);
    chunkWritePromises.push(fs.writeFile(chunkPath, JSON.stringify(chunkData)));
  }
  await Promise.all(chunkWritePromises);

  console.timeEnd('[Components] Parse + Group');

  // Free memory
  allRows = [];

  return NextResponse.json({
    success: true,
    filePath: baseName,
    fileName: file.name,
    fileSize: file.size,
    fileUrl: `/uploads/${baseName}`,
    totalRows: totalRawRows,
    totalEmployees,
    totalChunks,
  });
}

/**
 * Handle chunk processing — read pre-grouped JSON chunk, upsert into DB.
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

  // Read pre-grouped chunk
  let chunkEmployees: { employeeNo: string; bulanReport: string; data: Record<string, any> }[];
  try {
    const chunkData = await fs.readFile(chunkPath, 'utf-8');
    chunkEmployees = JSON.parse(chunkData);
  } catch {
    return NextResponse.json({
      success: true,
      chunkIndex,
      inserted: 0,
      processed: 0,
      hasMore: false,
      message: "No more chunks to process",
    });
  }

  if (chunkEmployees.length === 0) {
    return NextResponse.json({
      success: true,
      chunkIndex,
      inserted: 0,
      processed: 0,
      hasMore: false,
    });
  }

  // ✅ Upsert each employee (1 row per employee per period per type)
  let inserted = 0;
  const batchSize = 500;

  for (let i = 0; i < chunkEmployees.length; i += batchSize) {
    const batch = chunkEmployees.slice(i, i + batchSize);

    // Use a transaction for each batch
    try {
      await prisma.$transaction(
        batch.map(emp =>
          prisma.employeeComponent.upsert({
            where: {
              employeeNo_bulanReport_type: {
                employeeNo: emp.employeeNo,
                bulanReport: emp.bulanReport,
                type,
              },
            },
            update: {
              data: emp.data,
              uploadedBy: user.id,
            },
            create: {
              employeeNo: emp.employeeNo,
              bulanReport: emp.bulanReport,
              type,
              data: emp.data,
              uploadedBy: user.id,
            },
          })
        )
      );
      inserted += batch.length;
    } catch (error) {
      console.error(`Batch upsert failed:`, error);
    }
  }

  const hasMore = totalChunks ? chunkIndex < totalChunks - 1 : true;
  console.log(`[Components] Chunk ${chunkIndex + 1}: ${inserted}/${chunkEmployees.length} employees upserted`);

  // Clean up chunk file
  try { await fs.unlink(chunkPath); } catch { /* ignore */ }

  if (!hasMore) {
    try {
      await fs.rm(path.join(uploadDir, `${filePath}_chunks`), { recursive: true, force: true });
      console.log(`[Components] Cleaned up chunk directory`);
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    success: true,
    chunkIndex,
    inserted,
    processed: chunkEmployees.length,
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