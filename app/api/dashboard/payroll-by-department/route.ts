/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/api/dashboard/payroll-by-department/route.ts - OPTIMIZED
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
// HELPER FUNCTIONS
// ============================================================================
function getMonthName(monthNum: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(monthNum) - 1];
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

    // Check cache
    const cacheKey = getCacheKey(year, month);
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Build where condition
    const whereCondition: any = {};

    if (year && year !== '(All)') {
      if (month && month !== '(All)') {
        whereCondition.AND = [
          { bulanReport: { contains: `-${getMonthName(month)}-` } },
          { bulanReport: { contains: year } }
        ];
      } else {
        whereCondition.bulanReport = { contains: year };
      }
    } else if (month && month !== '(All)') {
      whereCondition.bulanReport = { contains: `-${getMonthName(month)}-` };
    }

    // ========================================================================
    // OPTIMIZED: Single query to get Directorate AND Net Salary
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
        nilai: true
      }
    });
    
    console.timeEnd('Query-Dept-Combined');

    // Process in memory
    const salaryMap = new Map<string, number>();
    const deptMap = new Map<string, string>();
    
    allData.forEach(item => {
      if (item.komponen === 'Net Salary') {
        salaryMap.set(item.employeeNo, parseFloat(item.nilai) || 0);
      } else if (item.komponen === 'Directorate') {
        deptMap.set(item.employeeNo, item.nilai);
      }
    });

    // Aggregate by department
    const deptTotalMap = new Map<string, number>();
    
    deptMap.forEach((dept, employeeNo) => {
      const salary = salaryMap.get(employeeNo) || 0;
      deptTotalMap.set(dept, (deptTotalMap.get(dept) || 0) + salary);
    });

    const result = Array.from(deptTotalMap.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round(value)
      }))
      .sort((a, b) => b.value - a.value);

    // Cache result
    setCache(cacheKey, result);

    const duration = Date.now() - startTime;
    console.log(`[Dept API] Completed in ${duration}ms`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching payroll by department:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll by department' },
      { status: 500 }
    );
  }
}