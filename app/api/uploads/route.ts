// app/api/uploads/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parse } from "papaparse";
import { applyCalculationsAndDerivations } from "@/lib/field-calculations";
import { writeFile, mkdir, readFile, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    if (!file || !type) {
      return NextResponse.json({ error: "Missing file or type" }, { status: 400 });
    }

    console.log("Received file:", file.name, file.type, file.size);

    const arrayBuffer = await file.arrayBuffer();

    // Save file ke Railway Volume
    const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${type}_${timestamp}_${sanitizedName}`;
    const filePath = join(uploadDir, fileName);

    await writeFile(filePath, Buffer.from(arrayBuffer));

    console.log('File uploaded to Railway Volume:', {
      path: filePath,
      size: file.size,
      type,
    });

    const fileUrl = `/uploads/${fileName}`;
    const storedPath = fileName;

    return NextResponse.json({
      success: true,
      message: "File uploaded to Railway Volume",
      fileUrl,
      filePath: storedPath,
      fileName: file.name,
      fileSize: file.size,
      type,
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    // Process chunk dari file yang sudah diupload
    if (action === "processChunk") {
      return await processChunk(request);
    }

    // Get list of storage files (HO & OS)
    if (action === "getStorageFiles") {
      const type = searchParams.get("type") || "HO";
      const files = await getStorageFiles(type);
      return NextResponse.json({ success: true, files });
    }

    // Process file from storage (existing files)
    if (action === "processStorageFile") {
      return await processStorageFile(request);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("GET error:", error);
    return NextResponse.json(
      { error: error.message || "Request failed" },
      { status: 500 }
    );
  }
}

async function processChunk(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get("filePath");
  const fileName = searchParams.get("fileName");
  const type = searchParams.get("type");
  const chunkIndexStr = searchParams.get("chunkIndex");

  if (!filePath || !fileName || !type || chunkIndexStr === null) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const chunkIndex = parseInt(chunkIndexStr, 10);
  const ROWS_PER_CHUNK = 5000;

  console.log(`Processing chunk ${chunkIndex + 1} of ${fileName}`);

  try {
    // Read file dari Railway Volume
    const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';
    const fullPath = join(uploadDir, filePath);

    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const arrayBuffer = await readFile(fullPath);
    const buffer = Buffer.from(arrayBuffer);

    let allRows: any[] = [];

    // Parse CSV
    if (fileName.endsWith(".csv")) {
      const content = buffer.toString("utf-8");
      const parseResult = parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
      });
      allRows = parseResult.data as any[];
    }
    // Parse Excel
    else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      allRows = XLSX.utils.sheet_to_json(sheet);
    } else {
      return NextResponse.json({ error: "Unsupported file format" }, { status: 400 });
    }

    console.log(`Total rows in file: ${allRows.length}`);

    // Get chunk
    const startIdx = chunkIndex * ROWS_PER_CHUNK;
    const endIdx = startIdx + ROWS_PER_CHUNK;
    const chunkRows = allRows.slice(startIdx, endIdx);

    if (chunkRows.length === 0) {
      console.log("No more rows to process");
      return NextResponse.json({
        success: true,
        chunkIndex,
        inserted: 0,
        hasMore: false,
        message: "Processing complete",
      });
    }

    console.log(`Processing rows ${startIdx + 1} to ${Math.min(endIdx, allRows.length)}`);

    // Apply calculations & derivations
    const processedRows = chunkRows.map((row) =>
      applyCalculationsAndDerivations(row)
    );

    // Map to Employee schema
    const employees = processedRows
      .filter((row) => {
        const employeeNo = String(row["Employee No"] || "").trim();
        if (!employeeNo) {
          console.warn("Skipping row with missing Employee No");
          return false;
        }
        return true;
      })
      .map((row) => {
        const employeeNo = String(row["Employee No"]).trim();
        const bulanReport = String(row["Bulan Report"] || "").trim();

        // Build the employee object
        const employee: any = {
          employeeNo,
          bulanReport,
          uploadFilePath: filePath,
          type,
        };

        // Map all fields from row to employee
        for (const [key, value] of Object.entries(row)) {
          if (key === "Employee No" || key === "Bulan Report") continue;

          const fieldName = key
            .replace(/[^a-zA-Z0-9]/g, "_")
            .replace(/^_+|_+$/g, "")
            .toLowerCase();

          if (value !== null && value !== undefined && value !== "") {
            employee[fieldName] = String(value);
          } else {
            employee[fieldName] = null;
          }
        }

        return employee;
      });

    // Insert to database
    let inserted = 0;
    const BATCH_SIZE = 1000;

    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      const batch = employees.slice(i, i + BATCH_SIZE);

      try {
        const result = await prisma.employee.createMany({
          data: batch,
          skipDuplicates: true,
        });

        inserted += result.count;
        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Inserted ${result.count} rows`);

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Batch insert failed:`, error);
      }
    }

    console.log(`Chunk ${chunkIndex + 1} complete: ${inserted}/${chunkRows.length} rows inserted`);

    const hasMore = endIdx < allRows.length;

    return NextResponse.json({
      success: true,
      chunkIndex,
      inserted,
      totalRows: allRows.length,
      processedSoFar: Math.min(endIdx, allRows.length),
      hasMore,
    });

  } catch (error: any) {
    console.error("Chunk processing error:", error);
    return NextResponse.json(
      { error: error.message || "Processing failed" },
      { status: 500 }
    );
  }
}

async function getStorageFiles(type: string) {
  try {
    const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';

    if (!existsSync(uploadDir)) {
      return [];
    }

    const allFiles = await readdir(uploadDir);

    // Filter by type (HO or OS)
    const filteredFiles = allFiles
      .filter(f => f.startsWith(`${type}_`))
      .filter(f => f.endsWith('.csv') || f.endsWith('.xlsx') || f.endsWith('.xls'))
      .map(name => ({
        name,
        id: name,
        created_at: new Date().toISOString(), // Railway Volume doesn't store metadata
      }));

    return filteredFiles;
  } catch (error) {
    console.error(`Error listing ${type} files:`, error);
    return [];
  }
}

async function processStorageFile(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get("filePath");
  const type = searchParams.get("type");
  const chunkIndexStr = searchParams.get("chunkIndex");

  if (!filePath || !type || chunkIndexStr === null) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const chunkIndex = parseInt(chunkIndexStr, 10);
  const ROWS_PER_CHUNK = 5000;

  console.log(`[Storage] Processing ${filePath}, chunk ${chunkIndex + 1}`);

  try {
    // Read file dari Railway Volume
    const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';
    const fullPath = join(uploadDir, filePath);

    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const arrayBuffer = await readFile(fullPath);
    const buffer = Buffer.from(arrayBuffer);

    let allRows: any[] = [];

    // Parse CSV
    if (filePath.endsWith(".csv")) {
      const content = buffer.toString("utf-8");
      const parseResult = parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
      });
      allRows = parseResult.data as any[];
    }
    // Parse Excel
    else if (filePath.endsWith(".xlsx") || filePath.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      allRows = XLSX.utils.sheet_to_json(sheet);
    } else {
      return NextResponse.json({ error: "Unsupported file format" }, { status: 400 });
    }

    console.log(`[Storage] Total rows: ${allRows.length}`);

    // Get chunk
    const startIdx = chunkIndex * ROWS_PER_CHUNK;
    const endIdx = startIdx + ROWS_PER_CHUNK;
    const chunkRows = allRows.slice(startIdx, endIdx);

    if (chunkRows.length === 0) {
      return NextResponse.json({
        success: true,
        chunkIndex,
        inserted: 0,
        hasMore: false,
        message: "Processing complete",
      });
    }

    // Apply calculations
    const processedRows = chunkRows.map((row) =>
      applyCalculationsAndDerivations(row)
    );

    // Map to Employee schema
    const employees = processedRows
      .filter((row) => {
        const employeeNo = String(row["Employee No"] || "").trim();
        return !!employeeNo;
      })
      .map((row) => {
        const employeeNo = String(row["Employee No"]).trim();
        const bulanReport = String(row["Bulan Report"] || "").trim();

        const employee: any = {
          employeeNo,
          bulanReport,
          uploadFilePath: filePath,
          type,
        };

        for (const [key, value] of Object.entries(row)) {
          if (key === "Employee No" || key === "Bulan Report") continue;

          const fieldName = key
            .replace(/[^a-zA-Z0-9]/g, "_")
            .replace(/^_+|_+$/g, "")
            .toLowerCase();

          if (value !== null && value !== undefined && value !== "") {
            employee[fieldName] = String(value);
          } else {
            employee[fieldName] = null;
          }
        }

        return employee;
      });

    // Insert to database
    let inserted = 0;
    const BATCH_SIZE = 1000;

    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      const batch = employees.slice(i, i + BATCH_SIZE);

      try {
        const result = await prisma.employee.createMany({
          data: batch,
          skipDuplicates: true,
        });

        inserted += result.count;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Batch insert failed:`, error);
      }
    }

    console.log(`[Storage] Chunk ${chunkIndex + 1}: ${inserted}/${chunkRows.length} inserted`);

    const hasMore = endIdx < allRows.length;

    return NextResponse.json({
      success: true,
      chunkIndex,
      inserted,
      totalRows: allRows.length,
      processedSoFar: Math.min(endIdx, allRows.length),
      hasMore,
    });

  } catch (error: any) {
    console.error("[Storage] Error:", error);
    return NextResponse.json(
      { error: error.message || "Processing failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("filePath");

    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }

    console.log("Deleting file:", filePath);

    // Delete file dari Railway Volume
    const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';
    const fullPath = join(uploadDir, filePath);

    if (existsSync(fullPath)) {
      await unlink(fullPath);
      console.log("File deleted from Railway Volume:", filePath);
    } else {
      console.warn("File not found, skipping deletion:", filePath);
    }

    // Delete associated Upload record (employees cascade-delete via schema)
    const upload = await prisma.upload.findFirst({
      where: { fileName: filePath },
    });

    let deletedCount = 0;
    if (upload) {
      // Deleting the Upload will cascade-delete all associated employees
      await prisma.upload.delete({ where: { id: upload.id } });
      deletedCount = upload.rowCount;
      console.log(`Deleted upload ${upload.id} and associated employees`);
    } else {
      console.warn("No upload record found for file:", filePath);
    }

    return NextResponse.json({
      success: true,
      message: `File and ${deletedCount} records deleted`,
      deletedRecords: deletedCount,
    });

  } catch (error: any) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: error.message || "Delete failed" },
      { status: 500 }
    );
  }
}