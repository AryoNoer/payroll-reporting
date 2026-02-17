// app/api/dashboard/average-net-salary/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

function getCacheKey(year: string | null, month: string | null): string {
  return `avg-salary-${year || 'all'}-${month || 'all'}`;
}

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

function buildWhereCondition(year: string | null, month: string | null): any {
  const where: any = {};
  if (year && year !== '(All)') {
    if (month && month !== '(All)') {
      where.AND = [
        { bulanReport: { contains: `-${getMonthName(month)}-` } },
        { bulanReport: { contains: year } }
      ];
    } else {
      where.bulanReport = { contains: year };
    }
  } else if (month && month !== '(All)') {
    where.bulanReport = { contains: `-${getMonthName(month)}-` };
  }
  return where;
}

function processRecords(records: any[]): { department: string; avgSalary: number }[] {
  const deptSalaryMap = new Map<string, { total: number; count: number }>();

  records.forEach(record => {
    const d = record.data as any;
    const dept = d['Directorate'] || 'Unknown';
    const salary = parseFloat(d['Net Salary'] || '0') || 0;

    if (salary <= 0) return;

    if (!deptSalaryMap.has(dept)) {
      deptSalaryMap.set(dept, { total: 0, count: 0 });
    }
    const current = deptSalaryMap.get(dept)!;
    current.total += salary;
    current.count += 1;
  });

  return Array.from(deptSalaryMap.entries()).map(([department, data]) => ({
    department,
    avgSalary: Math.round(data.total / data.count),
  }));
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

    const cacheKey = getCacheKey(year, month);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // Current period
    const whereCondition = buildWhereCondition(year, month);

    console.time('Query-AvgSalary');
    const currentRecords = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: { data: true },
    });
    console.timeEnd('Query-AvgSalary');

    const currentResult = processRecords(currentRecords);

    // Previous period (if specific month selected)
    let previousResult: any[] = [];

    if (year && year !== '(All)' && month && month !== '(All)') {
      const prev = getPreviousMonth(year, month);
      const prevWhere = buildWhereCondition(prev.year, prev.month);

      const prevRecords = await prisma.employeeComponent.findMany({
        where: prevWhere,
        select: { data: true },
      });

      previousResult = processRecords(prevRecords);
    }

    // Add percentage change
    const previousMap = new Map(previousResult.map(p => [p.department, p.avgSalary]));

    const resultWithChange = currentResult.map(item => {
      const prevAvg = previousMap.get(item.department) || 0;
      const percentageChange = prevAvg > 0
        ? Math.round(((item.avgSalary - prevAvg) / prevAvg) * 10000) / 100
        : 0;

      return {
        ...item,
        previousAvgSalary: prevAvg,
        percentageChange,
      };
    });

    const responseData = {
      current: resultWithChange,
      previous: previousResult,
    };

    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }

    const duration = Date.now() - startTime;
    console.log(`[AvgSalary API] Completed in ${duration}ms`);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching average net salary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch average net salary' },
      { status: 500 }
    );
  }
}