// ============================================
// app/api/uploads/process-storage/route.ts
// Process files already on storage  
// ============================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import * as XLSX from "xlsx";
import * as fs from "fs/promises";
import * as path from "path";

const EMPLOYEES_PER_CHUNK = 2000;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { filePath, type, chunkIndex = 0 } = body;

    if (!filePath || !type) {
      return NextResponse.json(
        { error: "filePath and type required" },
        { status: 400 }
      );
    }

    console.log(`[Process Storage] File: ${filePath}, Chunk: ${chunkIndex}`);

    const fullPath = path.join(process.env.UPLOAD_DIR || './uploads', filePath);
    const buffer = await fs.readFile(fullPath);

    // Parse file
    let allRows: any[] = [];

    if (filePath.endsWith(".csv")) {
      const content = buffer.toString("utf-8");
      const parseResult = parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
      });
      allRows = parseResult.data as any[];
    } else if (filePath.endsWith(".xlsx") || filePath.endsWith(".xls")) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      allRows = XLSX.utils.sheet_to_json(sheet);
    } else {
      return NextResponse.json(
        { error: "Unsupported file format" },
        { status: 400 }
      );
    }

    // ✅ Group by employeeNo — merge all komponen into JSON
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
      if (row["Remark"]) entry.data[`${komponen}_remark`] = String(row["Remark"]).trim();
    });

    const groupedEmployees = Array.from(employeeMap.entries()).map(([key, value]) => ({
      employeeNo: key.split('__')[0],
      bulanReport: value.bulanReport,
      data: value.data,
    }));

    // Get chunk
    const startIdx = chunkIndex * EMPLOYEES_PER_CHUNK;
    const endIdx = startIdx + EMPLOYEES_PER_CHUNK;
    const chunkEmployees = groupedEmployees.slice(startIdx, endIdx);

    if (chunkEmployees.length === 0) {
      return NextResponse.json({
        success: true,
        chunkIndex,
        inserted: 0,
        processed: 0,
        hasMore: false,
        message: "Processing complete",
      });
    }

    // ✅ Upsert grouped employees
    let inserted = 0;
    const batchSize = 500;

    for (let i = 0; i < chunkEmployees.length; i += batchSize) {
      const batch = chunkEmployees.slice(i, i + batchSize);
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
              update: { data: emp.data, uploadedBy: user.id },
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

    console.log(
      `[Process Storage] Chunk ${chunkIndex + 1}: ${inserted}/${chunkEmployees.length} employees upserted`
    );

    return NextResponse.json({
      success: true,
      chunkIndex,
      inserted,
      processed: chunkEmployees.length,
      hasMore: endIdx < groupedEmployees.length,
      totalEmployees: groupedEmployees.length,
    });
  } catch (error) {
    console.error("[Process Storage] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    await requireAuth();

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const files = await fs.readdir(uploadDir);

    return NextResponse.json({
      success: true,
      files: files.filter((f: string) => f.endsWith('.csv') || f.endsWith('.xlsx') || f.endsWith('.xls'))
    });
  } catch (error) {
    console.error("[List Storage] Error:", error);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}
