// app/api/dashboard/payroll-by-job-type/route.ts
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

    // Get unique employee numbers from the filtered period
    const employeeNos = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: { employeeNo: true },
      distinct: ['employeeNo']
    });

    const employeeNoList = employeeNos.map(e => e.employeeNo);

    // Get Grade (remarks) for these employees
    const grades = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        employeeNo: { in: employeeNoList },
        komponen: 'Grade',
      },
      select: {
        employeeNo: true,
        remark: true, // Using remarks field for grade
      },
    });

    // Get Net Salary for these employees
    const salaries = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        employeeNo: { in: employeeNoList },
        komponen: 'Net Salary',
      },
      select: {
        employeeNo: true,
        nilai: true,
      },
    });

    // Create maps
    const gradeMap = new Map(grades.map(g => [g.employeeNo, g.remark || 'Unknown']));
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