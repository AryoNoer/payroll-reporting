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

// Fields that map directly to Employee model columns
const EMPLOYEE_DIRECT_FIELDS = [
  'Employee No', 'Name', 'Gender', 'No KTP', 'Gov. Tax File No.',
  'Position', 'Directorate', 'Org Unit', 'Grade',
  'Employment Status', 'Join Date', 'Terminate Date', 'Length of Service',
  'Tax Status'
];

// Fields categorized as "neutral" (demographic/organizational, not financial)
const NEUTRAL_FIELD_PATTERNS = [
  'Bulan Report', 'No', 'Department', 'Directorate', 'Directorate 2',
  'Tax Location', 'Tax Location Code', 'Tax Location Name',
  'Cost Center', 'Cost Center Code', 'Cost Center By Function',
  'Coa', 'Level', 'Jobstatus Code', 'Jobstatus Name',
  'Work Location', 'Work Location Code', 'Account Name', 'Bank Account',
  'Birth Date', 'Age',
];

// Fields categorized as "deduction" (potongan)
const DEDUCTION_FIELD_PATTERNS = [
  'Pot.', 'Potongan', 'Deduction', 'BPJS JHT', 'BPJS Pensiun',
  'BPJS Kesehatan', 'BPJS JKK (Kemitraan)', 'BPJS JKM (Kemitraan)',
  'Tax', 'Tax Penalty', 'Deposit Atribut',
  'Tunjangan Operational Dibayar Kas', 'Uang Jalan - Line Haul (D)',
  'Lembur - Line Haul (D)', 'Lembur Harian (D)',
  'Uang Makan Perdin (D)', 'Uang Saku Perdin (D)',
  'Potongan Hutang Cuti', 'Reward (D)', 'Deduction Komisi Karyawan',
  'Total Deduction',
];

// Fields categorized as "allowance" (calculated totals)
const ALLOWANCE_FIELD_PATTERNS = [
  'Total Basic Salary', 'Total Uang Makan', 'Total Uang Transport',
  'Total Tunjangan Jabatan', 'Total Insentif Inhouse', 'Total Sisa Cuti',
  'Total Uang Pisah', 'Total Tunjangan Operasional', 'Total Komisi Karyawan',
  'Total Insentif Mitra', 'Total Bonus Inhouse', 'Total Bonus Mitra',
  'Total Lembur', 'Total Perjalanan Dinas', 'Total Biaya Pengobatan Karyawan',
  'Total THR', 'Total BPJS TK', 'Total BPJS Kes', 'Total Allowance',
  'Net Salary', 'Net Salary (before tax)', 'Net Salary (after tax)',
  'BHR Mitra',
];

function categorizeField(fieldName: string): 'salary' | 'allowance' | 'deduction' | 'neutral' | 'skip' {
  // Skip employee direct fields (mapped separately)
  if (EMPLOYEE_DIRECT_FIELDS.includes(fieldName)) return 'skip';

  // Check neutral patterns
  if (NEUTRAL_FIELD_PATTERNS.includes(fieldName)) return 'neutral';

  // Check deduction patterns
  for (const pattern of DEDUCTION_FIELD_PATTERNS) {
    if (fieldName === pattern || fieldName.startsWith(pattern)) return 'deduction';
  }

  // Check allowance patterns (calculated totals)
  if (ALLOWANCE_FIELD_PATTERNS.includes(fieldName)) return 'allowance';

  // Everything else is salary (raw salary components)
  return 'salary';
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr === '' || dateStr === '-') return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function mapRowToEmployee(row: any, uploadId: string) {
  const employeeNo = String(row['Employee No'] || '').trim();
  if (!employeeNo) return null;

  const salaryData: Record<string, any> = {};
  const allowanceData: Record<string, any> = {};
  const deductionData: Record<string, any> = {};
  const neutralData: Record<string, any> = {};

  // Categorize all fields into JSON blobs
  for (const [key, value] of Object.entries(row)) {
    const category = categorizeField(key);
    if (category === 'skip') continue;

    const val = value !== null && value !== undefined && value !== '' ? value : null;

    switch (category) {
      case 'salary':
        salaryData[key] = val;
        break;
      case 'allowance':
        allowanceData[key] = val;
        break;
      case 'deduction':
        deductionData[key] = val;
        break;
      case 'neutral':
        neutralData[key] = val;
        break;
    }
  }

  return {
    uploadId,
    employeeNo,
    name: String(row['Name'] || '').trim(),
    gender: row['Gender'] ? String(row['Gender']).trim() : null,
    noKTP: row['No KTP'] ? String(row['No KTP']).trim() : null,
    taxFileNo: row['Gov. Tax File No.'] ? String(row['Gov. Tax File No.']).trim() : null,
    position: row['Position'] ? String(row['Position']).trim() : null,
    directorate: row['Directorate'] ? String(row['Directorate']).trim() : null,
    orgUnit: row['Org Unit'] ? String(row['Org Unit']).trim() : null,
    grade: row['Grade'] ? String(row['Grade']).trim() : null,
    employmentStatus: row['Employment Status'] ? String(row['Employment Status']).trim() : null,
    joinDate: parseDate(row['Join Date']),
    terminateDate: parseDate(row['Terminate Date']),
    lengthOfService: row['Length of Service'] ? String(row['Length of Service']).trim() : null,
    taxStatus: row['Tax Status'] ? String(row['Tax Status']).trim() : null,
    salaryData,
    allowanceData,
    deductionData,
    neutralData,
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    // Accept both "type" and "period" field names from different upload pages
    const type = (formData.get("type") as string) || (formData.get("period") as string) || "payroll";

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    console.log("Received file:", file.name, file.type, file.size);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save file to storage
    const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${type}_${timestamp}_${sanitizedName}`;
    const filePath = join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    console.log('File saved:', { path: filePath, size: file.size, type });

    // Parse CSV/Excel
    let allRows: any[] = [];

    if (file.name.endsWith('.csv')) {
      const content = buffer.toString('utf-8');
      const parseResult = parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
      });
      allRows = parseResult.data as any[];
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      allRows = XLSX.utils.sheet_to_json(sheet);
    } else {
      return NextResponse.json({ error: "Unsupported file format. Use CSV or Excel." }, { status: 400 });
    }

    console.log(`Parsed ${allRows.length} rows from ${file.name}`);

    // Parse period from type field (e.g., "2026-02" -> Date)
    let periodDate = new Date();
    try {
      if (type && type.match(/^\d{4}-\d{2}/)) {
        periodDate = new Date(type + '-01');
      }
    } catch {
      // Use current date as fallback
    }

    // Create Upload record
    const upload = await prisma.upload.create({
      data: {
        fileName,
        originalName: file.name,
        fileSize: file.size,
        rowCount: allRows.length,
        period: periodDate,
        status: 'PROCESSING',
        progress: 0,
        userId: user.id,
      },
    });

    console.log(`Created Upload record: ${upload.id}`);

    // Process and insert employees in batches
    const BATCH_SIZE = 1000;
    let totalInserted = 0;
    let totalSkipped = 0;

    // Apply calculations to all rows
    const processedRows = allRows.map(row => applyCalculationsAndDerivations(row));

    for (let i = 0; i < processedRows.length; i += BATCH_SIZE) {
      const batch = processedRows.slice(i, i + BATCH_SIZE);

      const employees = batch
        .map(row => mapRowToEmployee(row, upload.id))
        .filter((emp): emp is NonNullable<typeof emp> => emp !== null);

      if (employees.length === 0) {
        totalSkipped += batch.length;
        continue;
      }

      try {
        const result = await prisma.employee.createMany({
          data: employees,
          skipDuplicates: true,
        });
        totalInserted += result.count;
        totalSkipped += (employees.length - result.count);

        // Update progress
        const progress = Math.round(((i + batch.length) / processedRows.length) * 100);
        await prisma.upload.update({
          where: { id: upload.id },
          data: { progress },
        });

        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.count} inserted`);
      } catch (error: any) {
        console.error(`Batch insert error:`, error.message);
      }
    }

    // Mark upload as complete
    await prisma.upload.update({
      where: { id: upload.id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        rowCount: totalInserted,
      },
    });

    console.log(`Upload complete: ${totalInserted} inserted, ${totalSkipped} skipped`);

    return NextResponse.json({
      success: true,
      message: `File uploaded and processed`,
      fileUrl: `/uploads/${fileName}`,
      filePath: fileName,
      fileName: file.name,
      fileSize: file.size,
      type,
      uploadId: upload.id,
      rowCount: totalInserted,
      skippedCount: totalSkipped,
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

    // Default: return upload history from database
    const uploads = await prisma.upload.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: {
        _count: {
          select: { employees: true }
        }
      }
    });

    return NextResponse.json(uploads);

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
  const uploadId = searchParams.get("uploadId");
  const chunkIndexStr = searchParams.get("chunkIndex");

  if (!filePath || !fileName || !type || chunkIndexStr === null) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const chunkIndex = parseInt(chunkIndexStr, 10);
  const ROWS_PER_CHUNK = 5000;

  console.log(`Processing chunk ${chunkIndex + 1} of ${fileName}`);

  try {
    // Read file from storage
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
      return NextResponse.json({
        success: true,
        chunkIndex,
        inserted: 0,
        hasMore: false,
        message: "Processing complete",
      });
    }

    // Apply calculations & map to Employee schema
    const processedRows = chunkRows.map((row) =>
      applyCalculationsAndDerivations(row)
    );

    // Need an uploadId to link employees
    let resolvedUploadId = uploadId;
    if (!resolvedUploadId) {
      // Try to find or create an upload record
      const existingUpload = await prisma.upload.findFirst({
        where: { fileName: filePath },
      });
      resolvedUploadId = existingUpload?.id;
    }

    if (!resolvedUploadId) {
      return NextResponse.json({ error: "No upload record found. Upload the file first." }, { status: 400 });
    }

    const employees = processedRows
      .map(row => mapRowToEmployee(row, resolvedUploadId!))
      .filter((emp): emp is NonNullable<typeof emp> => emp !== null);

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
        created_at: new Date().toISOString(),
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
    // Read file from storage
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

    // Find or create Upload record
    let upload = await prisma.upload.findFirst({
      where: { fileName: filePath },
    });

    if (!upload) {
      const user = await requireAuth();
      upload = await prisma.upload.create({
        data: {
          fileName: filePath,
          originalName: filePath,
          fileSize: buffer.length,
          rowCount: allRows.length,
          period: new Date(),
          status: 'PROCESSING',
          progress: 0,
          userId: user.id,
        },
      });
    }

    // Map to Employee schema
    const employees = processedRows
      .map(row => mapRowToEmployee(row, upload!.id))
      .filter((emp): emp is NonNullable<typeof emp> => emp !== null);

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

    // Update upload progress
    if (!hasMore) {
      await prisma.upload.update({
        where: { id: upload.id },
        data: { status: 'COMPLETED', progress: 100 },
      });
    }

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

    // Delete file from storage
    const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';
    const fullPath = join(uploadDir, filePath);

    if (existsSync(fullPath)) {
      await unlink(fullPath);
      console.log("File deleted:", filePath);
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