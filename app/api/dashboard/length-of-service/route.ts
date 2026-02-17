// app/api/dashboard/length-of-service/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const losCache = new Map<string, { data: any; timestamp: number }>();
const LOS_CACHE_DURATION = 10 * 60 * 1000;

function getLosCacheKey(year: string | null, month: string | null): string {
  return `los-${year || 'all'}-${month || 'all'}`;
}

function getMonthName(monthNum: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(monthNum) - 1];
}

function parseServiceYears(serviceString: string): number {
  try {
    const cleaned = serviceString.trim().toLowerCase();

    if (cleaned === 'information' || cleaned === 'prior' || cleaned.length < 3) {
      return 0;
    }

    const yearMatch = cleaned.match(/(\d+)\s*year/);
    const monthMatch = cleaned.match(/(\d+)\s*month/);

    let totalYears = 0;

    if (yearMatch) totalYears += parseInt(yearMatch[1]);
    if (monthMatch) totalYears += parseInt(monthMatch[1]) / 12;

    if (totalYears === 0) {
      const numberMatch = cleaned.match(/(\d+\.?\d*)/);
      if (numberMatch) totalYears = parseFloat(numberMatch[1]);
    }

    return (totalYears > 0 && totalYears <= 60) ? totalYears : 0;
  } catch {
    return 0;
  }
}

function getServiceRange(years: number): string {
  if (years < 1) return '< 1 year';
  if (years < 3) return '1-2 years';
  if (years < 5) return '3-4 years';
  if (years < 10) return '5-9 years';
  if (years < 15) return '10-14 years';
  if (years < 20) return '15-19 years';
  return '20+ years';
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

    const cacheKey = getLosCacheKey(year, month);
    const cached = losCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < LOS_CACHE_DURATION) {
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

    console.time('Query-LOS');

    const records = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: { employeeNo: true, data: true },
      distinct: ['employeeNo'],
    });

    console.timeEnd('Query-LOS');

    const serviceRanges = ['< 1 year', '1-2 years', '3-4 years', '5-9 years', '10-14 years', '15-19 years', '20+ years'];
    const serviceRangeMap = new Map<string, number>();
    serviceRanges.forEach(range => serviceRangeMap.set(range, 0));

    let processedCount = 0;

    records.forEach(record => {
      const d = record.data as any;
      const los = d['Length of Service'] || d['Length Of Service'] || '';

      if (los) {
        const years = parseServiceYears(los);
        if (years > 0) {
          const range = getServiceRange(years);
          serviceRangeMap.set(range, (serviceRangeMap.get(range) || 0) + 1);
          processedCount++;
        }
      }
    });

    console.log(`[LOS] Processed: ${processedCount}/${records.length}`);

    const result = serviceRanges.map(range => ({
      range,
      count: serviceRangeMap.get(range) || 0,
    }));

    losCache.set(cacheKey, { data: result, timestamp: Date.now() });
    if (losCache.size > 100) {
      const oldestKey = losCache.keys().next().value;
      if (oldestKey) losCache.delete(oldestKey);
    }

    const duration = Date.now() - startTime;
    console.log(`[LOS API] Completed in ${duration}ms`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching length of service:', error);
    return NextResponse.json(
      { error: 'Failed to fetch length of service' },
      { status: 500 }
    );
  }
}