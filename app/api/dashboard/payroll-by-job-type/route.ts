// app/api/dashboard/payroll-by-job-type/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Caching
const jobTypeCache = new Map<string, { data: any; timestamp: number }>();
const JOB_TYPE_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function getJobTypeCacheKey(year: string | null, month: string | null): string {
  return `job-type-${year || 'all'}-${month || 'all'}`;
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
    const directorate = searchParams.get('directorate');

    // Check cache
    const cacheKey = getJobTypeCacheKey(year, month);
    const cached = jobTypeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < JOB_TYPE_CACHE_DURATION) {
      console.log(`[Cache HIT] ${cacheKey}`);
      // Apply directorate filter to cached data if needed
      if (directorate && directorate !== '(All)') {
        return NextResponse.json({
          data: cached.data.filteredByDirectorate?.[directorate] || [],
          directorates: cached.data.directorates || [],
        });
      }
      return NextResponse.json({
        data: cached.data.allData || [],
        directorates: cached.data.directorates || [],
      });
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

    // ✅ OPTIMIZED: Single query instead of 4 separate queries
    console.time('Query-JobType-Combined');
    const allData = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        OR: [
          { komponen: 'Grade' },
          { komponen: 'Net Salary' },
          { komponen: 'Directorate' },
        ],
      },
      select: {
        employeeNo: true,
        komponen: true,
        nilai: true,
      },
    });
    console.timeEnd('Query-JobType-Combined');

    // ✅ Process in memory (much faster than multiple DB round-trips)
    const gradeMap = new Map<string, string>();
    const salaryMap = new Map<string, number>();
    const directorateMap = new Map<string, string>();

    allData.forEach(item => {
      if (item.komponen === 'Grade') {
        gradeMap.set(item.employeeNo, item.nilai || 'Unknown');
      } else if (item.komponen === 'Net Salary') {
        salaryMap.set(item.employeeNo, parseFloat(item.nilai) || 0);
      } else if (item.komponen === 'Directorate') {
        directorateMap.set(item.employeeNo, item.nilai);
      }
    });

    // Build grade payroll data for all directorates
    const gradePayrollMap = new Map<string, number>();
    const filteredByDirectorate: Record<string, { name: string; value: number }[]> = {};

    salaryMap.forEach((salary, employeeNo) => {
      const grade = gradeMap.get(employeeNo) || 'Unknown';
      const dept = directorateMap.get(employeeNo) || 'Unknown';

      // Overall
      gradePayrollMap.set(grade, (gradePayrollMap.get(grade) || 0) + salary);

      // Per directorate
      if (!filteredByDirectorate[dept]) {
        filteredByDirectorate[dept] = [];
      }
    });

    // Build per-directorate results for caching
    const deptGradeMap = new Map<string, Map<string, number>>();
    salaryMap.forEach((salary, employeeNo) => {
      const grade = gradeMap.get(employeeNo) || 'Unknown';
      const dept = directorateMap.get(employeeNo) || 'Unknown';

      if (!deptGradeMap.has(dept)) {
        deptGradeMap.set(dept, new Map());
      }
      const gradeMap2 = deptGradeMap.get(dept)!;
      gradeMap2.set(grade, (gradeMap2.get(grade) || 0) + salary);
    });

    const deptResults: Record<string, { name: string; value: number }[]> = {};
    deptGradeMap.forEach((grades, dept) => {
      deptResults[dept] = Array.from(grades.entries())
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value);
    });

    const allResult = Array.from(gradePayrollMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    const allDirectorates = [...new Set(Array.from(directorateMap.values()))]
      .filter(d => d && d.trim() !== '')
      .sort();

    // Cache with per-directorate breakdowns
    jobTypeCache.set(cacheKey, {
      data: { allData: allResult, filteredByDirectorate: deptResults, directorates: allDirectorates },
      timestamp: Date.now(),
    });
    if (jobTypeCache.size > 100) {
      const oldestKey = jobTypeCache.keys().next().value;
      if (oldestKey) jobTypeCache.delete(oldestKey);
    }

    // Return filtered result
    let resultData = allResult;
    if (directorate && directorate !== '(All)') {
      resultData = deptResults[directorate] || [];
    }

    const duration = Date.now() - startTime;
    console.log(`[JobType API] Completed in ${duration}ms`);

    return NextResponse.json({
      data: resultData,
      directorates: allDirectorates,
    });

  } catch (error) {
    console.error('Error fetching payroll by job type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll by job type' },
      { status: 500 }
    );
  }
}