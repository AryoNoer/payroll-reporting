// app/api/uploads/components/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/uploads/components/route.ts
// Ganti SELURUH file dengan ini:

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parse } from "papaparse";
import * as XLSX from "xlsx";
import { storageHelpers, STORAGE_BUCKETS } from "@/lib/supabase";

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ROWS_PER_REQUEST = 10000;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { fileUrl, filePath, fileName, fileSize, type, chunkIndex } = body;

    if (!fileUrl || !filePath || !fileName || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (chunkIndex === undefined) {
      return NextResponse.json({ error: "Missing chunkIndex" }, { status: 400 });
    }

    console.log(`[Upload] Processing chunk ${chunkIndex + 1} of ${fileName}`);

    // ✅ Download file
    const { data: fileBlob, error: downloadError } = await storageHelpers.downloadFileAdmin(
      STORAGE_BUCKETS.PAYROLL_COMPONENTS,
      filePath
    );

    if (downloadError || !fileBlob) {
      throw new Error(`Download failed: ${downloadError}`);
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let allRows: any[] = [];

    // ✅ Parse based on file type
    if (fileName.endsWith(".csv")) {
      const content = buffer.toString("utf-8");
      const parseResult = parse(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
      });
      allRows = parseResult.data as any[];
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      allRows = XLSX.utils.sheet_to_json(sheet);
    } else {
      return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
    }

    // ✅ Get chunk rows
    const startIdx = chunkIndex * ROWS_PER_REQUEST;
    const endIdx = startIdx + ROWS_PER_REQUEST;
    const chunkRows = allRows.slice(startIdx, endIdx);

    // ✅ If no rows in this chunk, we're done
    if (chunkRows.length === 0) {
      return NextResponse.json({
        success: true,
        chunkIndex,
        inserted: 0,
        processed: 0,
        message: "No more rows to process",
      });
    }

    // ✅ Process chunk
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

    // ✅ Insert in smaller batches
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

    console.log(`[Upload] Chunk ${chunkIndex + 1}: ${inserted}/${chunkRows.length} rows inserted`);

    return NextResponse.json({
      success: true,
      chunkIndex,
      inserted,
      processed: chunkRows.length,
      hasMore: endIdx < allRows.length,
    });

  } catch (error) {
    console.error("[Upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    await requireAuth();

    const recentCount = await prisma.employeeComponent.count({
      where: {
        uploadedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return NextResponse.json({
      recentUploads: recentCount,
      maxFileSize: MAX_FILE_SIZE / (1024 * 1024) + "MB",
    });

  } catch (error) {
    console.error("[Upload] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch info" },
      { status: 500 }
    );
  }
}