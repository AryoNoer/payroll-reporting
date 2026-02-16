// ============================================
// FILE 1: app/api/uploads/process-storage/route.ts
// API untuk process file yang sudah ada di storage
// ============================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import * as XLSX from "xlsx";
import * as fs from "fs/promises";
import * as path from "path";

const ROWS_PER_CHUNK = 10000;

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

  
    const fullPath = path.join(process.env.UPLOAD_DIR || '/data/uploads', filePath);
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

    // Get chunk
    const startIdx = chunkIndex * ROWS_PER_CHUNK;
    const endIdx = startIdx + ROWS_PER_CHUNK;
    const chunkRows = allRows.slice(startIdx, endIdx);

    if (chunkRows.length === 0) {
      return NextResponse.json({
        success: true,
        chunkIndex,
        inserted: 0,
        processed: 0,
        hasMore: false,
        message: "Processing complete",
      });
    }

    // Process chunk
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

    // Insert in batches
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

    console.log(
      `[Process Storage] Chunk ${chunkIndex + 1}: ${inserted}/${chunkRows.length} inserted`
    );

    return NextResponse.json({
      success: true,
      chunkIndex,
      inserted,
      processed: chunkRows.length,
      hasMore: endIdx < allRows.length,
      totalRows: allRows.length,
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
    
    const uploadDir = process.env.UPLOAD_DIR || '/data/uploads';
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
