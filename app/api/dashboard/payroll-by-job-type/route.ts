/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// File: app/api/dashboard/payroll-by-job-type/route.ts
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

    const employeeNos = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: { employeeNo: true },
      distinct: ['employeeNo']
    });

    const employees = await prisma.employee.findMany({
      where: {
        employeeNo: {
          in: employeeNos.map(e => e.employeeNo)
        }
      },
      select: {
        employeeNo: true,
        grade: true
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

    const gradeMap = new Map(employees.map(e => [e.employeeNo, e.grade]));
    const jobTypeMap = new Map<string, number>();
    
    salaries.forEach(s => {
      const grade = gradeMap.get(s.employeeNo);
      if (!grade) return;
      
      let jobType = grade;
      if (grade.includes('Manager') || grade.includes('MANAGER')) {
        jobType = 'Marketing Manager';
      } else if (grade.includes('Sales') || grade.includes('SALES')) {
        jobType = 'Sales Man';
      } else if (grade.includes('Account') || grade.includes('ACCOUNT')) {
        jobType = 'Accountants';
      } else if (grade.includes('Engineer') || grade.includes('SOFTWARE')) {
        jobType = 'Software Engineers';
      }
      
      const salary = parseFloat(s.nilai) || 0;
      jobTypeMap.set(jobType, (jobTypeMap.get(jobType) || 0) + salary);
    });

    const result = Array.from(jobTypeMap.entries()).map(([name, value]) => ({
      name,
      value: Math.round(value)
    }));

    result.sort((a, b) => b.value - a.value);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching payroll by job type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll by job type' },
      { status: 500 }
    );
  }
}