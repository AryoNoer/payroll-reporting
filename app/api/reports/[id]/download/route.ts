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


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: reportId } = await params;

    console.log('\n' + '='.repeat(60));
console.log('📊 GENERATING REPORT');
    console.log('='.repeat(60));
    console.log(`Report ID: ${reportId}`);

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

    // Get employees data
    const employees = await prisma.employee.findMany({
      where: { uploadId: report.uploadId },
      orderBy: { employeeNo: 'asc' }
    });

    // ✅ Filter by COA if Cabang Report
    let filteredEmployees = employees;
    if (report.reportType === "CABANG") {
      filteredEmployees = employees.filter((emp) => {
        // Calculate COA from neutralData or salaryData
        const neutralData = (emp.neutralData as any) || {};
        const salaryData = (emp.salaryData as any) || {};
        const costCenter = String(neutralData['Cost Center'] || salaryData['Cost Center'] || '').toLowerCase();
        
        // COA = 500 means NOT "kantor pusat"
        return !costCenter.includes('kantor pusat');
      });
      
      console.log(`✓ Filtered for Cabang: ${filteredEmployees.length} employees (COA = 500)`);
    }

// ... (line 1-67 tetap sama)
    
    console.log(`✓ Employees: ${filteredEmployees.length} rows`);

    // ✅ Handle Cost Center Report (Aggregated)
    if (report.reportType === "COST_CENTER") {
      console.log('\n' + '='.repeat(60));
      console.log('📊 GENERATING COST CENTER REPORT (AGGREGATED)');
      console.log('='.repeat(60));
      
      const aggregatedData = aggregateCostCenterData(employees);
      
      // Generate Excel
      const { generateCostCenterExcel, costCenterWorkbookToBuffer } = await import("@/lib/cost-center-excel");
      const wb = generateCostCenterExcel(aggregatedData, report.name, report.upload.period);
      const buffer = costCenterWorkbookToBuffer(wb);
      
      console.log(`✓ Excel generated: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
      console.log('='.repeat(60));
      console.log('✅ COST CENTER REPORT COMPLETE');
      console.log('='.repeat(60) + '\n');
      
      // Return file
      const sanitizedName = report.name.replace(/[^a-zA-Z0-9-_\s]/g, '_');
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${sanitizedName}_CostCenter.xlsx"`,
        },
      });
    }

    // ✅ Select fields based on report type (FOR NON-COST CENTER REPORTS)
    const allFieldNames = report.reportType === "HEADCOUNT" 
      ? [...HEADCOUNT_FIELDS]   // 25 fields for headcount
      : OUTPUT_FIELDS;           // 301 fields for monthly report

    console.log(`✅ Using ${report.reportType} fields: ${allFieldNames.length} fields total`);

    // ✅ Handle THR Cabang Report (Custom Fields)
    if (report.reportType === "THR_CABANG") {
      console.log('\n' + '='.repeat(60));
      console.log('💰 GENERATING THR CABANG REPORT');
      console.log('='.repeat(60));
      
      const { THR_CABANG_FIELDS } = await import("@/lib/thr-cabang-fields");
      const thrFields = [...THR_CABANG_FIELDS];
      
      console.log(`✓ Using THR Cabang fields: ${thrFields.length} fields`);
      
      // Build data rows for THR Cabang
      const excelData = filteredEmployees.map((emp, index) => {
        const row: any = {
          'No': index + 1,
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

        return finalRow;
      });

      const wb = generateTemplatedExcel(excelData, thrFields, {
        sheetName: 'THR Cabang',
        autoWidth: true,
        maxWidth: 50
      });

      const buffer = workbookToBuffer(wb);
      
      console.log(`✓ Excel generated: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log('='.repeat(60) + '\n');
      
      const sanitizedName = report.name.replace(/[^a-zA-Z0-9-_\s]/g, '_');
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${sanitizedName}_THR_Cabang.xlsx"`,
        },
      });
    }

    // Build data rows
    console.log('\n📋 Building data rows with ALL columns...');
    // Build data rows
    console.log('\n📋 Building data rows with ALL columns...');
    const excelData = filteredEmployees.map((emp, index) => {
      // Start with raw data object
      const row: any = {
        'No': index + 1,
        // Dedicated fields from Employee model
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

      // Merge all JSON fields into one object
      const salaryData = (emp.salaryData as any) || {};
      const allowanceData = (emp.allowanceData as any) || {};
      const deductionData = (emp.deductionData as any) || {};
      const neutralData = (emp.neutralData as any) || {};

      // Merge all data
      Object.assign(row, salaryData, allowanceData, deductionData, neutralData);

      // ✅ Apply calculations and derivations (including Cost Center By Function)
      const processedRow = applyCalculationsAndDerivations(row);

      // ✅ Build final row with ALL OUTPUT_FIELDS (empty string if no data)
      const finalRow: any = {};
      allFieldNames.forEach(fieldName => {
        // Use processed value if exists, otherwise empty string
        finalRow[fieldName] = processedRow[fieldName] ?? '';
      });

      return finalRow;
    });

    console.log(`✓ Data rows built: ${excelData.length} rows x ${allFieldNames.length} columns`);

    // Count how many fields have data vs empty
    const sampleRow = excelData[0] || {};
    const fieldsWithData = Object.values(sampleRow).filter(v => v !== '' && v !== null && v !== 0).length;
    const emptyFields = allFieldNames.length - fieldsWithData;
    
    console.log(`\n📊 Data Coverage:`);
    console.log(`  - Fields with data: ${fieldsWithData}`);
    console.log(`  - Empty fields: ${emptyFields}`);
    console.log(`  - Coverage: ${((fieldsWithData / allFieldNames.length) * 100).toFixed(1)}%`);

    // Get category summary for logging
    const fieldCategories = categorizeFields(allFieldNames);
    const summary = getCategorySummary(allFieldNames, fieldCategories);
    
    console.log('\n📊 Field Distribution by Category:');
    Object.entries(summary)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  - ${category}: ${count} fields`);
      });

    // Generate Excel with 4-level hierarchical headers
    console.log('\n📄 Generating Excel with templated headers...');
    const wb = generateTemplatedExcel(excelData, allFieldNames, {
      sheetName: 'Report',
      autoWidth: true,
      maxWidth: 50
    });

    // Convert to buffer
    const buffer = workbookToBuffer(wb);

    console.log(`✓ Excel generated: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log('='.repeat(60));
    console.log('✅ DOWNLOAD COMPLETE - ALL COLUMNS INCLUDED');
    console.log('='.repeat(60) + '\n');

    // Return file
    const sanitizedName = report.name.replace(/[^a-zA-Z0-9-_\s]/g, '_');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sanitizedName}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error("❌ DOWNLOAD ERROR");
    console.error('='.repeat(60));
    console.error(error);
    console.error('='.repeat(60) + '\n');
    
    return NextResponse.json(
      { 
        error: "Failed to download report",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}