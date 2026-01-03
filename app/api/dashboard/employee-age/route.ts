// app/api/dashboard/employee-age/route.ts
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

function calculateAge(birthDate: string): number {
  try {
    // Parse date in various formats
    const date = new Date(birthDate);
    if (isNaN(date.getTime())) return 0;
    
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    
    return age;
  } catch {
    return 0;
  }
}

function getAgeRange(age: number): string {
  if (age < 25) return '< 25';
  if (age < 30) return '25-29';
  if (age < 35) return '30-34';
  if (age < 40) return '35-39';
  if (age < 45) return '40-44';
  if (age < 50) return '45-49';
  if (age < 55) return '50-54';
  if (age < 60) return '55-59';
  return '60+';
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

    // Get birth dates from remarks of Birth Date component
    const birthDates = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        komponen: 'Birth Date',
      },
      select: {
        employeeNo: true,
        remark: true, // Birth date is stored in remarks
      },
      distinct: ['employeeNo'],
    });

    console.log(`[Age API] Found ${birthDates.length} employees with birth dates`);

    // Calculate age ranges
    const ageRangeMap = new Map<string, number>();
    const ageRanges = ['< 25', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60+'];
    
    // Initialize all ranges with 0
    ageRanges.forEach(range => ageRangeMap.set(range, 0));

    birthDates.forEach(item => {
      if (item.remark) {
        const age = calculateAge(item.remark);
        if (age > 0) {
          const range = getAgeRange(age);
          ageRangeMap.set(range, (ageRangeMap.get(range) || 0) + 1);
        }
      }
    });

    const result = ageRanges.map(range => ({
      ageRange: range,
      count: ageRangeMap.get(range) || 0,
    }));

    console.log('[Age API] Result:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching employee age distribution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee age distribution' },
      { status: 500 }
    );
  }
}