/* eslint-disable @typescript-eslint/no-explicit-any */

// app/api/reports/[id]/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateTemplatedExcel, workbookToBuffer, getCategorySummary } from "@/lib/excel-template";
import { categorizeFields } from "@/lib/field-categories";
import { applyCalculationsAndDerivations } from "@/lib/field-calculations";
import { OUTPUT_FIELDS } from "@/lib/output-fields"; // ✅ Import complete field list

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: reportId } = await params;

    console.log('\n' + '='.repeat(60));
    console.log('📊 GENERATING COMPLETE REPORT (ALL 362+ COLUMNS)');
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

    console.log(`✓ Employees: ${employees.length} rows`);

    // ✅ USE COMPLETE OUTPUT_FIELDS (All 362+ columns)
    // This ensures ALL columns are present, even if data is empty
    const allFieldNames = OUTPUT_FIELDS;

    console.log(`✓ Total columns (COMPLETE): ${allFieldNames.length}`);

    // Build data rows
    console.log('\n📋 Building data rows with ALL columns...');
    const excelData = employees.map((emp, index) => {
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