/* eslint-disable @typescript-eslint/no-explicit-any */
// API 1: Payroll Stats (Top Metrics)
// File: app/api/dashboard/payroll-stats/route.ts
// ============================================================================
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';



// Helper function untuk convert "01" -> "Jan"
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


    const employeeCount = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: { employeeNo: true },
      distinct: ['employeeNo']
    });

    const departments = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        komponen: 'Directorate'
      },
      select: { nilai: true },
      distinct: ['nilai']
    });

    const payrollComponents = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        komponen: {
          in: ['Total Allowance', 'Tax Allowance', 'Net Salary']
        }
      },
      select: {
        nilai: true,
        komponen: true
      }
    });

    const totalPayroll = payrollComponents.reduce((sum, item) => {
      const value = parseFloat(item.nilai) || 0;
      return sum + value;
    }, 0);

    const salaries = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        komponen: 'Net Salary'
      },
      select: { nilai: true }
    });

    const salaryValues = salaries.map(s => parseFloat(s.nilai) || 0);
    const maxSalary = salaryValues.length > 0 ? Math.max(...salaryValues) : 0;
    const minSalary = salaryValues.length > 0 ? Math.min(...salaryValues) : 0;

    return NextResponse.json({
      payrollEmployees: employeeCount.length,
      payrollDepartments: departments.length,
      payrollAmount: totalPayroll,
      maxSalary,
      minSalary
    });

  } catch (error) {
    console.error('Error fetching payroll stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll stats' },
      { status: 500 }
    );
  }
}