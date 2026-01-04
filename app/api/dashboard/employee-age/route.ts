/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Caching
const ageCache = new Map<string, { data: any; timestamp: number }>();
const AGE_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

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
    console.log('Calculating age for:', cleanedDate); // Debug log
    
    let date: Date;
    
    // Handle format: "1995-11-22 00:00:00" or "1995-11-22"
    if (cleanedDate.includes('-')) {
      // Split by space first to remove time part
      const datePart = cleanedDate.split(' ')[0];
      const parts = datePart.split('-');
      
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
        const day = parseInt(parts[2]);
        date = new Date(year, month, day);
      } else {
        date = new Date(cleanedDate);
      }
    } 
    // Handle format: "22/11/1995" or "22-11-1995"
    else if (cleanedDate.includes('/')) {
      const parts = cleanedDate.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        date = new Date(year, month, day);
      } else {
        date = new Date(cleanedDate);
      }
    } 
    else {
      date = new Date(cleanedDate);
    }
    
    if (isNaN(date.getTime())) {
      console.log('Invalid date:', cleanedDate);
      return 0;
    }
    
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    
    // Validate age range (18-100)
    if (age < 18 || age > 100) {
      console.log('Age out of range:', age, 'for date:', cleanedDate);
      return 0;
    }
    
    console.log('Calculated age:', age); // Debug log
    return age;
  } catch (error) {
    console.error('Error calculating age:', error);
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
    console.log('WHERE condition:', JSON.stringify(whereCondition, null, 2));
    
    const birthDates = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: {
        employeeNo: true,
        remark: true,
      },
      distinct: ['employeeNo'],
    });
    
    console.timeEnd('Query-Age');
    console.log('Total birth date records fetched:', birthDates.length);

    const ageRangeMap = new Map<string, number>();
    const ageRanges = ['< 25', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60+'];
    
    ageRanges.forEach(range => ageRangeMap.set(range, 0));

    let processedCount = 0;
    let skippedCount = 0;

    birthDates.forEach(item => {
      if (item.remark && item.remark.trim() !== '') {
        const age = calculateAge(item.remark);
        if (age > 0) {
          const range = getAgeRange(age);
          ageRangeMap.set(range, (ageRangeMap.get(range) || 0) + 1);
          processedCount++;
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    });

    console.log('Processed:', processedCount, 'Skipped:', skippedCount);
    console.log('Age range distribution:', Object.fromEntries(ageRangeMap));

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