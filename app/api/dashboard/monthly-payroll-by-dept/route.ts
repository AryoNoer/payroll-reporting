/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// File: app/api/dashboard/monthly-payroll-by-dept/route.ts
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



    const components = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: {
        employeeNo: true,
        komponen: true,
        nilai: true,
        bulanReport: true
      }
    });

    const monthDeptMap = new Map<string, Map<string, string>>();

    for (const comp of components) {
      if (comp.komponen === 'Directorate') {
        const dept = comp.nilai;
        const monthKey = comp.bulanReport.toString().substring(0, 7);
        
        if (!monthDeptMap.has(monthKey)) {
          monthDeptMap.set(monthKey, new Map());
        }
        
        monthDeptMap.get(monthKey)!.set(`${comp.employeeNo}-dept`, dept);
      }     
    }

    const results = new Map<string, any>();

    for (const comp of components) {
      if (comp.komponen === 'Net Salary') {
        const monthKey = comp.bulanReport.toString().substring(0, 7);
        const deptData = monthDeptMap.get(monthKey);
        const dept = deptData?.get(`${comp.employeeNo}-dept`);
        
        if (!dept) continue;

        if (!results.has(monthKey)) {
          results.set(monthKey, {
            month: monthKey,
            departments: new Map<string, number>()
          });
        }

        const monthData = results.get(monthKey)!;
        const salary = parseFloat(comp.nilai) || 0;
        
        monthData.departments.set(
          dept,
          (monthData.departments.get(dept) || 0) + salary
        );
      }
    }

    const resultArray = Array.from(results.values()).map(item => {
      const deptObj: any = { month: item.month };
      item.departments.forEach((value: number, dept: string) => {
        deptObj[dept] = Math.round(value);
      });
      return deptObj;
    });

    resultArray.sort((a, b) => a.month.localeCompare(b.month));

    const departments = new Set<string>();
    resultArray.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'month') departments.add(key);
      });
    });

    return NextResponse.json({
      data: resultArray,
      departments: Array.from(departments)
    });

  } catch (error) {
    console.error('Error fetching monthly payroll by dept:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly payroll by department' },
      { status: 500 }
    );
  }
}