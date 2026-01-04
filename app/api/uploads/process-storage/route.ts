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
import { storageHelpers, STORAGE_BUCKETS } from "@/lib/supabase";

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

    // Download file dari storage
    const { data: fileBlob, error: downloadError } = 
      await storageHelpers.downloadFileAdmin(
        STORAGE_BUCKETS.PAYROLL_COMPONENTS,
        filePath
      );

    if (downloadError || !fileBlob) {
      throw new Error(`Download failed: ${downloadError}`);
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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

// GET: List files in storage yang belum diproses
export async function GET(_request: NextRequest) {
  try {
    await requireAuth();

    const { createBrowserClient } = await import("@/lib/supabase");
    const supabase = createBrowserClient();

    // List files di HO folder
    const { data: hoFiles } = await supabase.storage
      .from(STORAGE_BUCKETS.PAYROLL_COMPONENTS)
      .list("HO");

    // List files di OS folder
    const { data: osFiles } = await supabase.storage
      .from(STORAGE_BUCKETS.PAYROLL_COMPONENTS)
      .list("OS");

    return NextResponse.json({
      success: true,
      files: {
        HO: hoFiles || [],
        OS: osFiles || [],
      },
    });
  } catch (error) {
    console.error("[List Storage] Error:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}
