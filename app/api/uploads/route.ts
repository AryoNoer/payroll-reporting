
/* eslint-disable @typescript-eslint/no-explicit-any */

// app/api/uploads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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
    const content = buffer.toString("utf-8");
    console.log(`✓ File read: ${content.length} characters`);

    // Step 3.5: Handle double header rows (category + field name)
    console.log("[Step 3.5] Detecting header structure...");
    const lines = content.split('\n');
    let finalContent = content;
    const categoryHeaders: string[] = [];
    
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
        
        // Merge headers: use field name primarily, add category if meaningful
        const mergedHeaders: string[] = [];
        for (let i = 0; i < Math.max(categories.length, fields.length); i++) {
          const category = (categories[i] || '').trim();
          const field = (fields[i] || '').trim();
          
          // If field is empty or just a number, use category
          if (!field || /^\d+$/.test(field)) {
            mergedHeaders.push(category || `Column_${i}`);
          }
          // If category is meaningful and different from field, append it
          else if (category && 
                   category !== field && 
                   !field.includes(category) &&
                   category.length > 2 &&
                   !/^[,\s]*$/.test(category)) {
            // Don't append if category is generic
            if (!['SALARY', 'Allowance', 'Deduction', 'Neutral'].includes(category)) {
              mergedHeaders.push(field);
            } else {
              mergedHeaders.push(field);
            }
          }
          // Otherwise just use field name
          else {
            mergedHeaders.push(field || `Column_${i}`);
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
    const parseResult = parse(finalContent, {
      header: true,
      skipEmptyLines: true,
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
      console.error("CSV Parse Errors:", errors);
      errors.forEach((err, idx) => {
        console.error(`  Error ${idx + 1}:`, {
          type: err.type,
          code: err.code,
          message: err.message,
          row: err.row,
        });
      });
      throw new UploadError(
        "CSV parsing failed",
        "PARSE_ERROR",
        errors.slice(0, 5) // First 5 errors
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
    console.log("[Step 8] Starting background processing...");
    processUploadData(upload.id, data as any[], headers).catch((error) => {
      console.error("❌ Background processing error:", error);
    });

    const duration = Date.now() - startTime;
    console.log(`✓ Upload completed in ${duration}ms`);
    console.log("=== UPLOAD REQUEST COMPLETED ===\n");

    return NextResponse.json(upload);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("\n❌ UPLOAD FAILED");
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

// Update processUploadData function in app/api/uploads/route.ts

// Update bagian processUploadData di app/api/uploads/route.ts

async function processUploadData(
  uploadId: string,
  rows: any[],
  headers: string[]
) {
  const startTime = Date.now();
  console.log(`\n=== PROCESSING UPLOAD ${uploadId} ===`);
  console.log(`Total rows to process: ${rows.length}`);
  console.log(`Total columns: ${headers.length}`);

  const errorLog: Array<{
    row: number;
    error: string;
    data: any;
  }> = [];

  try {
    // Get component mapping
    console.log("[Step 1] Loading component mappings...");
    const components = await prisma.component.findMany({
      where: { isActive: true },
    });
    console.log(`✓ Loaded ${components.length} components`);

    const componentMap = new Map(components.map(c => [c.name, c]));

    // Metadata fields yang sudah ada dedicated column di database
    const dedicatedFields = new Set([
      'No', 'Name', 'Employee No', 'Gender', 'No KTP', 'Gov. Tax File No.',
      'Position', 'Directorate', 'Org Unit', 'Grade', 'Employment Status',
      'Join Date', 'Terminate Date', 'Length of Service', 'Tax Status'
    ]);

    // HANYA SKIP row number, semua field lain akan disimpan
    const skipFields = new Set(['No']);

    // Process each row
    console.log("[Step 2] Processing rows...");
    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        // Skip empty rows
        if (!row.Name && !row["Employee No"]) {
          console.log(`⊘ Row ${rowNumber}: Skipped (empty)`);
          skippedCount++;
          continue;
        }

        const salaryData: Record<string, any> = {};
        const allowanceData: Record<string, any> = {};
        const deductionData: Record<string, any> = {};
        const neutralData: Record<string, any> = {};

        // Categorize ALL fields
        let fieldCount = 0;
        
        for (const [key, value] of Object.entries(row)) {
          // Skip ONLY row number
          if (skipFields.has(key)) continue;
          if (!key || key.startsWith("Column_")) continue;

          // Parse value
          let parsedValue: any = value;
          if (value && typeof value === 'string') {
            const cleanValue = value.replace(/['"',]/g, '');
            const numValue = parseFloat(cleanValue);
            parsedValue = isNaN(numValue) ? cleanValue : numValue;
          }

          // PENTING: Simpan metadata fields ke neutralData JUGA
          // Ini membuat semua 31 field metadata bisa dipilih di report
          if (dedicatedFields.has(key)) {
            neutralData[key] = parsedValue;
            fieldCount++;
            continue; // Sudah disimpan, lanjut ke field berikutnya
          }

          // Categorize by component type
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
          } 
          // If not in component map, categorize by keyword and field name
          else {
            const keyLower = key.toLowerCase();
            
            // SALARY fields (field 32-35)
            if (
              key === "Basic Salary" ||
              key === "Basic Salary Tambahan" ||
              key === "Rapel Salary" ||
              key === "Additional Salary" ||
              keyLower.includes("salary") || 
              keyLower.includes("gaji")
            ) {
              salaryData[key] = parsedValue;
            }
            // ALLOWANCE fields (field 36-86)
            else if (
              key === "Tunjangan Jabatan" ||
              key === "Tunjangan Jabatan PJS" ||
              key === "Tunjangan Jabatan Gross" ||
              key === "Uang Makan" ||
              key === "Uang Transport" ||
              key === "Tunjangan Transport Commercial" ||
              key === "Lemburan" ||
              key === "Additional Lemburan" ||
              key === "Insentif" ||
              key === "Additional Insentif" ||
              key === "Additional Uang Pisah" ||
              key === "Sisa Cuti Dibayarkan" ||
              key === "Additional Reward" ||
              key === "Additional Tunjangan Relokasi" ||
              key === "Additional Refund Loan" ||
              key === "Target Paket" ||
              key === "Insentif Per Paket" ||
              key === "Tunjangan Operasional" ||
              key.startsWith("BPJS") && key.includes("Pemberi Kerja") ||
              key === "Insentif Mitra" ||
              key === "Additional Insentif Mitra" ||
              key === "Target Paket OS" ||
              key === "Bonus Per Paket OS" ||
              key === "Insentif OS" ||
              key === "Insentif Mitra Sorter" ||
              key === "Additional Insentif Sorter Mitra" ||
              key === "Claim Rawat Jalan" ||
              key === "Claim Frame" ||
              key === "Santunan Maternity Normal" ||
              key === "Santunan Maternity Caesar" ||
              key === "Target Paket Mitra" ||
              key === "Insentif Per Paket Mitra" ||
              key === "Rapel Bonus Paket Mitra" ||
              key === "Rapel Insentif Mitra" ||
              key === "Claim Rawat Inap" ||
              key === "Additional Bonus KPI" ||
              key === "Additional Target Paket" ||
              key === "Additional Target Paket Mitra" ||
              key === "Tunjangan Pph 21 OS" ||
              key === "Additional Insentif Mitra Lain" ||
              key === "Additional Komisi Karyawan" ||
              key === "Insentif Pembawaan Mitra 10 Kg" ||
              keyLower.includes("tunjangan") || 
              keyLower.includes("allowance") ||
              keyLower.includes("insentif") ||
              keyLower.includes("bonus") ||
              keyLower.includes("uang") ||
              keyLower.includes("claim") ||
              keyLower.includes("santunan") ||
              keyLower.includes("rapel") ||
              keyLower.includes("reward") ||
              keyLower.includes("lemburan")
            ) {
              allowanceData[key] = parsedValue;
            }
            // DEDUCTION fields (field 91-116)
            else if (
              key === "Tax Allowance" ||
              key === "Tax Borne" ||
              key === "Tax Penalty Borne" ||
              key.startsWith("BPJS") && (key.includes("Gross") || key.includes("Kemitraan")) ||
              key === "BPJS JHT" ||
              key === "BPJS Kesehatan" ||
              key === "BPJS Pensiun" ||
              key === "Pot. Kasbon" ||
              key === "Potongan Hutang Cuti" ||
              key === "Pot. Lain" ||
              key === "Pot. Barang Hilang" ||
              key === "Pot. Own Risk" ||
              key === "Pot. Audit" ||
              key === "Potongan Pph 21 OS" ||
              key === "Total Deduction" ||
              key === "Tax" ||
              key === "Tax Penalty" ||
              keyLower.includes("potongan") ||
              keyLower.includes("pot.") ||
              keyLower.includes("deduction") ||
              keyLower.includes("potbrg") ||
              keyLower.includes("potlain") ||
              keyLower.includes("potownrisk") ||
              keyLower.includes("tax") && !keyLower.includes("tax status") && !keyLower.includes("tax location")
            ) {
              deductionData[key] = parsedValue;
            }
            // NEUTRAL / Metadata fields + totals (field 87-90, 117-178)
            else {
              neutralData[key] = parsedValue;
            }
          }
          
          fieldCount++;
        }

        // Parse dates safely
        const parseDate = (dateStr: string | null | undefined): Date | null => {
          if (!dateStr || dateStr === '') return null;
          try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
          } catch {
            return null;
          }
        };

        // Save employee record with ALL data
        await prisma.employee.create({
          data: {
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
          },
        });

        processedCount++;
        
        if (processedCount === 1) {
          console.log(`  First row field distribution:`);
          console.log(`    - Salary fields: ${Object.keys(salaryData).length}`);
          console.log(`    - Allowance fields: ${Object.keys(allowanceData).length}`);
          console.log(`    - Deduction fields: ${Object.keys(deductionData).length}`);
          console.log(`    - Neutral fields: ${Object.keys(neutralData).length}`);
          console.log(`    - Total fields in JSON: ${fieldCount}`);
          console.log(`    - Total should be: ~177 fields (178 - 1 row number)`);
        }
        
        if (processedCount % 10 === 0) {
          console.log(`  Progress: ${processedCount}/${rows.length} rows`);
        }

      } catch (rowError) {
        const errorMessage = rowError instanceof Error ? rowError.message : "Unknown error";
        console.error(`✗ Row ${rowNumber} failed:`, errorMessage);
        
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

    const duration = Date.now() - startTime;
    console.log("\n=== PROCESSING SUMMARY ===");
    console.log(`✓ Successfully processed: ${processedCount} rows`);
    console.log(`⊘ Skipped (empty): ${skippedCount} rows`);
    console.log(`✗ Failed: ${errorLog.length} rows`);
    console.log(`⏱ Duration: ${(duration / 1000).toFixed(2)}s`);

    if (errorLog.length > 0) {
      console.log("\n=== ERROR DETAILS ===");
      errorLog.slice(0, 10).forEach(err => {
        console.log(`Row ${err.row}: ${err.error}`);
      });
      if (errorLog.length > 10) {
        console.log(`... and ${errorLog.length - 10} more errors`);
      }
    }

    // Update upload status
    const statusMessage = errorLog.length > 0 
      ? `Completed with ${errorLog.length} errors`
      : undefined;

    await prisma.upload.update({
      where: { id: uploadId },
      data: { 
        status: "COMPLETED",
        rowCount: processedCount,
        errorMessage: statusMessage
      },
    });

    console.log("=== PROCESSING COMPLETED ===\n");

  } catch (error) {
    console.error("\n✗ PROCESSING FAILED");
    console.error("Error:", error);
    
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Processing failed",
      },
    });
  }
}