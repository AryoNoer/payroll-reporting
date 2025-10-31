/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-explicit-any */

// app/api/reports/[id]/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ Changed to Promise
) {
  try {
    const user = await requireAuth();
    const { id: reportId } = await params; // ✅ Await params

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

    // Get selected fields (these are field NAMES, not codes)
    const selectedFields = report.selectedFields as string[];
    console.log(`Selected fields: ${selectedFields.length} fields`);
    console.log(`Sample selected fields:`, selectedFields.slice(0, 10).join(', '));

    // ✅ Build Excel data - ALWAYS include basic fields + selected fields
    const excelData = employees.map((emp, index) => {
      // ✅ ALWAYS include these basic/metadata fields FIRST
      const row: any = {
        "No": index + 1,
        "Name": emp.name,
        "Employee No": emp.employeeNo,
        "Gender": emp.gender || "",
        "No KTP": emp.noKTP || "",
        "Gov. Tax File No.": emp.taxFileNo || "",
        "Position": emp.position || "",
        "Directorate": emp.directorate || "",
        "Org Unit": emp.orgUnit || "",
        "Grade": emp.grade || "",
        "Employment Status": emp.employmentStatus || "",
        "Join Date": emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('id-ID') : "",
        "Terminate Date": emp.terminateDate ? new Date(emp.terminateDate).toLocaleDateString('id-ID') : "",
        "Length of Service": emp.lengthOfService || "",
        "Tax Status": emp.taxStatus || "",
      };

      // ✅ Then add selected additional fields from JSON data
      const salaryData = emp.salaryData as any;
      const allowanceData = emp.allowanceData as any;
      const deductionData = emp.deductionData as any;
      const neutralData = emp.neutralData as any;

      selectedFields.forEach((fieldName) => {
        // Skip if already in basic fields above
        if (row[fieldName] !== undefined) {
          return;
        }

        // Search in JSON data by field NAME
        let value: any = null;

        if (salaryData && salaryData[fieldName] !== undefined) {
          value = salaryData[fieldName];
        } else if (allowanceData && allowanceData[fieldName] !== undefined) {
          value = allowanceData[fieldName];
        } else if (deductionData && deductionData[fieldName] !== undefined) {
          value = deductionData[fieldName];
        } else if (neutralData && neutralData[fieldName] !== undefined) {
          value = neutralData[fieldName];
        }

        row[fieldName] = value ?? "";
      });

      return row;
    });

    console.log('Excel data prepared');
    console.log(`Total columns: ${Object.keys(excelData[0] || {}).length}`);
    console.log(`Basic fields (always included): 14`);
    console.log(`Additional selected fields: ${selectedFields.length}`);
    console.log(`First 20 columns:`, Object.keys(excelData[0] || {}).slice(0, 20).join(', '));

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Auto-size columns
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

    console.log(`✅ Report generated successfully: ${buffer.length} bytes`);
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