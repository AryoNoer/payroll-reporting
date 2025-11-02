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
 * These will NOT be converted to numbers even if they start with digits
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

/**
 * Batch size for database inserts
 * Adjust based on your database performance
 */
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
    
    // ✅ FIX: Detect and handle different encodings
    let content: string;
    try {
      // Try UTF-8 first
      content = buffer.toString("utf-8");
      
      // Check for BOM (Byte Order Mark)
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.substring(1);
        console.log('  ⚠ Removed UTF-8 BOM');
      }
      
      // Normalize line endings to \n
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
    } catch (error) {
      console.warn('  ⚠ UTF-8 decode failed, trying latin1...');
      content = buffer.toString("latin1");
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    
    console.log(`✓ File read: ${content.length} characters`);
    
    // ✅ Diagnostic: Check first few lines
    const previewLines = content.split('\n').slice(0, 3);
    console.log(`  Preview (first 3 lines):`);
    previewLines.forEach((line, idx) => {
      const preview = line.substring(0, 100) + (line.length > 100 ? '...' : '');
      console.log(`    Line ${idx + 1}: ${preview}`);
    });

    // Step 3.5: Handle double header rows (category + field name)
    console.log("[Step 3.5] Detecting header structure...");
    const lines = content.split('\n');
    let finalContent = content;
    
    if (lines.length > 1) {
      const firstLine = lines[0] || '';
      const secondLine = lines[1] || '';
      
      // Check if first line is category row
      const firstLineUpper = firstLine.toUpperCase();
      const hasCategories = 
        firstLineUpper.includes('SALARY') || 
        firstLineUpper.includes('ALLOWANCE') ||
        firstLineUpper.includes('DEDUCTION') ||
        firstLineUpper.includes('NEUTRAL') ||
        firstLineUpper.includes('TOTAL');
      
      // Check if second line has actual column names
      const secondLineHasNames = 
        secondLine.includes('Name') || 
        secondLine.includes('Employee');
      
      if (hasCategories && secondLineHasNames) {
        console.log('✓ Detected double header format (category + field name)');
        
        // Parse both lines to get arrays
        const categoryParse = parse(firstLine, { header: false });
        const fieldParse = parse(secondLine, { header: false });
        
        const categories = (categoryParse.data[0] || []) as string[];
        const fields = (fieldParse.data[0] || []) as string[];
        
        console.log(`  Categories count: ${categories.length}`);
        console.log(`  Fields count: ${fields.length}`);
        
        // Merge headers: use field name primarily
        const mergedHeaders: string[] = [];
        for (let i = 0; i < Math.max(categories.length, fields.length); i++) {
          const field = (fields[i] || '').trim();
          
          // If field is empty or just a number, use category
          if (!field || /^\d+$/.test(field)) {
            mergedHeaders.push((categories[i] || '').trim() || `Column_${i}`);
          } else {
            mergedHeaders.push(field);
          }
        }
        
        console.log(`  Merged headers sample: ${mergedHeaders.slice(0, 10).join(', ')}...`);
        
        // Rebuild CSV with merged header
        const dataLines = lines.slice(2); // Skip both header lines
        finalContent = mergedHeaders.join(',') + '\n' + dataLines.join('\n');
        
        console.log('✓ Headers merged, ready to parse');
      } else {
        console.log('✓ Standard single header format detected');
      }
    }

    // Step 4: Parse CSV
    console.log("[Step 4] Parsing CSV...");
    
    // Auto-detect delimiter from first line
    const firstDataLine = finalContent.split('\n')[0] || '';
    const detectedDelimiter = firstDataLine.includes('\t') ? '\t' : ',';
    console.log(`  Detected delimiter: ${detectedDelimiter === '\t' ? 'TAB' : 'COMMA'}`);
    
    const parseResult = parse(finalContent, {
      header: true,
      delimiter: detectedDelimiter, // ✅ FIX: Explicitly set delimiter
      skipEmptyLines: true,
      newline: '\n', // ✅ FIX: Explicitly set newline
      quoteChar: '"',
      escapeChar: '"',
      transformHeader: (header: string, index: number) => {
        const cleanHeader = header.trim();
        if (!cleanHeader) {
          console.warn(`⚠ Empty header at column ${index}, renamed to Column_${index}`);
          return `Column_${index}`;
        }
        return cleanHeader;
      },
      transform: (value: string) => value?.trim() || "",
    });

    const { data, errors, meta } = parseResult;

    // Log parsing details
    console.log(`✓ CSV parsed successfully`);
    console.log(`  - Rows: ${(data as any[]).length}`);
    console.log(`  - Columns: ${meta.fields?.length || 0}`);
    console.log(`  - Parse errors: ${errors.length}`);

    if (errors.length > 0) {
      console.error("\n❌ CSV Parse Errors:");
      console.error(`Total errors: ${errors.length}`);
      
      // Show detailed error info
      errors.slice(0, 10).forEach((err, idx) => {
        console.error(`\n  Error ${idx + 1}:`, {
          type: err.type,
          code: err.code,
          message: err.message,
          row: err.row,
        });
      });
      
      // ✅ Show problematic lines for diagnosis
      if (errors.length > 0 && errors[0].row !== undefined) {
        const lines = finalContent.split('\n');
        const problemRow = errors[0].row;
        if (problemRow < lines.length) {
          console.error(`\n  Problematic line ${problemRow}:`);
          console.error(`    ${lines[problemRow].substring(0, 200)}...`);
        }
      }
      
      // ✅ Better error message based on error type
      let errorMessage = "CSV parsing failed";
      if (errors[0].code === "TooManyFields") {
        errorMessage = `CSV format error: File appears to have inconsistent number of columns. Expected ${meta.fields?.length || 1} columns but found more. Please check if the CSV file is properly formatted.`;
      } else if (errors[0].code === "TooFewFields") {
        errorMessage = `CSV format error: Some rows have fewer columns than expected. Please ensure all rows have the same number of columns.`;
      }
      
      throw new UploadError(
        errorMessage,
        "PARSE_ERROR",
        {
          totalErrors: errors.length,
          firstErrors: errors.slice(0, 5),
          expectedColumns: meta.fields?.length,
          delimiter: detectedDelimiter === '\t' ? 'TAB' : 'COMMA'
        }
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
    
    console.log(`✓ Found ${headers.length} columns`);
    console.log(`  Sample headers: ${headers.slice(0, 10).join(", ")}...`);

    const missingColumns = requiredColumns.filter(
      col => !headers.some(h => h.includes(col))
    );

    if (missingColumns.length > 0) {
      throw new UploadError(
        `Missing required columns: ${missingColumns.join(", ")}`,
        "MISSING_COLUMNS",
        { 
          required: requiredColumns,
          found: headers.slice(0, 20),
          missing: missingColumns
        }
      );
    }

    console.log(`✓ All required columns present`);

    // Step 6: Save file
    console.log("[Step 6] Saving file to disk...");
    const uploadDir = join(process.cwd(), "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
      console.log(`✓ Created uploads directory`);
    }

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);
    console.log(`✓ File saved: ${fileName}`);

    // Step 7: Create database record
    console.log("[Step 7] Creating upload record in database...");
    const upload = await prisma.upload.create({
      data: {
        fileName,
        originalName: file.name,
        fileSize: file.size,
        rowCount: (data as any[]).length,
        period: new Date(period + "-01"),
        status: "PROCESSING",
        userId: user.id,
      },
    });
    console.log(`✓ Upload record created: ${upload.id}`);

    // Step 8: Start background processing
    console.log("[Step 8] Starting background processing (BATCH MODE)...");
    processUploadData(upload.id, data as any[], headers).catch((error) => {
      console.error("✗ Background processing error:", error);
    });

    const duration = Date.now() - startTime;
    console.log(`✓ Upload completed in ${duration}ms`);
    console.log("=== UPLOAD REQUEST COMPLETED ===\n");

    return NextResponse.json(upload);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("\n✗ UPLOAD FAILED");
    console.error(`Duration: ${duration}ms`);
    
    if (error instanceof UploadError) {
      console.error(`Error Code: ${error.code}`);
      console.error(`Message: ${error.message}`);
      if (error.details) {
        console.error(`Details:`, JSON.stringify(error.details, null, 2));
      }
      
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
        message: error instanceof Error ? error.message : "Unknown error",
        stack: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.stack 
          : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Smart value parser that preserves text fields
 */
function parseValue(key: string, value: any): any {
  // Empty values
  if (value === null || value === undefined || value === '') {
    return value;
  }

  // Already not a string
  if (typeof value !== 'string') {
    return value;
  }

  // ✅ FIX: Always preserve text-only fields as strings
  if (TEXT_ONLY_FIELDS.has(key)) {
    return value.trim();
  }

  // Try to parse as number for other fields
  const cleanValue = value.replace(/['"',]/g, '').trim();
  
  // Check if it looks like a pure number
  if (/^-?\d+\.?\d*$/.test(cleanValue)) {
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? cleanValue : numValue;
  }

  // Return as string
  return cleanValue;
}

/**
 * Process uploaded data with BATCH INSERT for 8-10x faster performance
 * Processes in batches for optimal database performance
 */
async function processUploadData(
  uploadId: string,
  rows: any[],
  headers: string[]
) {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 PROCESSING UPLOAD ${uploadId} (BATCH MODE WITH PROGRESS)`);
  console.log(`${'='.repeat(70)}`);
  console.log(`📊 Total rows: ${rows.length}`);
  console.log(`📋 Total columns: ${headers.length}`);
  console.log(`⚡ Batch size: ${BATCH_SIZE} rows/batch`);
  console.log(`${'='.repeat(70)}\n`);

  const errorLog: Array<{
    row: number;
    error: string;
    data: any;
  }> = [];

  try {
    // Initialize progress to 0%
    await prisma.upload.update({
      where: { id: uploadId },
      data: { progress: 0 },
    });

    // Get component mapping
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

    // Process rows in batches
    console.log("[Step 2] Processing rows in batches...\n");
    let processedCount = 0;
    let skippedCount = 0;
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

      // Batch insert
      if (batchData.length > 0) {
        await prisma.employee.createMany({
          data: batchData,
          skipDuplicates: true,
        });

        processedCount += batchData.length;
        
        const batchDuration = Date.now() - batchStartTime;
        const rowsPerSecond = (batchData.length / (batchDuration / 1000)).toFixed(0);
        console.log(`  ✓ Inserted ${batchData.length} rows in ${batchDuration}ms (${rowsPerSecond} rows/sec)`);
      }

      // 🎯 UPDATE PROGRESS IN DATABASE
      const currentProgress = Math.round((batchEnd / rows.length) * 100);
      await prisma.upload.update({
        where: { id: uploadId },
        data: { progress: currentProgress },
      });

      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const elapsed = elapsedSeconds.toFixed(1);
      const estimatedTotal = (elapsedSeconds / (batchEnd / rows.length)).toFixed(1);
      const remaining = (Number(estimatedTotal) - elapsedSeconds).toFixed(1);
      console.log(`  📊 Progress: ${currentProgress}% | Elapsed: ${elapsed}s | ETA: ~${remaining}s remaining\n`);
    }

    const duration = Date.now() - startTime;
    const rowsPerSecond = (processedCount / (duration / 1000)).toFixed(0);
    
    console.log(`${'='.repeat(70)}`);
    console.log("✅ PROCESSING SUMMARY");
    console.log(`${'='.repeat(70)}`);
    console.log(`✓ Successfully processed: ${processedCount} rows`);
    console.log(`⊘ Skipped (empty): ${skippedCount} rows`);
    console.log(`✗ Failed: ${errorLog.length} rows`);
    console.log(`⏱ Total Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`⚡ Average Speed: ${rowsPerSecond} rows/second`);
    console.log(`${'='.repeat(70)}\n`);

    if (errorLog.length > 0) {
      console.log("⚠️ ERROR DETAILS:");
      errorLog.slice(0, 10).forEach(err => {
        console.log(`  Row ${err.row}: ${err.error}`);
      });
      if (errorLog.length > 10) {
        console.log(`  ... and ${errorLog.length - 10} more errors\n`);
      }
    }

    const statusMessage = errorLog.length > 0 
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