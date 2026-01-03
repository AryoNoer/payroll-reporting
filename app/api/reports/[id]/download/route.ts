/* eslint-disable @typescript-eslint/no-explicit-any */

// app/api/reports/[id]/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateTemplatedExcel, workbookToBuffer, getCategorySummary } from "@/lib/excel-template";
import { categorizeFields } from "@/lib/field-categories";
import { applyCalculationsAndDerivations } from "@/lib/field-calculations";
import { OUTPUT_FIELDS } from "@/lib/output-fields";
import { HEADCOUNT_FIELDS } from "@/lib/headcount-fields";
import { aggregateCostCenterData } from "@/lib/cost-center-aggregation";

// ✅ Configure route for longer execution (Pro plan only)
// If on hobby plan, this will be ignored but won't cause errors
export const maxDuration = 60; // seconds
export const dynamic = 'force-dynamic';

// ✅ Process data in smaller batches to reduce memory usage
const BATCH_SIZE = 2000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const user = await requireAuth();
    const { id: reportId } = await params;

    console.log('\n' + '='.repeat(60));
    console.log('📊 GENERATING REPORT');
    console.log('='.repeat(60));
    console.log(`Report ID: ${reportId}`);
    console.log(`Start time: ${new Date().toISOString()}`);

    // Get report
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        userId: user.id,
      },
      include: {
        upload: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    console.log(`✓ Report: ${report.name}`);
    console.log(`✓ Upload: ${report.upload.originalName}`);

    // ✅ Get employees count first
    const totalCount = await prisma.employee.count({
      where: { uploadId: report.uploadId }
    });
    
    console.log(`✓ Total employees: ${totalCount}`);

    // ✅ OPTIMIZATION: For large datasets (>5000), fetch in batches
    let employees: any[] = [];
    
    if (totalCount > 5000) {
      console.log(`⚡ Large dataset detected, fetching in batches...`);
      
      const batchCount = Math.ceil(totalCount / BATCH_SIZE);
      for (let i = 0; i < batchCount; i++) {
        const batch = await prisma.employee.findMany({
          where: { uploadId: report.uploadId },
          orderBy: { employeeNo: 'asc' },
          skip: i * BATCH_SIZE,
          take: BATCH_SIZE,
        });
        employees.push(...batch);
        
        console.log(`  Batch ${i + 1}/${batchCount}: ${batch.length} rows`);
        
        // ✅ Small delay to prevent overwhelming the database
        if (i < batchCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`✓ Fetched all ${employees.length} employees in ${batchCount} batches`);
    } else {
      employees = await prisma.employee.findMany({
        where: { uploadId: report.uploadId },
        orderBy: { employeeNo: 'asc' }
      });
      console.log(`✓ Fetched ${employees.length} employees in single query`);
    }

    const fetchTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️ Fetch time: ${fetchTime}s`);

    // ✅ Filter by COA if Cabang Report
    let filteredEmployees = employees;
    if (report.reportType === "CABANG") {
      filteredEmployees = employees.filter((emp) => {
        const neutralData = (emp.neutralData as any) || {};
        const salaryData = (emp.salaryData as any) || {};
        const costCenter = String(neutralData['Cost Center'] || salaryData['Cost Center'] || '').toLowerCase();
        return !costCenter.includes('kantor pusat');
      });
      
      console.log(`✓ Filtered for Cabang: ${filteredEmployees.length} employees (COA = 500)`);
    }

    console.log(`✓ Processing ${filteredEmployees.length} rows`);

    // ✅ Handle Cost Center Report (Aggregated)
    if (report.reportType === "COST_CENTER") {
      console.log('\n' + '='.repeat(60));
      console.log('📊 GENERATING COST CENTER REPORT (AGGREGATED)');
      console.log('='.repeat(60));
      
      const aggregatedData = aggregateCostCenterData(employees);
      
      const { generateCostCenterExcel, costCenterWorkbookToBuffer } = await import("@/lib/cost-center-excel");
      const wb = generateCostCenterExcel(aggregatedData, report.name, report.upload.period);
      const buffer = costCenterWorkbookToBuffer(wb);
      
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✓ Excel generated: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
      console.log(`⏱️ Total time: ${totalTime}s`);
      console.log('='.repeat(60));
      console.log('✅ COST CENTER REPORT COMPLETE');
      console.log('='.repeat(60) + '\n');
      
      const sanitizedName = report.name.replace(/[^a-zA-Z0-9-_\s]/g, '_');
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${sanitizedName}_CostCenter.xlsx"`,
        },
      });
    }

    // ✅ Select fields based on report type
    const allFieldNames = report.reportType === "HEADCOUNT" 
      ? [...HEADCOUNT_FIELDS]
      : OUTPUT_FIELDS;

    console.log(`✅ Using ${report.reportType} fields: ${allFieldNames.length} fields total`);

    // ✅ Handle THR Cabang Report
    if (report.reportType === "THR_CABANG") {
      console.log('\n' + '='.repeat(60));
      console.log('💰 GENERATING THR CABANG REPORT');
      console.log('='.repeat(60));
      
      const { THR_CABANG_FIELDS } = await import("@/lib/thr-cabang-fields");
      const thrFields = [...THR_CABANG_FIELDS];
      
      console.log(`✓ Using THR Cabang fields: ${thrFields.length} fields`);
      
      // ✅ Process rows with progress logging
      const excelData = [];
      const progressInterval = Math.ceil(filteredEmployees.length / 10); // Log every 10%
      
      for (let i = 0; i < filteredEmployees.length; i++) {
        const emp = filteredEmployees[i];
        
        const row: any = {
          'No': i + 1,
          'Name': emp.name,
          'Employee No': emp.employeeNo,
          'Position': emp.position,
          'Department': emp.orgUnit,
          'Employment Status': emp.employmentStatus,
          'Join Date': emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('id-ID') : '',
          'Terminate Date': emp.terminateDate ? new Date(emp.terminateDate).toLocaleDateString('id-ID') : '',
        };

        const salaryData = (emp.salaryData as any) || {};
        const allowanceData = (emp.allowanceData as any) || {};
        const deductionData = (emp.deductionData as any) || {};
        const neutralData = (emp.neutralData as any) || {};

        Object.assign(row, salaryData, allowanceData, deductionData, neutralData);
        const processedRow = applyCalculationsAndDerivations(row);

        const finalRow: any = {};
        thrFields.forEach(fieldName => {
          finalRow[fieldName] = processedRow[fieldName] ?? '';
        });

        excelData.push(finalRow);
        
        // Progress logging
        if ((i + 1) % progressInterval === 0) {
          const progress = Math.round(((i + 1) / filteredEmployees.length) * 100);
          console.log(`  Progress: ${progress}% (${i + 1}/${filteredEmployees.length} rows)`);
        }
      }

      const processTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✓ Data processing: ${processTime}s`);

      const wb = generateTemplatedExcel(excelData, thrFields, {
        sheetName: 'THR Cabang',
        autoWidth: true,
        maxWidth: 50
      });

      const buffer = workbookToBuffer(wb);
      
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✓ Excel generated: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`⏱️ Total time: ${totalTime}s`);
      console.log('='.repeat(60) + '\n');
      
      const sanitizedName = report.name.replace(/[^a-zA-Z0-9-_\s]/g, '_');
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${sanitizedName}_THR_Cabang.xlsx"`,
        },
      });
    }

    // ✅ Build data rows with progress tracking
    console.log('\n📋 Building data rows with ALL columns...');
    const excelData = [];
    const progressInterval = Math.ceil(filteredEmployees.length / 10);
    
    for (let i = 0; i < filteredEmployees.length; i++) {
      const emp = filteredEmployees[i];
      
      const row: any = {
        'No': i + 1,
        'Name': emp.name,
        'Employee No': emp.employeeNo,
        'Gender': emp.gender,
        'No KTP': emp.noKTP,
        'Gov. Tax File No.': emp.taxFileNo,
        'Position': emp.position,
        'Directorate': emp.directorate,
        'Org Unit': emp.orgUnit,
        'Grade': emp.grade,
        'Employment Status': emp.employmentStatus,
        'Join Date': emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('id-ID') : '',
        'Terminate Date': emp.terminateDate ? new Date(emp.terminateDate).toLocaleDateString('id-ID') : '',
        'Length Of Service': emp.lengthOfService,
        'Tax Status': emp.taxStatus,
      };

      const salaryData = (emp.salaryData as any) || {};
      const allowanceData = (emp.allowanceData as any) || {};
      const deductionData = (emp.deductionData as any) || {};
      const neutralData = (emp.neutralData as any) || {};

      Object.assign(row, salaryData, allowanceData, deductionData, neutralData);
      const processedRow = applyCalculationsAndDerivations(row);

      const finalRow: any = {};
      allFieldNames.forEach(fieldName => {
        finalRow[fieldName] = processedRow[fieldName] ?? '';
      });

      excelData.push(finalRow);
      
      // Progress logging
      if ((i + 1) % progressInterval === 0) {
        const progress = Math.round(((i + 1) / filteredEmployees.length) * 100);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  Progress: ${progress}% (${i + 1}/${filteredEmployees.length} rows) - ${elapsed}s elapsed`);
      }
    }

    const processTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Data rows built: ${excelData.length} rows x ${allFieldNames.length} columns in ${processTime}s`);

    // Count coverage
    const sampleRow = excelData[0] || {};
    const fieldsWithData = Object.values(sampleRow).filter(v => v !== '' && v !== null && v !== 0).length;
    const emptyFields = allFieldNames.length - fieldsWithData;
    
    console.log(`\n📊 Data Coverage:`);
    console.log(`  - Fields with data: ${fieldsWithData}`);
    console.log(`  - Empty fields: ${emptyFields}`);
    console.log(`  - Coverage: ${((fieldsWithData / allFieldNames.length) * 100).toFixed(1)}%`);

    // Get category summary
    const fieldCategories = categorizeFields(allFieldNames);
    const summary = getCategorySummary(allFieldNames, fieldCategories);
    
    console.log('\n📊 Field Distribution by Category:');
    Object.entries(summary)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  - ${category}: ${count} fields`);
      });

    // Generate Excel
    console.log('\n📄 Generating Excel with templated headers...');
    const excelStartTime = Date.now();
    
    const wb = generateTemplatedExcel(excelData, allFieldNames, {
      sheetName: 'Report',
      autoWidth: true,
      maxWidth: 50
    });

    const excelTime = ((Date.now() - excelStartTime) / 1000).toFixed(2);
    console.log(`✓ Excel generation: ${excelTime}s`);

    // Convert to buffer
    const bufferStartTime = Date.now();
    const buffer = workbookToBuffer(wb);
    const bufferTime = ((Date.now() - bufferStartTime) / 1000).toFixed(2);
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Buffer conversion: ${bufferTime}s`);
    console.log(`✓ Excel size: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`⏱️ Total time: ${totalTime}s`);
    console.log('='.repeat(60));
    console.log('✅ DOWNLOAD COMPLETE - ALL COLUMNS INCLUDED');
    console.log('='.repeat(60) + '\n');

    // ✅ Check if we're approaching timeout
    if (parseFloat(totalTime) > 8) {
      console.warn(`⚠️ WARNING: Generation took ${totalTime}s (approaching 10s timeout limit)`);
    }

    // Return file
    const sanitizedName = report.name.replace(/[^a-zA-Z0-9-_\s]/g, '_');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sanitizedName}.xlsx"`,
      },
    });
  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.error('\n' + '='.repeat(60));
    console.error("❌ DOWNLOAD ERROR");
    console.error('='.repeat(60));
    console.error(`Total time before error: ${totalTime}s`);
    console.error(error);
    console.error('='.repeat(60) + '\n');
    
    // ✅ Better error messages
    let errorMessage = "Failed to download report";
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        errorMessage = "Report generation timed out. The file is too large. Please try filtering the data or upgrade to Vercel Pro for longer timeout.";
      } else if (error.message.includes('memory')) {
        errorMessage = "Out of memory while generating report. Please try with a smaller dataset.";
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        message: error instanceof Error ? error.message : "Unknown error",
        executionTime: `${totalTime}s`
      },
      { status: 500 }
    );
  }
}