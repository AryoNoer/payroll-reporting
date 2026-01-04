/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Caching
const ageCache = new Map<string, { data: any; timestamp: number }>();
const AGE_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (age data changes less frequently)

function getAgeCacheKey(year: string | null, month: string | null): string {
  return `age-${year || 'all'}-${month || 'all'}`;
}

function getMonthName(monthNum: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(monthNum) - 1];
}

function calculateAge(birthDate: string): number {
  try {
    const cleanedDate = birthDate.trim();
    let date: Date;
    
    if (cleanedDate.includes('/') || cleanedDate.includes('-')) {
      const parts = cleanedDate.split(/[/-]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        date = new Date(year, month, day);
      } else {
        date = new Date(cleanedDate);
      }
    } else {
      date = new Date(cleanedDate);
    }
    
    if (isNaN(date.getTime())) return 0;
    
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    
    if (age < 18 || age > 100) return 0;
    
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
    const cacheKey = getAgeCacheKey(year, month);
    const cached = ageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < AGE_CACHE_DURATION) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return NextResponse.json(cached.data);
    }

    const whereCondition: any = { komponen: 'Birth Date' };

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

    console.time('Query-Age');
    
    const birthDates = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: {
        employeeNo: true,
        remark: true,
      },
      distinct: ['employeeNo'],
    });
    
    console.timeEnd('Query-Age');

    const ageRangeMap = new Map<string, number>();
    const ageRanges = ['< 25', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60+'];
    
    ageRanges.forEach(range => ageRangeMap.set(range, 0));

    birthDates.forEach(item => {
      if (item.remark && item.remark.trim() !== '') {
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

    // Cache result
    ageCache.set(cacheKey, { data: result, timestamp: Date.now() });
    if (ageCache.size > 100) {
      const oldestKey = ageCache.keys().next().value;
      if (oldestKey) {
        ageCache.delete(oldestKey);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Age API] Completed in ${duration}ms`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching employee age distribution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee age distribution' },
      { status: 500 }
    );
  }
}