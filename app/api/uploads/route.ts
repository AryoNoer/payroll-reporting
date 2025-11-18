/* eslint-disable @typescript-eslint/no-explicit-any */

// app/api/uploads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { applyCalculationsAndDerivations } from "@/lib/field-calculations";

// Error logger helper
class UploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Fields that should ALWAYS be treated as text/string
 */
const TEXT_ONLY_FIELDS = new Set([
  'Jobstatus Code',
  'No KTP',
  'Gov. Tax File No.',
  'Employee No',
  'Cost Center Code',
  'Work Location Code',
  'Tax Location Code',
  'Tax Location Name',
  'Company Bank Account',
  'Bank Account',
  'Insurance No BPJSKT',
  'Insurance No BPJSKES',
  'Tax File No',
  'Account Name',
  'Company Account Name'
]);

const BATCH_SIZE = 100;

export async function GET() {
  try {
    const user = await requireAuth();

    const uploads = await prisma.upload.findMany({
      where: { userId: user.id },
      orderBy: { uploadedAt: "desc" },
      take: 20,
    });

    return NextResponse.json(uploads);
  } catch (error) {
    console.error("[GET /api/uploads] Error:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  console.log("📥 [DEBUG] Request method:", request.method);
  const startTime = Date.now();
  console.log("\n=== UPLOAD REQUEST STARTED ===");
  
  try {
    // Step 1: Authenticate user
    console.log("[Step 1] Authenticating user...");
    const user = await requireAuth();
    console.log(`✓ User authenticated: ${user.email}`);

    // Step 2: Parse form data
    console.log("[Step 2] Parsing form data...");
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const period = formData.get("period") as string;

    if (!file) {
      throw new UploadError("File is required", "MISSING_FILE");
    }
    if (!period) {
      throw new UploadError("Period is required", "MISSING_PERIOD");
    }

    console.log(`✓ File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    console.log(`✓ Period: ${period}`);

    // Step 3: Read file content
    console.log("[Step 3] Reading file content...");
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    let content: string;
    try {
      content = buffer.toString("utf-8");
      
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.substring(1);
        console.log('  ⚠ Removed UTF-8 BOM');
      }
      
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
    } catch (error) {
      console.warn('  ⚠ UTF-8 decode failed, trying latin1...');
      content = buffer.toString("latin1");
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    
    console.log(`✓ File read: ${content.length} characters`);

    // Step 3.5: Handle double header rows
    console.log("[Step 3.5] Detecting header structure...");
    const lines = content.split('\n');
    let finalContent = content;
    
    if (lines.length > 1) {
      const firstLine = lines[0] || '';
      const secondLine = lines[1] || '';
      
      const firstLineUpper = firstLine.toUpperCase();
      const hasCategories = 
        firstLineUpper.includes('SALARY') || 
        firstLineUpper.includes('ALLOWANCE') ||
        firstLineUpper.includes('DEDUCTION') ||
        firstLineUpper.includes('NEUTRAL') ||
        firstLineUpper.includes('TOTAL');
      
      const secondLineHasNames = 
        secondLine.includes('Name') || 
        secondLine.includes('Employee');
      
      if (hasCategories && secondLineHasNames) {
        console.log('✓ Detected double header format');
        
        const categoryParse = parse(firstLine, { header: false });
        const fieldParse = parse(secondLine, { header: false });
        
        const categories = (categoryParse.data[0] || []) as string[];
        const fields = (fieldParse.data[0] || []) as string[];
        
        const mergedHeaders: string[] = [];
        for (let i = 0; i < Math.max(categories.length, fields.length); i++) {
          const field = (fields[i] || '').trim();
          
          if (!field || /^\d+$/.test(field)) {
            mergedHeaders.push((categories[i] || '').trim() || `Column_${i}`);
          } else {
            mergedHeaders.push(field);
          }
        }
        
        const dataLines = lines.slice(2);
        finalContent = mergedHeaders.join(',') + '\n' + dataLines.join('\n');
        
        console.log('✓ Headers merged');
      }
    }

    // Step 4: Parse CSV
    console.log("[Step 4] Parsing CSV...");
    
    const firstDataLine = finalContent.split('\n')[0] || '';
    const detectedDelimiter = firstDataLine.includes('\t') ? '\t' : ',';
    
    const parseResult = parse(finalContent, {
      header: true,
      delimiter: detectedDelimiter,
      skipEmptyLines: true,
      newline: '\n',
      quoteChar: '"',
      escapeChar: '"',
      transformHeader: (header: string, index: number) => {
        const cleanHeader = header.trim();
        if (!cleanHeader) {
          return `Column_${index}`;
        }
        return cleanHeader;
      },
      transform: (value: string) => value?.trim() || "",
    });

    const { data, errors, meta } = parseResult;

    console.log(`✓ CSV parsed successfully`);
    console.log(`  - Rows: ${(data as any[]).length}`);
    console.log(`  - Columns: ${meta.fields?.length || 0}`);

    if (errors.length > 0) {
      console.error("\n❌ CSV Parse Errors:");
      console.error(`Total errors: ${errors.length}`);
      
      let errorMessage = "CSV parsing failed";
      if (errors[0].code === "TooManyFields") {
        errorMessage = `CSV format error: File has inconsistent columns.`;
      }
      
      throw new UploadError(
        errorMessage,
        "PARSE_ERROR",
        { totalErrors: errors.length }
      );
    }

    if (!data || (data as any[]).length === 0) {
      throw new UploadError("CSV file is empty", "EMPTY_FILE");
    }

    // Step 5: Validate headers
    console.log("[Step 5] Validating CSV structure...");
    const requiredColumns = ["Name", "Employee No"];
    const firstRow = (data as any[])[0];
    const headers = Object.keys(firstRow);
    
    const missingColumns = requiredColumns.filter(
      col => !headers.some(h => h.includes(col))
    );

    if (missingColumns.length > 0) {
      throw new UploadError(
        `Missing required columns: ${missingColumns.join(", ")}`,
        "MISSING_COLUMNS",
        { missing: missingColumns }
      );
    }

    // ✅ NEW: Step 5.5 - Check for duplicates WITHIN the file
    console.log("[Step 5.5] Checking for duplicate Employee No in file...");
    const employeeNosInFile = new Set<string>();
    const duplicatesInFile: string[] = [];
    
    (data as any[]).forEach((row, index) => {
      const empNo = String(row["Employee No"] || "").trim();
      if (empNo && employeeNosInFile.has(empNo)) {
        duplicatesInFile.push(`${empNo} (Row ${index + 2})`);
      }
      if (empNo) {
        employeeNosInFile.add(empNo);
      }
    });

    if (duplicatesInFile.length > 0) {
      console.error(`❌ Found ${duplicatesInFile.length} duplicate Employee No in file`);
      throw new UploadError(
        `File contains duplicate Employee No. Please remove duplicates and try again.`,
        "DUPLICATE_IN_FILE",
        {
          duplicateCount: duplicatesInFile.length,
          duplicates: duplicatesInFile.slice(0, 10),
          message: duplicatesInFile.length > 10 
            ? `Showing first 10 of ${duplicatesInFile.length} duplicates`
            : undefined
        }
      );
    }
    console.log(`✓ No duplicates within file`);

    // ✅ NEW: Step 5.6 - Check for duplicates with SAME PERIOD
    console.log("[Step 5.6] Checking for duplicates with same period...");
    const uploadPeriod = new Date(period + "-01");
    
    const existingEmployees = await prisma.employee.findMany({
      where: {
        employeeNo: { in: Array.from(employeeNosInFile) },
        upload: {
          period: uploadPeriod,
          userId: user.id
        }
      },
      select: {
        employeeNo: true,
        name: true,
        upload: {
          select: {
            originalName: true,
            uploadedAt: true
          }
        }
      }
    });

    if (existingEmployees.length > 0) {
      console.warn(`⚠ Found ${existingEmployees.length} employees already exist for period ${period}`);
      const duplicateList = existingEmployees.slice(0, 10).map(e => 
        `${e.employeeNo} - ${e.name} (from ${e.upload.originalName})`
      );
      
      console.log(`  Will skip these ${existingEmployees.length} duplicate employees during insert`);
    } else {
      console.log(`✓ No duplicates with same period found`);
    }

    // Step 6: Save file
    console.log("[Step 6] Saving file to disk...");
    const uploadDir = join(process.cwd(), "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);
    console.log(`✓ File saved: ${fileName}`);

    // Step 7: Create database record
    console.log("[Step 7] Creating upload record...");
    const upload = await prisma.upload.create({
      data: {
        fileName,
        originalName: file.name,
        fileSize: file.size,
        rowCount: (data as any[]).length,
        period: uploadPeriod,
        status: "PROCESSING",
        userId: user.id,
      },
    });
    console.log(`✓ Upload record created: ${upload.id}`);

    // Step 8: Start background processing
    console.log("[Step 8] Starting background processing...");
    processUploadData(upload.id, data as any[], headers).catch((error) => {
      console.error("❌ Background processing error:", error);
    });

    const duration = Date.now() - startTime;
    console.log(`✓ Upload completed in ${duration}ms`);
    console.log("=== UPLOAD REQUEST COMPLETED ===\n");

    // ✅ NEW: Return warning if duplicates exist
    return NextResponse.json({
      ...upload,
      warning: existingEmployees.length > 0 ? {
        duplicateCount: existingEmployees.length,
        message: `${existingEmployees.length} employees already exist for this period and will be skipped`
      } : undefined
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("\n❌ UPLOAD FAILED");
    console.error(`Duration: ${duration}ms`);
    
    if (error instanceof UploadError) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          details: error.details
        },
        { status: 400 }
      );
    }

    console.error("Unexpected error:", error);
    return NextResponse.json(
      { 
        error: "Failed to upload file", 
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

function parseValue(key: string, value: any): any {
  if (value === null || value === undefined || value === '') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  if (TEXT_ONLY_FIELDS.has(key)) {
    return value.trim();
  }

  const cleanValue = value.replace(/['"',]/g, '').trim();
  
  if (/^-?\d+\.?\d*$/.test(cleanValue)) {
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? cleanValue : numValue;
  }

  return cleanValue;
}

async function processUploadData(
  uploadId: string,
  rows: any[],
  headers: string[]
) {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 PROCESSING UPLOAD ${uploadId}`);
  console.log(`${'='.repeat(70)}\n`);

  const errorLog: Array<{
    row: number;
    error: string;
    data: any;
  }> = [];

  try {
    await prisma.upload.update({
      where: { id: uploadId },
      data: { progress: 0 },
    });

    console.log("[Step 1] Loading component mappings...");
    const components = await prisma.component.findMany({
      where: { isActive: true },
    });
    console.log(`✓ Loaded ${components.length} components\n`);

    const componentMap = new Map(components.map(c => [c.name, c]));

    const dedicatedFields = new Set([
      'No', 'Name', 'Employee No', 'Gender', 'No KTP', 'Gov. Tax File No.',
      'Position', 'Directorate', 'Org Unit', 'Grade', 'Employment Status',
      'Join Date', 'Terminate Date', 'Length of Service', 'Tax Status'
    ]);

    const skipFields = new Set(['No']);

    const parseDate = (dateStr: string | null | undefined): Date | null => {
      if (!dateStr || dateStr === '') return null;
      try {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
      } catch {
        return null;
      }
    };

    console.log("[Step 2] Processing rows in batches...\n");
    let processedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
      const batchRows = rows.slice(batchStart, batchEnd);

      const batchStartTime = Date.now();
      console.log(`[Batch ${batchIndex + 1}/${totalBatches}] Processing rows ${batchStart + 1}-${batchEnd}...`);

      const batchData: any[] = [];

      for (let i = 0; i < batchRows.length; i++) {
        const row = batchRows[i];
        const rowNumber = batchStart + i + 1;

        try {
          if (!row.Name && !row["Employee No"]) {
            skippedCount++;
            continue;
          }

          const salaryData: Record<string, any> = {};
          const allowanceData: Record<string, any> = {};
          const deductionData: Record<string, any> = {};
          const neutralData: Record<string, any> = {};

          for (const [key, value] of Object.entries(row)) {
            if (skipFields.has(key)) continue;
            if (!key || key.startsWith("Column_")) continue;

            const parsedValue = parseValue(key, value);

            if (dedicatedFields.has(key)) {
              neutralData[key] = parsedValue;
              continue;
            }

            const component = componentMap.get(key);
            
            if (component) {
              switch (component.type) {
                case "ALLOWANCE":
                  allowanceData[key] = parsedValue;
                  break;
                case "DEDUCTION":
                  deductionData[key] = parsedValue;
                  break;
                case "NEUTRAL":
                  neutralData[key] = parsedValue;
                  break;
              }
            } else {
              const keyLower = key.toLowerCase();
              
              if (
                key === "Basic Salary" ||
                key === "Basic Salary Tambahan" ||
                key === "Rapel Salary" ||
                keyLower.includes("salary") || 
                keyLower.includes("gaji")
              ) {
                salaryData[key] = parsedValue;
              } else if (
                keyLower.includes("tunjangan") || 
                keyLower.includes("allowance") ||
                keyLower.includes("insentif") ||
                keyLower.includes("bonus") ||
                keyLower.includes("uang") ||
                keyLower.includes("claim") ||
                keyLower.includes("santunan") ||
                keyLower.includes("rapel") ||
                keyLower.includes("reward") ||
                keyLower.includes("lemburan") ||
                (key.startsWith("BPJS") && key.includes("Pemberi Kerja"))
              ) {
                allowanceData[key] = parsedValue;
              } else if (
                keyLower.includes("potongan") ||
                keyLower.includes("pot.") ||
                keyLower.includes("deduction") ||
                (keyLower.includes("tax") && !keyLower.includes("tax status") && !keyLower.includes("tax location")) ||
                (key.startsWith("BPJS") && (key.includes("Gross") || key.includes("Kemitraan") || 
                  (key.includes("BPJS") && !key.includes("Pemberi Kerja"))))
              ) {
                deductionData[key] = parsedValue;
              } else {
                neutralData[key] = parsedValue;
              }
            }
          }

          const combinedData = {
            ...row,
            ...salaryData,
            ...allowanceData,
            ...deductionData,
            ...neutralData
          };

          const calculatedData = applyCalculationsAndDerivations(combinedData);

          const calculatedFields = [
            'Cost Center By Function', 'Coa', 'Department', 'Tax Location Code',
            'Tax Location Name', 'Bank Account', 'Total Basic Salary', 'Total Uang Makan',
            'Total Uang Transport', 'Total Tunjangan Jabatan', 'Total Insentif Inhouse',
            'Total Sisa Cuti', 'Total Uang Pisah', 'Total Tunjangan Operasional',
            'Total Komisi Karyawan', 'Total Insentif Mitra', 'Total Bonus Inhouse',
            'Total Bonus Mitra', 'Total Lembur', 'Total Perjalanan Dinas',
            'Total Biaya Pengobatan Karyawan', 'Total THR', 'Total BPJS TK',
            'Total BPJS Kes', 'Total Deduction'
          ];

          calculatedFields.forEach(field => {
            if (calculatedData[field] !== undefined) {
              neutralData[field] = calculatedData[field];
            }
          });

          batchData.push({
            uploadId,
            employeeNo: String(row["Employee No"] || ""),
            name: String(row["Name"] || ""),
            gender: row["Gender"] || null,
            noKTP: row["No KTP"] || null,
            taxFileNo: row["Gov. Tax File No."] || null,
            position: row["Position"] || null,
            directorate: row["Directorate"] || null,
            orgUnit: row["Org Unit"] || null,
            grade: row["Grade"] || null,
            employmentStatus: row["Employment Status"] || null,
            joinDate: parseDate(row["Join Date"]),
            terminateDate: parseDate(row["Terminate Date"]),
            lengthOfService: row["Length of Service"] || null,
            taxStatus: row["Tax Status"] || null,
            salaryData,
            allowanceData,
            deductionData,
            neutralData,
          });

        } catch (rowError) {
          const errorMessage = rowError instanceof Error ? rowError.message : "Unknown error";
          errorLog.push({
            row: rowNumber,
            error: errorMessage,
            data: {
              name: row["Name"],
              employeeNo: row["Employee No"],
            }
          });
        }
      }

      // ✅ Batch insert with skipDuplicates
      if (batchData.length > 0) {
        const result = await prisma.employee.createMany({
          data: batchData,
          skipDuplicates: true, // Skip if uploadId+employeeNo already exists
        });

        const actualInserted = result.count;
        const skippedInBatch = batchData.length - actualInserted;
        
        processedCount += actualInserted;
        duplicateCount += skippedInBatch;
        
        const batchDuration = Date.now() - batchStartTime;
        console.log(`  ✓ Inserted ${actualInserted} rows, skipped ${skippedInBatch} duplicates in ${batchDuration}ms`);
      }

      const currentProgress = Math.round((batchEnd / rows.length) * 100);
      await prisma.upload.update({
        where: { id: uploadId },
        data: { progress: currentProgress },
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  📊 Progress: ${currentProgress}% | Elapsed: ${elapsed}s\n`);
    }

    const duration = Date.now() - startTime;
    
    console.log(`${'='.repeat(70)}`);
    console.log("✅ PROCESSING SUMMARY");
    console.log(`${'='.repeat(70)}`);
    console.log(`✓ Successfully inserted: ${processedCount} rows`);
    console.log(`⊘ Skipped (empty): ${skippedCount} rows`);
    console.log(`⊘ Skipped (duplicate): ${duplicateCount} rows`);
    console.log(`✗ Failed: ${errorLog.length} rows`);
    console.log(`⏱ Total Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`${'='.repeat(70)}\n`);

    const statusMessage = duplicateCount > 0 
      ? `Completed: ${processedCount} inserted, ${duplicateCount} duplicates skipped`
      : errorLog.length > 0 
      ? `Completed with ${errorLog.length} errors`
      : undefined;

    await prisma.upload.update({
      where: { id: uploadId },
      data: { 
        status: "COMPLETED",
        progress: 100,
        rowCount: processedCount,
        errorMessage: statusMessage
      },
    });

    console.log("✅ UPLOAD PROCESSING COMPLETED\n");

  } catch (error) {
    console.error("\n❌ PROCESSING FAILED");
    console.error("Error:", error);
    
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: "FAILED",
        progress: 0,
        errorMessage: error instanceof Error ? error.message : "Processing failed",
      },
    });
  }
}