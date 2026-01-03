// app/api/dashboard/payroll-elements/route.ts
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
    const whereConditionCurrent: any = {};

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

    // Get all components (excluding basic salary components)
    const excludedComponents = ['Net Salary', 'Gross Salary', 'Basic Salary', 'Name', 'Directorate', 'Grade', 'Birth Date', 'Length Of Service'];
    
    const currentComponents = await prisma.employeeComponent.findMany({
      where: {
        ...whereConditionCurrent,
        komponen: { notIn: excludedComponents },
      },
      select: {
        komponen: true,
        nilai: true,
      },
    });

    // Aggregate by component
    const elementMap = new Map<string, number>();
    
    currentComponents.forEach(c => {
      const value = parseFloat(c.nilai) || 0;
      elementMap.set(c.komponen, (elementMap.get(c.komponen) || 0) + value);
    });

    // Convert to array and sort by value (descending)
    let currentResult = Array.from(elementMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10

    // Get previous month data if specific month is selected
    const previousValueMap = new Map<string, number>();
    
    if (year && year !== '(All)' && month && month !== '(All)') {
      const prev = getPreviousMonth(year, month);
      
      const whereConditionPrevious: any = {
        AND: [
          { bulanReport: { contains: `-${getMonthName(prev.month)}-` } },
          { bulanReport: { contains: prev.year } }
        ],
        komponen: { notIn: excludedComponents },
      };

      const previousComponents = await prisma.employeeComponent.findMany({
        where: whereConditionPrevious,
        select: {
          komponen: true,
          nilai: true,
        },
      });

      previousComponents.forEach(c => {
        const value = parseFloat(c.nilai) || 0;
        previousValueMap.set(c.komponen, (previousValueMap.get(c.komponen) || 0) + value);
      });
    }

    // Add previous values to current result
    currentResult = currentResult.map(item => ({
      ...item,
      previousValue: Math.round(previousValueMap.get(item.name) || 0),
    }));

    return NextResponse.json({
      current: currentResult,
      previous: Array.from(previousValueMap.entries())
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    });

  } catch (error) {
    console.error('Error fetching payroll elements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll elements' },
      { status: 500 }
    );
  }
}