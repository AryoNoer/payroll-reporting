// app/api/dashboard/net-salary-trend/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get("year") || new Date().getFullYear().toString();

    console.log("[Net Salary Trend API] Year:", year);

    // Get all Net Salary data for the year
    const whereConditions: any = {
      komponen: "Net Salary",
    };

    if (year && year !== "(All)") {
      whereConditions.bulanReport = { contains: year };
    }

    const salaryData = await prisma.employeeComponent.findMany({
      where: whereConditions,
      select: {
        nilai: true,
        bulanReport: true,
      },
    });

    console.log(`[Net Salary Trend API] Found ${salaryData.length} records`);

    // Parse month from bulanReport (format: "31-Jan-2025")
    const monthlyTotals = new Map<string, number>();
    
    salaryData.forEach(item => {
      const salary = parseFloat(item.nilai || "0");
      if (!isNaN(salary) && salary > 0 && item.bulanReport) {
        // Extract month from "31-Jan-2025" format
        const parts = item.bulanReport.split('-');
        if (parts.length >= 2) {
          const month = parts[1]; // "Jan", "Feb", etc.
          monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + salary);
        }
      }
    });

    // Convert to array and sort by month
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const result = monthOrder
      .filter(month => monthlyTotals.has(month))
      .map(month => ({
        month,
        totalSalary: Math.round(monthlyTotals.get(month) || 0),
      }));

    console.log("[Net Salary Trend API] Monthly totals:", result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Net Salary Trend API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch net salary trend data" },
      { status: 500 }
    );
  }
}