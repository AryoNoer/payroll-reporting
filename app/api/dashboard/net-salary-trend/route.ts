// FILE 1: app/api/dashboard/net-salary-trend/route.ts - OPTIMIZED
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Caching
const trendCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

function getTrendCacheKey(year: string | null): string {
  return `trend-${year || 'all'}`;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get("year");

    // Check cache
    const cacheKey = getTrendCacheKey(year);
    const cached = trendCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return NextResponse.json(cached.data);
    }

    console.time('Query-Trend');

    const whereConditions: any = { komponen: "Net Salary" };

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

    console.timeEnd('Query-Trend');

    // Process in memory
    const monthlyTotals = new Map<string, { total: number; year: string }>();
    
    salaryData.forEach(item => {
      const salary = parseFloat(item.nilai || "0");
      if (!isNaN(salary) && salary > 0 && item.bulanReport) {
        const parts = item.bulanReport.split('-');
        if (parts.length >= 3) {
          const month = parts[1];
          const itemYear = parts[2];
          const key = `${month}-${itemYear}`;
          
          if (!monthlyTotals.has(key)) {
            monthlyTotals.set(key, { total: 0, year: itemYear });
          }
          
          const current = monthlyTotals.get(key)!;
          current.total += salary;
        }
      }
    });

    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const result = Array.from(monthlyTotals.entries())
      .map(([key, data]) => {
        const [month, itemYear] = key.split('-');
        return {
          month,
          year: itemYear,
          totalSalary: Math.round(data.total),
          sortKey: `${itemYear}-${monthOrder.indexOf(month).toString().padStart(2, '0')}`,
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(item => ({
        month: year && year !== "(All)" ? item.month : `${item.month} ${item.year}`,
        totalSalary: item.totalSalary,
      }));

    // Cache result
    trendCache.set(cacheKey, { data: result, timestamp: Date.now() });
    if (trendCache.size > 100) {
      const oldestKey = trendCache.keys().next().value;
      if (oldestKey) {
        trendCache.delete(oldestKey);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Trend API] Completed in ${duration}ms`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Net Salary Trend API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch net salary trend data" },
      { status: 500 }
    );
  }
}