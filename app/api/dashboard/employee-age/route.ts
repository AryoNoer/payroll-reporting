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

    // Skip if it's "Information" or other placeholder text
    if (cleanedDate.toLowerCase() === 'information' ||
      cleanedDate.toLowerCase() === 'prior' ||
      cleanedDate.length < 4) {
      return 0;
    }

    let date: Date;

    // ✅ Handle Excel serial number dates (e.g., "26252" = days since 1899-12-30)
    if (/^\d{4,5}$/.test(cleanedDate)) {
      const serialNum = parseInt(cleanedDate);
      // Excel epoch is Dec 30, 1899 (accounting for the Excel leap year bug)
      const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
      date = new Date(excelEpoch.getTime() + serialNum * 86400000);
    }
    // Handle format: "1995-11-22 00:00:00" or "1995-11-22"
    else if (cleanedDate.includes('-')) {
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
    // Handle format: "22/11/1995" or "DD/MM/YYYY"
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
      return 0;
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

    // Fetch all possible columns that might contain birth date
    const birthDates = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: {
        employeeNo: true,
        nilai: true,   // This might contain the actual date
        remark: true,
        remark2: true,
        remark3: true,
      },
      distinct: ['employeeNo'],
    });

    console.timeEnd('Query-Age');
    console.log('Total birth date records fetched:', birthDates.length);

    // Debug: Log first 3 records to see the data structure
    if (birthDates.length > 0) {
      console.log('Sample records:', JSON.stringify(birthDates.slice(0, 3), null, 2));
    }

    const ageRangeMap = new Map<string, number>();
    const ageRanges = ['< 25', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60+'];

    ageRanges.forEach(range => ageRangeMap.set(range, 0));

    let processedCount = 0;
    let skippedCount = 0;

    birthDates.forEach(item => {
      // Try multiple columns in order of priority
      const dateFields = [item.nilai, item.remark, item.remark2, item.remark3];

      let age = 0;
      for (const field of dateFields) {
        if (field && field.trim() !== '' && field.toLowerCase() !== 'information') {
          age = calculateAge(field);
          if (age > 0) {
            break; // Found valid age, stop checking other fields
          }
        }
      }

      if (age > 0) {
        const range = getAgeRange(age);
        ageRangeMap.set(range, (ageRangeMap.get(range) || 0) + 1);
        processedCount++;
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