// app/api/dashboard/payroll-by-department/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const deptCache = new Map<string, { data: any; timestamp: number }>();
const DEPT_CACHE_DURATION = 10 * 60 * 1000;

function getDeptCacheKey(year: string | null, month: string | null): string {
  return `dept-${year || 'all'}-${month || 'all'}`;
}

function getMonthName(monthNum: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(monthNum) - 1];
}

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

    const cacheKey = getDeptCacheKey(year, month);
    const cached = deptCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DEPT_CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

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

    console.time('Query-PayrollByDept');

    const records = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: { data: true },
    });

    console.timeEnd('Query-PayrollByDept');

    // Aggregate by Directorate
    const deptMap = new Map<string, number>();

    records.forEach(record => {
      const d = record.data as any;
      const directorate = d['Directorate'] || 'Unknown';
      const netSalary = parseFloat(d['Net Salary'] || '0') || 0;

      if (netSalary > 0) {
        deptMap.set(directorate, (deptMap.get(directorate) || 0) + netSalary);
      }
    });

    const result = Array.from(deptMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    deptCache.set(cacheKey, { data: result, timestamp: Date.now() });
    if (deptCache.size > 100) {
      const oldestKey = deptCache.keys().next().value;
      if (oldestKey) deptCache.delete(oldestKey);
    }

    const duration = Date.now() - startTime;
    console.log(`[PayrollByDept API] ${result.length} departments in ${duration}ms`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching payroll by department:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll by department' },
      { status: 500 }
    );
  }
}