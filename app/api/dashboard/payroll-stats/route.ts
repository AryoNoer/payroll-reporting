/* eslint-disable @typescript-eslint/no-explicit-any */
// API 1: Payroll Stats (Top Metrics) - OPTIMIZED VERSION
// File: app/api/dashboard/payroll-stats/route.ts
// ============================================================================
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
  return `payroll-stats-${year || 'all'}-${month || 'all'}`;
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
  
  // Clean old cache entries (keep max 100 entries)
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

    // Check cache first
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
    // OPTIMIZED QUERY: Single query to get all needed data
    // ========================================================================
    console.time('Query-PayrollStats-All');
    
    const allData = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        OR: [
          { komponen: 'Directorate' },
          { komponen: 'Total Allowance' },
          { komponen: 'Tax Allowance' },
          { komponen: 'Net Salary' }
        ]
      },
      select: {
        employeeNo: true,
        komponen: true,
        nilai: true,
      },
    });
    
    console.timeEnd('Query-PayrollStats-All');

    // ========================================================================
    // PROCESS DATA IN MEMORY (Much faster than multiple DB queries)
    // ========================================================================
    const uniqueEmployees = new Set<string>();
    const uniqueDepartments = new Set<string>();
    let totalPayroll = 0;
    const salaryValues: number[] = [];

    allData.forEach(item => {
      uniqueEmployees.add(item.employeeNo);
      
      if (item.komponen === 'Directorate') {
        uniqueDepartments.add(item.nilai);
      } 
      else if (['Total Allowance', 'Tax Allowance', 'Net Salary'].includes(item.komponen)) {
        const value = parseFloat(item.nilai) || 0;
        totalPayroll += value;
      }
      
      if (item.komponen === 'Net Salary') {
        const value = parseFloat(item.nilai) || 0;
        if (value > 0) {
          salaryValues.push(value);
        }
      }
    });

    const maxSalary = salaryValues.length > 0 ? Math.max(...salaryValues) : 0;
    const minSalary = salaryValues.length > 0 ? Math.min(...salaryValues) : 0;

    const result = {
      payrollEmployees: uniqueEmployees.size,
      payrollDepartments: uniqueDepartments.size,
      payrollAmount: Math.round(totalPayroll),
      maxSalary: Math.round(maxSalary),
      minSalary: Math.round(minSalary)
    };

    // Store in cache
    setCache(cacheKey, result);

    const duration = Date.now() - startTime;
    console.log(`[Payroll Stats] Completed in ${duration}ms`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching payroll stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll stats' },
      { status: 500 }
    );
  }
}