// app/api/dashboard/gender-distribution/route.ts
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
    const directorate = searchParams.get("directorate");

    console.log("[Gender Distribution API] Filters:", { year, month, type, directorate });

    // Build filter condition
    let bulanReportFilter: string | undefined;

    if (year && month) {
      bulanReportFilter = `${year}-${month.padStart(2, "0")}`;
    } else if (year) {
      bulanReportFilter = year;
    }

    // Get gender data from EmployeeComponent
    const genderData = await prisma.employeeComponent.findMany({
      where: {
        komponen: "Gender",
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

    console.log(`[Gender Distribution API] Found ${genderData.length} gender records`);

    // If directorate filter is specified, get employee list from that directorate
    let filteredEmployees: Set<string> | null = null;
    if (directorate && directorate !== "all") {
      const directorateData = await prisma.employeeComponent.findMany({
        where: {
          komponen: "Directorate",
          nilai: directorate,
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
          employeeNo: true,
        },
      });
      // ✅ Use Set to ensure unique employeeNo
      filteredEmployees = new Set(directorateData.map((d) => d.employeeNo));
      console.log(`[Gender Distribution API] Filtering by directorate: ${directorate}, found ${filteredEmployees.size} unique employees`);
    }

    // ✅ DEDUPLICATION: Count UNIQUE employees per gender
    const genderCounts = new Map<string, Set<string>>();

    genderData.forEach((item) => {
      // Skip if directorate filter is active and employee is not in the directorate
      if (filteredEmployees && !filteredEmployees.has(item.employeeNo)) {
        return;
      }

      const gender = item.nilai?.trim().toUpperCase() || "UNKNOWN";
      
      // Initialize Set if not exists
      if (!genderCounts.has(gender)) {
        genderCounts.set(gender, new Set());
      }
      
      // ✅ Add employeeNo to Set (automatically deduplicates)
      genderCounts.get(gender)!.add(item.employeeNo);
    });

    // Normalize gender labels
    const normalizedData = Array.from(genderCounts.entries()).map(([gender, employees]) => {
      let normalizedGender = gender;
      if (gender === "M" || gender === "MALE" || gender === "L" || gender === "LAKI-LAKI") {
        normalizedGender = "Male";
      } else if (gender === "F" || gender === "FEMALE" || gender === "P" || gender === "PEREMPUAN") {
        normalizedGender = "Female";
      }

      return {
        name: normalizedGender,
        value: employees.size, // ✅ Use Set.size for unique count
        percentage: 0,
      };
    });

    // Calculate total unique employees and percentages
    const total = normalizedData.reduce((sum, item) => sum + item.value, 0);
    normalizedData.forEach((item) => {
      item.percentage = total > 0 ? Math.round((item.value / total) * 100 * 100) / 100 : 0;
    });

    // Sort by value descending
    normalizedData.sort((a, b) => b.value - a.value);

    console.log("[Gender Distribution API] Unique employees per gender:", normalizedData);

    return NextResponse.json({
      data: normalizedData,
      total, // ✅ Total unique employees
      filters: {
        year,
        month,
        type,
        directorate,
      },
    });
  } catch (error) {
    console.error("[Gender Distribution API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch gender distribution data" },
      { status: 500 }
    );
  }
}