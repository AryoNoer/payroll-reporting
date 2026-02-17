// app/api/dashboard/payroll-stats/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Caching
const statsCache = new Map<string, { data: any; timestamp: number }>();
const STATS_CACHE_DURATION = 5 * 60 * 1000;

function getStatsCacheKey(year: string | null, month: string | null): string {
  return `stats-${year || 'all'}-${month || 'all'}`;
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

    const cacheKey = getStatsCacheKey(year, month);
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < STATS_CACHE_DURATION) {
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

    console.time('Query-PayrollStats');

    // ✅ Single query — all data is in JSON `data` column
    const records = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: { data: true },
    });

    console.timeEnd('Query-PayrollStats');

    // Process in memory
    let totalEmployees = records.length;
    let totalNetSalary = 0;
    let totalAllowance = 0;
    let totalTaxAllowance = 0;

    records.forEach(record => {
      const d = record.data as any;
      totalNetSalary += parseFloat(d['Net Salary'] || '0') || 0;
      totalAllowance += parseFloat(d['Total Allowance'] || '0') || 0;
      totalTaxAllowance += parseFloat(d['Tax Allowance'] || '0') || 0;
    });

    const result = {
      totalEmployees,
      totalNetSalary: Math.round(totalNetSalary),
      totalAllowance: Math.round(totalAllowance),
      totalTaxAllowance: Math.round(totalTaxAllowance),
      averageNetSalary: totalEmployees > 0 ? Math.round(totalNetSalary / totalEmployees) : 0,
    };

    statsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    if (statsCache.size > 100) {
      const oldestKey = statsCache.keys().next().value;
      if (oldestKey) statsCache.delete(oldestKey);
    }

    const duration = Date.now() - startTime;
    console.log(`[PayrollStats API] ${totalEmployees} employees in ${duration}ms`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching payroll stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll stats' },
      { status: 500 }
    );
  }
}