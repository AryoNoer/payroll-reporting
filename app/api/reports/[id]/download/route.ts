/* eslint-disable @typescript-eslint/no-explicit-any */

// app/api/reports/[id]/download/route.ts
// ✅ Uses ExcelJS streaming writer to avoid OOM on large datasets
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { categorizeFields } from "@/lib/field-categories";
import { applyCalculationsAndDerivations } from "@/lib/field-calculations";
import { OUTPUT_FIELDS } from "@/lib/output-fields";
import { HEADCOUNT_FIELDS } from "@/lib/headcount-fields";
import { aggregateCostCenterData } from "@/lib/cost-center-aggregation";
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

// Configure route
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const DB_BATCH_SIZE = 2000;

/**
 * Text fields that must be stored as strings (prevent Excel number truncation)
 */
const TEXT_FIELDS = new Set([
  'Jobstatus Code', 'No KTP', 'Gov. Tax File No.', 'Employee No',
  'Cost Center Code', 'Work Location Code', 'Tax Location Code',
  'Company Bank Account', 'Bank Account',
  'Insurance No BPJSKT', 'Insurance No BPJSKES',
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const user = await requireAuth();
    const { id: reportId } = await params;

    console.log('\n' + '='.repeat(60));
    console.log('📊 GENERATING REPORT (ExcelJS Streaming)');
    console.log('='.repeat(60));

    // Get report
    const report = await prisma.report.findFirst({
      where: { id: reportId, userId: user.id },
      include: { upload: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Get employee count
    const totalCount = await prisma.employee.count({
      where: { uploadId: report.uploadId }
    });

    console.log(`✓ Report: ${report.name} (${report.reportType})`);
    console.log(`✓ Upload: ${report.upload.originalName}, ${totalCount} employees`);

    // ✅ Handle Cost Center Report — smaller dataset, use in-memory approach
    if (report.reportType === "COST_CENTER") {
      return await generateCostCenterResponse(report, totalCount, startTime);
    }

    // Determine fields based on report type
    let fieldNames: string[];
    let sheetName: string;
    let suffix = '';

    if (report.reportType === "THR_CABANG") {
      const { THR_CABANG_FIELDS } = await import("@/lib/thr-cabang-fields");
      fieldNames = [...THR_CABANG_FIELDS];
      sheetName = 'THR Cabang';
      suffix = '_THR_Cabang';
    } else if (report.reportType === "HEADCOUNT") {
      fieldNames = [...HEADCOUNT_FIELDS];
      sheetName = 'Headcount';
    } else {
      fieldNames = [...OUTPUT_FIELDS];
      sheetName = 'Report';
    }

    console.log(`✅ Using ${fieldNames.length} fields for ${report.reportType}`);

    // ✅ Create PassThrough stream and start response immediately
    const passThrough = new PassThrough();
    const sanitizedName = report.name.replace(/[^a-zA-Z0-9-_\s]/g, '_');

    // Start Excel generation in background (non-blocking)
    streamExcelGeneration(passThrough, report, fieldNames, sheetName, totalCount, startTime)
      .catch(err => {
        console.error('❌ Excel streaming error:', err);
        if (!passThrough.destroyed) {
          passThrough.destroy(err);
        }
      });

    // Convert Node PassThrough to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        passThrough.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        passThrough.on('end', () => {
          controller.close();
        });
        passThrough.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        passThrough.destroy();
      }
    });

    // Return streaming response immediately — keeps Railway proxy alive
    return new Response(webStream, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sanitizedName}${suffix}.xlsx"`,
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ DOWNLOAD ERROR after ${totalTime}s:`, error);

    let errorMessage = "Failed to download report";
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        errorMessage = "Report generation timed out.";
      } else if (error.message.includes('memory')) {
        errorMessage = "Out of memory. Try a smaller dataset.";
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage, executionTime: `${totalTime}s` },
      { status: 500 }
    );
  }
}

/**
 * Stream Excel generation using ExcelJS WorkbookWriter.
 * Rows are committed immediately after creation, freeing memory.
 * Employees are fetched from DB in batches, not all at once.
 */
async function streamExcelGeneration(
  stream: PassThrough,
  report: any,
  fieldNames: string[],
  sheetName: string,
  totalCount: number,
  startTime: number
) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream,
    useStyles: true,
  });

  const sheet = workbook.addWorksheet(sheetName);

  // ✅ Set column definitions with widths
  sheet.columns = fieldNames.map(name => ({
    header: name,
    key: name,
    width: Math.min(Math.max(name.length + 2, 12), 50),
  }));

  // ✅ Write header rows (5 rows: empty, L1, L2, L3, field names)
  const fieldCategories = categorizeFields(fieldNames);

  // Row 1: Empty
  sheet.addRow(new Array(fieldNames.length).fill('')).commit();

  // Row 2: Level 1 categories
  sheet.addRow(fieldNames.map(n => fieldCategories.get(n)?.level1 || 'Netral')).commit();

  // Row 3: Level 2 categories
  sheet.addRow(fieldNames.map(n => fieldCategories.get(n)?.level2 || 'Netral')).commit();

  // Row 4: Level 3 categories
  sheet.addRow(fieldNames.map(n => fieldCategories.get(n)?.level3 || 'Netral')).commit();

  // Row 5: Field names
  sheet.addRow(fieldNames).commit();

  console.log(`✓ Headers written (5 rows)`);

  // ✅ Fetch and process employees in batches from DB
  const batchCount = Math.ceil(totalCount / DB_BATCH_SIZE);
  let totalProcessed = 0;
  const isCabang = report.reportType === "CABANG";
  const isTHR = report.reportType === "THR_CABANG";

  for (let batchIdx = 0; batchIdx < batchCount; batchIdx++) {
    // Fetch one batch from DB
    const employees = await prisma.employee.findMany({
      where: { uploadId: report.uploadId },
      orderBy: { employeeNo: 'asc' },
      skip: batchIdx * DB_BATCH_SIZE,
      take: DB_BATCH_SIZE,
    });

    // Filter for Cabang if needed
    let batch = employees;
    if (isCabang) {
      batch = employees.filter(emp => {
        const neutralData = (emp.neutralData as any) || {};
        const salaryData = (emp.salaryData as any) || {};
        const cc = String(neutralData['Cost Center'] || salaryData['Cost Center'] || '').toLowerCase();
        return !cc.includes('kantor pusat');
      });
    }

    // Process each employee in this batch
    for (const emp of batch) {
      totalProcessed++;

      // Build raw row from employee data
      const rawRow: any = {
        'No': totalProcessed,
        'Name': emp.name,
        'Employee No': emp.employeeNo,
        'Position': emp.position,
        'Department': emp.orgUnit,
        'Employment Status': emp.employmentStatus,
        'Join Date': emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('id-ID') : '',
        'Terminate Date': emp.terminateDate ? new Date(emp.terminateDate).toLocaleDateString('id-ID') : '',
      };

      // Add extra fields for non-THR reports
      if (!isTHR) {
        rawRow['Gender'] = emp.gender;
        rawRow['No KTP'] = emp.noKTP;
        rawRow['Gov. Tax File No.'] = emp.taxFileNo;
        rawRow['Directorate'] = emp.directorate;
        rawRow['Org Unit'] = emp.orgUnit;
        rawRow['Grade'] = emp.grade;
        rawRow['Length Of Service'] = emp.lengthOfService;
        rawRow['Tax Status'] = emp.taxStatus;
      }

      // Merge JSON data blobs
      const salaryData = (emp.salaryData as any) || {};
      const allowanceData = (emp.allowanceData as any) || {};
      const deductionData = (emp.deductionData as any) || {};
      const neutralData = (emp.neutralData as any) || {};
      Object.assign(rawRow, salaryData, allowanceData, deductionData, neutralData);

      // Apply calculations
      const processedRow = applyCalculationsAndDerivations(rawRow);

      // Build final row in field order
      const rowValues = fieldNames.map(field => {
        const val = processedRow[field] ?? '';
        if (TEXT_FIELDS.has(field) && val !== '') {
          return String(val);
        }
        return val;
      });

      // ✅ Add row and commit immediately — frees memory
      sheet.addRow(rowValues).commit();
    }

    const progress = Math.round(((batchIdx + 1) / batchCount) * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  Batch ${batchIdx + 1}/${batchCount}: ${batch.length} rows (${progress}%) - ${elapsed}s`);

    // ✅ Yield to event loop and let GC clean up the batch
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // ✅ Finalize workbook — flushes remaining data and closes the stream
  await workbook.commit();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ STREAMING COMPLETE: ${totalProcessed} rows in ${totalTime}s`);
}

/**
 * Cost Center Report — aggregated data, small enough for in-memory generation
 */
async function generateCostCenterResponse(
  report: any,
  totalCount: number,
  startTime: number
): Promise<Response> {
  console.log('📊 GENERATING COST CENTER REPORT (AGGREGATED)');

  // Fetch all employees (needed for aggregation)
  const employees = await prisma.employee.findMany({
    where: { uploadId: report.uploadId },
    orderBy: { employeeNo: 'asc' },
  });

  const aggregatedData = aggregateCostCenterData(employees);

  const { generateCostCenterExcel, costCenterWorkbookToBuffer } = await import("@/lib/cost-center-excel");
  const wb = generateCostCenterExcel(aggregatedData, report.name, report.upload.period);
  const buffer = costCenterWorkbookToBuffer(wb);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✓ Cost Center Excel: ${(buffer.byteLength / 1024).toFixed(2)} KB in ${totalTime}s`);

  const sanitizedName = report.name.replace(/[^a-zA-Z0-9-_\s]/g, '_');
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${sanitizedName}_CostCenter.xlsx"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}