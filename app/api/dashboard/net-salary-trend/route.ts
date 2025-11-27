// app/api/dashboard/net-salary-trend/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const directorate = searchParams.get("directorate");
    const type = searchParams.get("type");

    console.log("[Net Salary Trend API] Filters:", { year, month, directorate, type });

    // Build filter condition for salary
    const whereConditions: any = {
      komponen: "Net Salary",
    };

    if (year && month) {
      whereConditions.bulanReport = { startsWith: `${year}-${month.padStart(2, "0")}` };
    } else if (year) {
      whereConditions.bulanReport = { startsWith: year };
    }

    if (type && (type === "OS" || type === "HO")) {
      whereConditions.type = type;
    }

    // Get Net Salary data
    const netSalaryData = await prisma.employeeComponent.findMany({
      where: whereConditions,
      select: {
        nilai: true,
        employeeNo: true,
      },
    });

    console.log(`[Net Salary Trend API] Found ${netSalaryData.length} Net Salary records`);

    // ✅ DEDUPLICATION: Get unique employees with their salary
    const employeeSalaryMap = new Map<string, number>();

    netSalaryData.forEach(item => {
      const salary = parseFloat(item.nilai || "0");
      if (!isNaN(salary) && salary > 0) {
        // Only keep first occurrence per employee
        if (!employeeSalaryMap.has(item.employeeNo)) {
          employeeSalaryMap.set(item.employeeNo, salary);
        }
      }
    });

    console.log(`[Net Salary Trend API] Unique employees: ${employeeSalaryMap.size}`);

    // Get employee names and directorates
    const employeeNos = Array.from(employeeSalaryMap.keys());
    
    const employeeDetails = await prisma.employeeComponent.findMany({
      where: {
        employeeNo: { in: employeeNos },
        komponen: { in: ["Name", "Directorate"] },
        ...(whereConditions.bulanReport ? { bulanReport: whereConditions.bulanReport } : {}),
        ...(whereConditions.type ? { type: whereConditions.type } : {}),
      },
      select: {
        employeeNo: true,
        komponen: true,
        nilai: true,
      },
    });

    // Build employee info map
    const employeeInfoMap = new Map<string, { name?: string; directorate?: string }>();

    employeeDetails.forEach(detail => {
      if (!employeeInfoMap.has(detail.employeeNo)) {
        employeeInfoMap.set(detail.employeeNo, {});
      }
      const info = employeeInfoMap.get(detail.employeeNo)!;
      
      if (detail.komponen === "Name") {
        info.name = detail.nilai || detail.employeeNo;
      } else if (detail.komponen === "Directorate") {
        info.directorate = detail.nilai;
      }
    });

    // Combine salary with employee info
    let salaryData = Array.from(employeeSalaryMap.entries()).map(([employeeNo, salary]) => {
      const info = employeeInfoMap.get(employeeNo) || {};
      return {
        employeeNo,
        name: info.name || employeeNo,
        directorate: info.directorate || "Unknown",
        salary,
      };
    });

    // Filter by directorate if specified
    if (directorate && directorate !== "all") {
      salaryData = salaryData.filter(item => item.directorate === directorate);
      console.log(`[Net Salary Trend API] After directorate filter: ${salaryData.length}`);
    }

    // Sort by salary ascending
    salaryData.sort((a, b) => a.salary - b.salary);

    // Calculate statistics
    const totalEmployees = salaryData.length;
    const totalSalary = salaryData.reduce((sum, item) => sum + item.salary, 0);
    const averageSalary = totalEmployees > 0 ? totalSalary / totalEmployees : 0;
    const minSalary = salaryData.length > 0 ? salaryData[0].salary : 0;
    const maxSalary = salaryData.length > 0 ? salaryData[salaryData.length - 1].salary : 0;

    console.log("[Net Salary Trend API] Statistics:", {
      totalEmployees,
      averageSalary: averageSalary.toFixed(2),
      minSalary,
      maxSalary,
    });

    return NextResponse.json({
      data: salaryData, // All unique employees with their salaries
      stats: {
        average: Math.round(averageSalary),
        min: minSalary,
        max: maxSalary,
        total: totalEmployees,
      },
      filters: { year, month, directorate, type },
    });
  } catch (error) {
    console.error("[Net Salary Trend API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch net salary trend data" },
      { status: 500 }
    );
  }
}