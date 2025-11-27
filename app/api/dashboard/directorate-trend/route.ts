// app/api/dashboard/directorate-trend/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const type = searchParams.get("type"); // 'HO' or 'OS'

    console.log("[Directorate Trend API] Filters:", { year, month, type });

    // Build filter condition
    let bulanReportFilter: string | undefined;

    if (year && month) {
      bulanReportFilter = `${year}-${month.padStart(2, "0")}`;
    } else if (year) {
      bulanReportFilter = year;
    }

    console.log("[Directorate Trend API] BulanReport filter:", bulanReportFilter);

    // Get all directorate data from EmployeeComponent
    const directorateData = await prisma.employeeComponent.findMany({
      where: {
        komponen: "Directorate",
        ...(bulanReportFilter
          ? {
              bulanReport: {
                startsWith: bulanReportFilter,
              },
            }
          : {}),
        ...(type ? { type } : {}),
      },
      select: {
        nilai: true,
        employeeNo: true,
        type: true,
      },
    });

    console.log(`[Directorate Trend API] Found ${directorateData.length} records`);

    // ✅ DEDUPLICATION: Count UNIQUE employees per directorate
    const directorateCounts = new Map<string, Set<string>>();

    directorateData.forEach((item) => {
      const directorate = item.nilai || "Unknown";
      
      // Initialize Set if not exists
      if (!directorateCounts.has(directorate)) {
        directorateCounts.set(directorate, new Set());
      }
      
      // ✅ Add employeeNo to Set (Set automatically handles duplicates)
      directorateCounts.get(directorate)!.add(item.employeeNo);
    });

    // Convert to array format for pie chart
    const chartData = Array.from(directorateCounts.entries()).map(([name, employees]) => ({
      name,
      value: employees.size, // ✅ Use Set.size for unique count
    }));

    // Sort by value descending
    chartData.sort((a, b) => b.value - a.value);

    // Calculate total unique employees
    const totalUniqueEmployees = chartData.reduce((sum, item) => sum + item.value, 0);

    console.log("[Directorate Trend API] Unique employees per directorate:", chartData);

    return NextResponse.json({
      data: chartData,
      total: totalUniqueEmployees, // ✅ Return unique count, not raw rows
      filters: {
        year,
        month,
        type,
      },
    });
  } catch (error) {
    console.error("[Directorate Trend API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch directorate trend data" },
      { status: 500 }
    );
  }
}