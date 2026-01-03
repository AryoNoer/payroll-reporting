/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// File: app/api/dashboard/employees-by-salary-range/route.ts
// ============================================================================


// Helper function untuk convert "01" -> "Jan"
function getMonthName(monthNum: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(monthNum) - 1];
}
export async function GET (request: Request) {
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
    // Filter: "31-Jan-2025" contains both "-Jan-" and "2025"
    whereCondition.AND = [
      { bulanReport: { contains: `-${getMonthName(month)}-` } },
      { bulanReport: { contains: year } }
    ];
  } else {
    // Filter year only: "2025"
    whereCondition.bulanReport = {
      contains: year
    };
  }
} else if (month && month !== '(All)') {
  // Filter month only: "-Jan-"
  whereCondition.bulanReport = {
    contains: `-${getMonthName(month)}-`
  };
}

    const employeesWithDept = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        komponen: 'Directorate'
      },
      select: {
        employeeNo: true,
        nilai: true
      }
    });

    const salaries = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        komponen: 'Net Salary'
      },
      select: {
        employeeNo: true,
        nilai: true
      }
    });

    const deptMap = new Map(employeesWithDept.map(e => [e.employeeNo, e.nilai]));
    
    const ranges = [
      { name: 'between 20,000-30,000', min: 20000, max: 30000, key: 'range1' },
      { name: 'between 30,000-450,000', min: 30000, max: 450000, key: 'range2' },
      { name: 'More then 90,000', min: 90000, max: Infinity, key: 'range3' }
    ];

    const deptRangeMap = new Map<string, any>();

    salaries.forEach(s => {
      const salary = parseFloat(s.nilai) || 0;
      const dept = deptMap.get(s.employeeNo);
      
      if (!dept) return;

      if (!deptRangeMap.has(dept)) {
        deptRangeMap.set(dept, {
          department: dept,
          range1: 0,
          range2: 0,
          range3: 0
        });
      }

      const deptData = deptRangeMap.get(dept);
      
      for (const range of ranges) {
        if (salary >= range.min && salary < range.max) {
          deptData[range.key]++;
          break;
        }
      }
    });

    const result = Array.from(deptRangeMap.values());

    return NextResponse.json({
      data: result,
      ranges: ranges.map(r => ({ key: r.key, name: r.name }))
    });

  } catch (error) {
    console.error('Error fetching employees by salary range:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees by salary range' },
      { status: 500 }
    );
  }
}
