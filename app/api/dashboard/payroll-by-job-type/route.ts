// app/api/dashboard/payroll-by-job-type/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const jobTypeCache = new Map<string, { data: any; timestamp: number }>();
const JOB_TYPE_CACHE_DURATION = 10 * 60 * 1000;

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

    const cacheKey = getJobTypeCacheKey(year, month);
    const cached = jobTypeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < JOB_TYPE_CACHE_DURATION) {
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

    console.time('Query-JobType');

    const records = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: { data: true },
    });

    console.timeEnd('Query-JobType');

    // Process in memory
    const gradePayrollMap = new Map<string, number>();
    const deptGradeMap = new Map<string, Map<string, number>>();
    const allDirectorates = new Set<string>();

    records.forEach(record => {
      const d = record.data as any;
      const grade = d['Grade'] || 'Unknown';
      const dept = d['Directorate'] || 'Unknown';
      const salary = parseFloat(d['Net Salary'] || '0') || 0;

      if (salary <= 0) return;

      if (dept && dept.trim()) allDirectorates.add(dept);

      // Overall by grade
      gradePayrollMap.set(grade, (gradePayrollMap.get(grade) || 0) + salary);

      // Per directorate by grade
      if (!deptGradeMap.has(dept)) {
        deptGradeMap.set(dept, new Map());
      }
      deptGradeMap.get(dept)!.set(grade, (deptGradeMap.get(dept)!.get(grade) || 0) + salary);
    });

    const allResult = Array.from(gradePayrollMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    const deptResults: Record<string, { name: string; value: number }[]> = {};
    deptGradeMap.forEach((grades, dept) => {
      deptResults[dept] = Array.from(grades.entries())
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value);
    });

    const directoratesList = [...allDirectorates].filter(d => d.trim()).sort();

    jobTypeCache.set(cacheKey, {
      data: { allData: allResult, filteredByDirectorate: deptResults, directorates: directoratesList },
      timestamp: Date.now(),
    });
    if (jobTypeCache.size > 100) {
      const oldestKey = jobTypeCache.keys().next().value;
      if (oldestKey) jobTypeCache.delete(oldestKey);
    }

    let resultData = allResult;
    if (directorate && directorate !== '(All)') {
      resultData = deptResults[directorate] || [];
    }

    const duration = Date.now() - startTime;
    console.log(`[JobType API] Completed in ${duration}ms`);

    return NextResponse.json({
      data: resultData,
      directorates: directoratesList,
    });

  } catch (error) {
    console.error('Error fetching payroll by job type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll by job type' },
      { status: 500 }
    );
  }
}