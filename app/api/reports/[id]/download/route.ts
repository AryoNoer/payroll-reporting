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

    // Get employees data
    const employees = await prisma.employee.findMany({
      where: { uploadId: report.uploadId },
    });

    // Get selected fields
    const selectedFields = report.selectedFields as string[];

    // Get component info
    const components = await prisma.component.findMany({
      where: {
        code: { in: selectedFields },
      },
    });

    const componentMap = new Map(components.map(c => [c.code, c]));

    // Build Excel data
    const excelData = employees.map((emp) => {
      const row: any = {
        "No": employees.indexOf(emp) + 1,
        "Name": emp.name,
        "Employee No": emp.employeeNo,
        "Gender": emp.gender,
        "No KTP": emp.noKTP,
        "Position": emp.position,
        "Directorate": emp.directorate,
        "Grade": emp.grade,
        "Employment Status": emp.employmentStatus,
      };

      // Add selected fields
      selectedFields.forEach((fieldCode) => {
        const component = componentMap.get(fieldCode);
        if (!component) return;

        const fieldName = component.name;
        let value = 0;

        // Find value in appropriate data section
        const salaryData = emp.salaryData as any;
        const allowanceData = emp.allowanceData as any;
        const deductionData = emp.deductionData as any;
        const neutralData = emp.neutralData as any;

        if (salaryData[fieldName] !== undefined) {
          value = salaryData[fieldName];
        } else if (allowanceData[fieldName] !== undefined) {
          value = allowanceData[fieldName];
        } else if (deductionData[fieldName] !== undefined) {
          value = deductionData[fieldName];
        } else if (neutralData[fieldName] !== undefined) {
          value = neutralData[fieldName];
        }

        row[fieldName] = value;
      });

      return row;
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Return file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${report.name}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download report" },
      { status: 500 }
    );
  }
}