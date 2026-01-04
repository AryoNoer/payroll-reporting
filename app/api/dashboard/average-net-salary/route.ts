// app/api/dashboard/average-net-salary/route.ts - OPTIMIZED VERSION
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  return `avg-salary-${year || 'all'}-${month || 'all'}`;
}

function getFromCache(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[Cache HIT] ${key}`);
    return cached.data;
  }
  console.log(`[Cache MISS] ${key}`);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
  
  // Clean old cache entries
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

function getPreviousMonth(year: string, month: string): { year: string; month: string } {
  const monthNum = parseInt(month);
  if (monthNum === 1) {
    return { year: String(parseInt(year) - 1), month: '12' };
  }
  return { year, month: String(monthNum - 1).padStart(2, '0') };
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

    // Check cache first
    const cacheKey = getCacheKey(year, month);
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // ========================================================================
    // BUILD WHERE CONDITIONS
    // ========================================================================
    const whereConditionCurrent: any = {};
    
    if (year && year !== '(All)') {
      if (month && month !== '(All)') {
        whereConditionCurrent.AND = [
          { bulanReport: { contains: `-${getMonthName(month)}-` } },
          { bulanReport: { contains: year } }
        ];
      } else {
        whereConditionCurrent.bulanReport = { contains: year };
      }
    } else if (month && month !== '(All)') {
      whereConditionCurrent.bulanReport = { contains: `-${getMonthName(month)}-` };
    }

    // ========================================================================
    // OPTIMIZED QUERY 1: Get Current Month Data (Net Salary + Directorate)
    // Single query instead of two separate queries
    // ========================================================================
    console.time('Query-AvgSalary-Current');
    
    const currentData = await prisma.employeeComponent.findMany({
      where: {
        ...whereConditionCurrent,
        OR: [
          { komponen: 'Net Salary' },
          { komponen: 'Directorate' }
        ]
      },
      select: {
        employeeNo: true,
        komponen: true,
        nilai: true,
      },
    });
    
    console.timeEnd('Query-AvgSalary-Current');

    // ========================================================================
    // PROCESS CURRENT MONTH DATA IN MEMORY
    // ========================================================================
    const salaryMap = new Map<string, number>();
    const directorateMap = new Map<string, string>();

    currentData.forEach(item => {
      if (item.komponen === 'Net Salary') {
        salaryMap.set(item.employeeNo, parseFloat(item.nilai) || 0);
      } else if (item.komponen === 'Directorate') {
        directorateMap.set(item.employeeNo, item.nilai);
      }
    });

    // Calculate average salary by department
    const deptSalaryMap = new Map<string, { total: number; count: number }>();
    
    salaryMap.forEach((salary, employeeNo) => {
      const dept = directorateMap.get(employeeNo) || 'Unknown';
      
      if (!deptSalaryMap.has(dept)) {
        deptSalaryMap.set(dept, { total: 0, count: 0 });
      }
      
      const current = deptSalaryMap.get(dept)!;
      current.total += salary;
      current.count += 1;
    });

    const currentResult = Array.from(deptSalaryMap.entries()).map(([department, data]) => ({
      department,
      avgSalary: Math.round(data.total / data.count),
    }));

    // ========================================================================
    // OPTIMIZED QUERY 2: Get Previous Month Data (if applicable)
    // ========================================================================
    let previousResult: any[] = [];
    
    if (year && year !== '(All)' && month && month !== '(All)') {
      const prev = getPreviousMonth(year, month);
      
      console.time('Query-AvgSalary-Previous');
      
      const whereConditionPrevious: any = {
        AND: [
          { bulanReport: { contains: `-${getMonthName(prev.month)}-` } },
          { bulanReport: { contains: prev.year } }
        ],
        OR: [
          { komponen: 'Net Salary' },
          { komponen: 'Directorate' }
        ]
      };

      const previousData = await prisma.employeeComponent.findMany({
        where: whereConditionPrevious,
        select: {
          employeeNo: true,
          komponen: true,
          nilai: true,
        },
      });
      
      console.timeEnd('Query-AvgSalary-Previous');

      // Process previous month data
      const prevSalaryMap = new Map<string, number>();
      const prevDirMap = new Map<string, string>();

      previousData.forEach(item => {
        if (item.komponen === 'Net Salary') {
          prevSalaryMap.set(item.employeeNo, parseFloat(item.nilai) || 0);
        } else if (item.komponen === 'Directorate') {
          prevDirMap.set(item.employeeNo, item.nilai);
        }
      });

      // Use current directorateMap as fallback for employees without directorate in previous month
      prevSalaryMap.forEach((salary, employeeNo) => {
        if (!prevDirMap.has(employeeNo)) {
          const currentDir = directorateMap.get(employeeNo);
          if (currentDir) {
            prevDirMap.set(employeeNo, currentDir);
          }
        }
      });

      const prevDeptSalaryMap = new Map<string, { total: number; count: number }>();
      
      prevSalaryMap.forEach((salary, employeeNo) => {
        const dept = prevDirMap.get(employeeNo) || 'Unknown';
        
        if (!prevDeptSalaryMap.has(dept)) {
          prevDeptSalaryMap.set(dept, { total: 0, count: 0 });
        }
        
        const current = prevDeptSalaryMap.get(dept)!;
        current.total += salary;
        current.count += 1;
      });

      previousResult = Array.from(prevDeptSalaryMap.entries()).map(([department, data]) => ({
        department,
        avgSalary: Math.round(data.total / data.count),
      }));
    }

    const result = {
      current: currentResult,
      previous: previousResult,
    };

    // Store in cache
    setCache(cacheKey, result);

    const duration = Date.now() - startTime;
    console.log(`[Avg Salary] Completed in ${duration}ms`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching average net salary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch average net salary' },
      { status: 500 }
    );
  }
}