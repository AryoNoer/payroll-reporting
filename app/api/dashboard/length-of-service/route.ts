// app/api/dashboard/length-of-service/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function getMonthName(monthNum: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(monthNum) - 1];
}

function parseServiceYears(serviceString: string): number {
  try {
    // Try to extract number from strings like "5 years", "10.5 years", etc.
    const match = serviceString.match(/(\d+\.?\d*)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return 0;
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
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

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

    // Get length of service from remarks
    const serviceData = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        komponen: 'Length Of Service',
      },
      select: {
        employeeNo: true,
        remark: true, // Length of service is stored in remarks
      },
      distinct: ['employeeNo'],
    });

    console.log(`[Length of Service API] Found ${serviceData.length} employees`);

    // Calculate service ranges
    const serviceRangeMap = new Map<string, number>();
    const serviceRanges = ['< 1 year', '1-2 years', '3-4 years', '5-9 years', '10-14 years', '15-19 years', '20+ years'];
    
    // Initialize all ranges with 0
    serviceRanges.forEach(range => serviceRangeMap.set(range, 0));

    serviceData.forEach(item => {
      if (item.remark) {
        const years = parseServiceYears(item.remark);
        if (years >= 0) {
          const range = getServiceRange(years);
          serviceRangeMap.set(range, (serviceRangeMap.get(range) || 0) + 1);
        }
      }
    });

    const result = serviceRanges.map(range => ({
      range,
      count: serviceRangeMap.get(range) || 0,
    }));

    console.log('[Length of Service API] Result:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching length of service:', error);
    return NextResponse.json(
      { error: 'Failed to fetch length of service' },
      { status: 500 }
    );
  }
}