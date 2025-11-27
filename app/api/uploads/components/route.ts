// app/api/uploads/components/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // ✅ NEW: Get type from form

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }


    // ✅ NEW: Validate type
    if (!type || (type !== "HO" && type !== "OS")) {
      return NextResponse.json({ 
        error: "Type is required and must be either 'HO' or 'OS'" 
      }, { status: 400 });
    }

    console.log(`[Upload Components] File: ${file.name}, Type: ${type}`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let rows: any[] = [];

    // Parse based on file type
    if (file.name.endsWith(".csv")) {
      const content = buffer.toString("utf-8");
      const parseResult = parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
      });
      rows = parseResult.data as any[];
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet);
    } else {
      return NextResponse.json(
        { error: "Unsupported file format" },
        { status: 400 }
      );
    }

    console.log(`[Upload Components] Parsed ${rows.length} rows`);

    // Validate required columns
    const requiredColumns = ["Employee No", "Komponen", "Nilai"];
    const firstRow = rows[0];
    if (!firstRow) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    const headers = Object.keys(firstRow);
    const missingColumns = requiredColumns.filter(
      col => !headers.some(h => h.includes(col))
    );

    if (missingColumns.length > 0) {
      return NextResponse.json(
        { 
          error: `Missing required columns: ${missingColumns.join(", ")}`,
          details: { missing: missingColumns }
        },
        { status: 400 }
      );
    }

    // Transform rows to database format
    const componentsData = rows.map((row) => ({
    employeeNo: String(row["Employee No"] || "").trim(),
    komponen: String(row["Komponen"] || "").trim(),
    nilai: String(row["Nilai"] || "").trim(),
    remark: row["Remark"] ? String(row["Remark"]).trim() : null,
    remark2: row["Remark2"] ? String(row["Remark2"]).trim() : null,
    remark3: row["Remark3"] ? String(row["Remark3"]).trim() : null,
    bulanReport: String(row["Bulan Report"] || "").trim(), // ✅ CHANGED: Always from CSV, no fallback
    type: type,
    uploadedBy: user.id,
  }));

    console.log(`[Upload Components] Inserting ${componentsData.length} records with type: ${type}`);

    // ✅ ADD: Validate Bulan Report exists in data
const invalidRows = componentsData.filter(row => !row.bulanReport);
if (invalidRows.length > 0) {
  return NextResponse.json({
    error: `Missing "Bulan Report" in ${invalidRows.length} rows. Please ensure all rows have this field.`,
    details: { missingCount: invalidRows.length }
  }, { status: 400 });
}

console.log(`[Upload Components] Inserting ${componentsData.length} records with type: ${type}`);



    // Batch insert
    const result = await prisma.employeeComponent.createMany({
      data: componentsData,
      skipDuplicates: true,
    });

    console.log(`[Upload Components] Successfully inserted ${result.count} records`);

    return NextResponse.json({
      success: true,
      count: result.count,
      type: type, // Return type in response
      message: `Successfully uploaded ${result.count} component records (Type: ${type})`,
    });

  } catch (error) {
    console.error("[Upload Components] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to upload components",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}