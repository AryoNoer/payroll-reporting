/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/api/dashboard/payroll-by-department/route.ts - FIXED
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ============================================================================
// CACHING LAYER
// ============================================================================
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(year: string | null, month: string | null): string {
  return `dept-${year || 'all'}-${month || 'all'}`;
}

function getFromCache(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[Cache HIT] ${key}`);
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS - UPDATED TO MATCH YOUR DB FORMAT
// ============================================================================
function getMonthNames(monthNum: string): string[] {
  // Return multiple possible formats to match different data formats
  const monthIndex = parseInt(monthNum) - 1;
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const paddedMonth = monthNum.padStart(2, '0'); // e.g., "01", "02"
  
  return [
    shortMonths[monthIndex],      // Jan
    fullMonths[monthIndex],       // January
    paddedMonth,                  // 01
    String(monthIndex + 1)        // 1
  ];
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================
export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    console.log('[Dept API] Filters:', { year, month });

    // Check cache
    const cacheKey = getCacheKey(year, month);
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // ========================================================================
    // STEP 1: First, let's check what data actually exists
    // ========================================================================
    console.time('Query-Check-Data');
    
    const sampleData = await prisma.employeeComponent.findFirst({
      select: {
        bulanReport: true,
        komponen: true,
        nilai: true
      }
    });
    
    console.log('[Dept API] Sample data format:', sampleData);
    console.timeEnd('Query-Check-Data');

    // ========================================================================
    // STEP 2: Build flexible where condition
    // ========================================================================
    const whereCondition: any = {};

    if (year && year !== '(All)') {
      // Match year in bulanReport field
      if (month && month !== '(All)') {
        // Try multiple month formats
        const monthVariants = getMonthNames(month);
        
        whereCondition.AND = [
          { bulanReport: { contains: year } },
          {
            OR: monthVariants.map(variant => ({
              bulanReport: { contains: variant }
            }))
          }
        ];
      } else {
        whereCondition.bulanReport = { contains: year };
      }
    } else if (month && month !== '(All)') {
      const monthVariants = getMonthNames(month);
      whereCondition.OR = monthVariants.map(variant => ({
        bulanReport: { contains: variant }
      }));
    }

    console.log('[Dept API] WHERE condition:', JSON.stringify(whereCondition, null, 2));

    // ========================================================================
    // STEP 3: Query data with combined approach
    // ========================================================================
    console.time('Query-Dept-Combined');
    
    const allData = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        OR: [
          { komponen: 'Directorate' },
          { komponen: 'Net Salary' }
        ]
      },
      select: {
        employeeNo: true,
        komponen: true,
        nilai: true,
        bulanReport: true // Include for debugging
      }
    });
    
    console.timeEnd('Query-Dept-Combined');
    console.log(`[Dept API] Records found: ${allData.length}`);
    
    // Log sample records for debugging
    if (allData.length > 0) {
      console.log('[Dept API] Sample records:', allData.slice(0, 3));
    }

    // ========================================================================
    // STEP 4: Process in memory
    // ========================================================================
    const salaryMap = new Map<string, number>();
    const deptMap = new Map<string, string>();
    
    allData.forEach(item => {
      if (item.komponen === 'Net Salary') {
        const salary = parseFloat(item.nilai) || 0;
        salaryMap.set(item.employeeNo, salary);
      } else if (item.komponen === 'Directorate') {
        deptMap.set(item.employeeNo, item.nilai);
      }
    });

    console.log(`[Dept API] Salary records: ${salaryMap.size}, Dept records: ${deptMap.size}`);

    // Aggregate by department
    const deptTotalMap = new Map<string, number>();
    
    deptMap.forEach((dept, employeeNo) => {
      const salary = salaryMap.get(employeeNo) || 0;
      if (salary > 0) { // Only include employees with salary
        deptTotalMap.set(dept, (deptTotalMap.get(dept) || 0) + salary);
      }
    });

    console.log(`[Dept API] Departments found: ${deptTotalMap.size}`);

    const result = Array.from(deptTotalMap.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round(value)
      }))
      .sort((a, b) => b.value - a.value);

    console.log(`[Dept API] Final result count: ${result.length}`);

    // Cache result
    setCache(cacheKey, result);

    const duration = Date.now() - startTime;
    console.log(`[Dept API] Completed in ${duration}ms`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Dept API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll by department' },
      { status: 500 }
    );
  }
}