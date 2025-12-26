/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/api/dashboard/payroll-by-department/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const salaryMap = new Map(
      salaries.map(s => [s.employeeNo, parseFloat(s.nilai) || 0])
    );

    const deptMap = new Map<string, number>();
    
    employeesWithDept.forEach(emp => {
      const dept = emp.nilai;
      const salary = salaryMap.get(emp.employeeNo) || 0;
      deptMap.set(dept, (deptMap.get(dept) || 0) + salary);
    });

    const result = Array.from(deptMap.entries()).map(([name, value]) => ({
      name,
      value: Math.round(value)
    }));

    result.sort((a, b) => b.value - a.value);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching payroll by department:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll by department' },
      { status: 500 }
    );
  }
}