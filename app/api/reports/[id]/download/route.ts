/* eslint-disable @typescript-eslint/no-explicit-any */

// app/api/reports/[id]/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const reportId = params.id;

    console.log('\n=== GENERATING REPORT DOWNLOAD ===');
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

    console.log(`Report: ${report.name}`);
    console.log(`Upload: ${report.upload.originalName}`);

    // Get employees data
    const employees = await prisma.employee.findMany({
      where: { uploadId: report.uploadId },
    });

    console.log(`Employees: ${employees.length} rows`);

    // ✅ Get selected fields (these are field NAMES, not codes)
    const selectedFields = report.selectedFields as string[];
    console.log(`Selected fields: ${selectedFields.length} fields`);
    console.log(`Sample selected fields:`, selectedFields.slice(0, 10).join(', '));

    // ✅ Build Excel data - LANGSUNG dari field name
    const excelData = employees.map((emp, index) => {
      const row: any = {
        "No": index + 1,
      };

      // Process each selected field by NAME
      selectedFields.forEach((fieldName) => {
        let value: any = null;

        // ✅ Check if it's a dedicated field (metadata)
        switch (fieldName) {
          case "Name":
            value = emp.name;
            break;
          case "Employee No":
            value = emp.employeeNo;
            break;
          case "Gender":
            value = emp.gender;
            break;
          case "No KTP":
            value = emp.noKTP;
            break;
          case "Gov. Tax File No.":
            value = emp.taxFileNo;
            break;
          case "Position":
            value = emp.position;
            break;
          case "Directorate":
            value = emp.directorate;
            break;
          case "Org Unit":
            value = emp.orgUnit;
            break;
          case "Grade":
            value = emp.grade;
            break;
          case "Employment Status":
            value = emp.employmentStatus;
            break;
          case "Join Date":
            value = emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('id-ID') : null;
            break;
          case "Terminate Date":
            value = emp.terminateDate ? new Date(emp.terminateDate).toLocaleDateString('id-ID') : null;
            break;
          case "Length of Service":
            value = emp.lengthOfService;
            break;
          case "Tax Status":
            value = emp.taxStatus;
            break;
          
          // ✅ If not a dedicated field, search in JSON data
          default:
            const salaryData = emp.salaryData as any;
            const allowanceData = emp.allowanceData as any;
            const deductionData = emp.deductionData as any;
            const neutralData = emp.neutralData as any;

            // Search by field NAME in all JSON fields
            if (salaryData && salaryData[fieldName] !== undefined) {
              value = salaryData[fieldName];
            } else if (allowanceData && allowanceData[fieldName] !== undefined) {
              value = allowanceData[fieldName];
            } else if (deductionData && deductionData[fieldName] !== undefined) {
              value = deductionData[fieldName];
            } else if (neutralData && neutralData[fieldName] !== undefined) {
              value = neutralData[fieldName];
            }
            break;
        }

        // Add to row with field name as column header
        row[fieldName] = value ?? "";
      });

      return row;
    });

    console.log('Excel data prepared');
    console.log(`First row sample:`, Object.keys(excelData[0] || {}).slice(0, 10).join(', '));
    console.log(`First row columns: ${Object.keys(excelData[0] || {}).length}`);
    console.log(`Expected columns: ${selectedFields.length + 1} (including "No")`);

    if (Object.keys(excelData[0] || {}).length !== selectedFields.length + 1) {
      console.warn('⚠️  Column count mismatch!');
    } else {
      console.log('✅ Column count matches!');
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Auto-size columns (optional, for better readability)
    const maxWidth = 50;
    const colWidths = Object.keys(excelData[0] || {}).map(key => {
      const maxLength = Math.max(
        key.length,
        ...excelData.slice(0, 100).map(row => 
          String(row[key] || "").length
        )
      );
      return { wch: Math.min(maxLength + 2, maxWidth) };
    });
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    console.log(`✅ Report generated successfully`);
    console.log('=== DOWNLOAD COMPLETE ===\n');

    // Return file
    const sanitizedName = report.name.replace(/[^a-zA-Z0-9-_\s]/g, '_');
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sanitizedName}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("❌ Download error:", error);
    return NextResponse.json(
      { error: "Failed to download report" },
      { status: 500 }
    );
  }
}