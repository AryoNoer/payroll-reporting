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

    // Get unique employee numbers from the filtered period
    const employeeNos = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: { employeeNo: true },
      distinct: ['employeeNo']
    });

    const employeeNoList = employeeNos.map(e => e.employeeNo);

    // Get Directorate for filtering
    const directorates = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        employeeNo: { in: employeeNoList },
        komponen: 'Directorate',
      },
      select: {
        employeeNo: true,
        nilai: true,
      },
    });

    const directorateMap = new Map(directorates.map(d => [d.employeeNo, d.nilai]));

    // Filter employees by directorate if specified
    let filteredEmployeeList = employeeNoList;
    if (directorate && directorate !== '(All)') {
      filteredEmployeeList = employeeNoList.filter(empNo => 
        directorateMap.get(empNo) === directorate
      );
    }

    // Get Grade (nilai field) for these employees
    const grades = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        employeeNo: { in: filteredEmployeeList },
        komponen: 'Grade',
      },
      select: {
        employeeNo: true,
        nilai: true, // Using nilai field for grade value
      },
    });

    // Get Net Salary for these employees
    const salaries = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        employeeNo: { in: filteredEmployeeList },
        komponen: 'Net Salary',
      },
      select: {
        employeeNo: true,
        nilai: true,
      },
    });

    // Create maps
    const gradeMap = new Map(grades.map(g => [g.employeeNo, g.nilai || 'Unknown']));
    const gradePayrollMap = new Map<string, number>();
    
    salaries.forEach(s => {
      const grade = gradeMap.get(s.employeeNo) || 'Unknown';
      const salary = parseFloat(s.nilai) || 0;
      gradePayrollMap.set(grade, (gradePayrollMap.get(grade) || 0) + salary);
    });

    const result = Array.from(gradePayrollMap.entries()).map(([name, value]) => ({
      name,
      value: Math.round(value),
    }));

     // Cache result
    jobTypeCache.set(cacheKey, { data: result, timestamp: Date.now() });
    if (jobTypeCache.size > 100) {
      const oldestKey = jobTypeCache.keys().next().value;
      if (oldestKey) {
        jobTypeCache.delete(oldestKey);
      }
    }

    result.sort((a, b) => b.value - a.value);

    // Get list of all directorates for filter dropdown
    const allDirectorates = [...new Set(Array.from(directorateMap.values()))]
      .filter(d => d && d.trim() !== '')
      .sort();

    return NextResponse.json({
      data: result,
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