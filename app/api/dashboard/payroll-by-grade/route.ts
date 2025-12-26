/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// API 7: Payroll Summary By Grade (Chart 6)
// File: app/api/dashboard/payroll-by-grade/route.ts
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
    
    const normalizeGrade = (grade: string): string => {
      const upper = grade.toUpperCase();
      if (upper.includes('A')) return 'A';
      if (upper.includes('B')) return 'B';
      if (upper.includes('E')) return 'E';
      if (upper.includes('F')) return 'F';
      return grade;
    };

    const gradePayrollMap = new Map<string, number>();
    
    salaries.forEach(s => {
      const grade = gradeMap.get(s.employeeNo);
      if (!grade) return;
      
      const normalizedGrade = normalizeGrade(grade);
      const salary = parseFloat(s.nilai) || 0;
      
      gradePayrollMap.set(
        normalizedGrade,
        (gradePayrollMap.get(normalizedGrade) || 0) + salary
      );
    });

    const result = Array.from(gradePayrollMap.entries()).map(([grade, value]) => ({
      grade,
      value: Math.round(value)
    }));

    const gradeOrder = ['F', 'B', 'A', 'E'];
    result.sort((a, b) => {
      const indexA = gradeOrder.indexOf(a.grade);
      const indexB = gradeOrder.indexOf(b.grade);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching payroll by grade:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll by grade' },
      { status: 500 }
    );
  }
}