
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const period = formData.get("period") as string;

    if (!file || !period) {
      return NextResponse.json(
        { error: "File and period are required" },
        { status: 400 }
      );
    }

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const content = buffer.toString("utf-8");

    // Parse CSV with better handling for duplicate headers
    const { data, errors } = parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string, index: number) => {
        // Remove leading/trailing spaces
        const cleanHeader = header.trim();
        
        // If header is empty, use column index
        if (!cleanHeader) {
          return `Column_${index}`;
        }
        
        return cleanHeader;
      },
      transform: (value: string) => {
        // Clean up values
        return value?.trim() || "";
      },
    });

    if (errors.length > 0) {
      console.error("CSV Parse Errors:", errors);
      return NextResponse.json(
        { 
          error: "Invalid CSV format", 
          details: errors.map(e => e.message).join(", ")
        },
        { status: 400 }
      );
    }

    // Check if data is valid
    if (!data || (data as any[]).length === 0) {
      return NextResponse.json(
        { error: "CSV file is empty or invalid" },
        { status: 400 }
      );
    }

    // Validate CSV structure - check for essential columns
    const requiredColumns = ["Name", "Employee No"];
    const firstRow = (data as any[])[0];
    const headers = Object.keys(firstRow);
    
    const missingColumns = requiredColumns.filter(
      col => !headers.some(h => h.includes(col))
    );

    if (missingColumns.length > 0) {
      return NextResponse.json(
        { 
          error: `Missing required columns: ${missingColumns.join(", ")}`,
          hint: "Please check your CSV file format"
        },
        { status: 400 }
      );
    }

    // Save file
    const uploadDir = join(process.cwd(), "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // Create upload record
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

    // Process data in background
    processUploadData(upload.id, data as any[], headers).catch((error) => {
      console.error("Background processing error:", error);
    });

    return NextResponse.json(upload);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function processUploadData(
  uploadId: string,
  rows: any[],
  headers: string[]
) {
  try {
    console.log(`Processing upload ${uploadId} with ${rows.length} rows...`);

    // Get component mapping
    const components = await prisma.component.findMany({
      where: { isActive: true },
    });

    const componentMap = new Map(components.map(c => [c.name, c]));

    // Process each row
    let processedCount = 0;
    for (const row of rows) {
      try {
        // Skip empty rows
        if (!row.Name && !row["Employee No"]) {
          continue;
        }

        const salaryData: Record<string, number> = {};
        const allowanceData: Record<string, number> = {};
        const deductionData: Record<string, number> = {};
        const neutralData: Record<string, number> = {};

        // Categorize fields
        for (const [key, value] of Object.entries(row)) {
          // Skip non-data columns
          if (!key || key.startsWith("Column_")) continue;

          const component = componentMap.get(key);
          
          if (component) {
            // Parse numeric value
            let numValue = 0;
            if (value && typeof value === 'string') {
              // Remove quotes, commas, and parse
              const cleanValue = value.replace(/['"',]/g, '');
              numValue = parseFloat(cleanValue) || 0;
            } else if (typeof value === 'number') {
              numValue = value;
            }
            
            switch (component.type) {
              case "ALLOWANCE":
                allowanceData[key] = numValue;
                break;
              case "DEDUCTION":
                deductionData[key] = numValue;
                break;
              case "NEUTRAL":
                neutralData[key] = numValue;
                break;
            }
          } else if (key.toLowerCase().includes("salary")) {
            // Handle salary-related fields
            const cleanValue = typeof value === 'string' 
              ? value.replace(/['"',]/g, '') 
              : String(value || '0');
            salaryData[key] = parseFloat(cleanValue) || 0;
          }
        }

        // Parse date fields safely
        const parseDate = (dateStr: string | null | undefined): Date | null => {
          if (!dateStr || dateStr === '') return null;
          try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
          } catch {
            return null;
          }
        };

        // Save employee record
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
      } catch (rowError) {
        console.error(`Error processing row ${processedCount + 1}:`, rowError);
        // Continue with next row instead of failing completely
      }
    }

    console.log(`Successfully processed ${processedCount} out of ${rows.length} rows`);

    // Update upload status
    await prisma.upload.update({
      where: { id: uploadId },
      data: { 
        status: "COMPLETED",
        rowCount: processedCount
      },
    });
  } catch (error) {
    console.error("Processing error:", error);
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Processing failed",
      },
    });
  }
}