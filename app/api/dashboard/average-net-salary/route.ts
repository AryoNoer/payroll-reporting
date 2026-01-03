// app/api/dashboard/average-net-salary/route.ts
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

function getPreviousMonth(year: string, month: string): { year: string; month: string } {
  const monthNum = parseInt(month);
  if (monthNum === 1) {
    return { year: String(parseInt(year) - 1), month: '12' };
  }
  return { year, month: String(monthNum - 1).padStart(2, '0') };
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

    // Build where condition for current month
    const whereConditionCurrent: any = { komponen: 'Net Salary' };
    
    if (year && year !== '(All)') {
      if (month && month !== '(All)') {
        whereConditionCurrent.AND = [
          { bulanReport: { contains: `-${getMonthName(month)}-` } },
          { bulanReport: { contains: year } }
        ];
      } else {
        whereConditionCurrent.bulanReport = { contains: year };
      }
    } else if (month && month !== '(All)') {
      whereConditionCurrent.bulanReport = { contains: `-${getMonthName(month)}-` };
    }

    // Get current month data
    const currentSalaries = await prisma.employeeComponent.findMany({
      where: whereConditionCurrent,
      select: {
        employeeNo: true,
        nilai: true,
      },
    });

    // Get directorate for each employee
    const employeeNos = [...new Set(currentSalaries.map(s => s.employeeNo))];
    const directorates = await prisma.employeeComponent.findMany({
      where: {
        employeeNo: { in: employeeNos },
        komponen: 'Directorate',
      },
      select: {
        employeeNo: true,
        nilai: true,
      },
    });

    const directorateMap = new Map(directorates.map(d => [d.employeeNo, d.nilai]));

    // Calculate average salary by department for current month
    const deptSalaryMap = new Map<string, { total: number; count: number }>();
    
    currentSalaries.forEach(s => {
      const dept = directorateMap.get(s.employeeNo) || 'Unknown';
      const salary = parseFloat(s.nilai) || 0;
      
      if (!deptSalaryMap.has(dept)) {
        deptSalaryMap.set(dept, { total: 0, count: 0 });
      }
      
      const current = deptSalaryMap.get(dept)!;
      current.total += salary;
      current.count += 1;
    });

    const currentResult = Array.from(deptSalaryMap.entries()).map(([department, data]) => ({
      department,
      avgSalary: Math.round(data.total / data.count),
    }));

    // Calculate previous month if specific month is selected
    let previousResult: any[] = [];
    
    if (year && year !== '(All)' && month && month !== '(All)') {
      const prev = getPreviousMonth(year, month);
      
      const whereConditionPrevious: any = {
        komponen: 'Net Salary',
        AND: [
          { bulanReport: { contains: `-${getMonthName(prev.month)}-` } },
          { bulanReport: { contains: prev.year } }
        ],
      };

      const previousSalaries = await prisma.employeeComponent.findMany({
        where: whereConditionPrevious,
        select: {
          employeeNo: true,
          nilai: true,
        },
      });

      const prevDeptSalaryMap = new Map<string, { total: number; count: number }>();
      
      previousSalaries.forEach(s => {
        const dept = directorateMap.get(s.employeeNo) || 'Unknown';
        const salary = parseFloat(s.nilai) || 0;
        
        if (!prevDeptSalaryMap.has(dept)) {
          prevDeptSalaryMap.set(dept, { total: 0, count: 0 });
        }
        
        const current = prevDeptSalaryMap.get(dept)!;
        current.total += salary;
        current.count += 1;
      });

      previousResult = Array.from(prevDeptSalaryMap.entries()).map(([department, data]) => ({
        department,
        avgSalary: Math.round(data.total / data.count),
      }));
    }

    return NextResponse.json({
      current: currentResult,
      previous: previousResult,
    });

  } catch (error) {
    console.error('Error fetching average net salary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch average net salary' },
      { status: 500 }
    );
  }
}