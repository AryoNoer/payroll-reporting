/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
// File: app/api/dashboard/payroll-elements/route.ts
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
    const elementVariants = [
      'BPJS Kesehatan',
      'Uang Makan',
      'Uang Transport',
    ];

    const components = await prisma.employeeComponent.findMany({
      where: {
        ...whereCondition,
        komponen: {
          in: elementVariants
        }
      },
      select: {
        komponen: true,
        nilai: true
      }
    });

    const elementMap = new Map<string, number>();
    
    components.forEach(c => {
      let normalizedName = c.komponen;
      
      if (c.komponen === 'BPJS Kesehatan') normalizedName = 'BPJS Kesehatan';
      if (c.komponen === 'Uang Makan') normalizedName = 'Uang Makan';
      if (c.komponen === 'Uang Transport') normalizedName = 'Uang Transport';

      const value = parseFloat(c.nilai) || 0;
      elementMap.set(normalizedName, (elementMap.get(normalizedName) || 0) + value);
    });

    const result = Array.from(elementMap.entries()).map(([name, value]) => ({
      name,
      value: Math.round(value)
    }));

    result.sort((a, b) => b.value - a.value);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching payroll elements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll elements' },
      { status: 500 }
    );
  }
}