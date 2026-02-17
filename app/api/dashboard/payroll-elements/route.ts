// app/api/dashboard/payroll-elements/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const elementsCache = new Map<string, { data: any; timestamp: number }>();
const ELEMENTS_CACHE_DURATION = 10 * 60 * 1000;

function getElementsCacheKey(year: string | null, month: string | null): string {
  return `elements-${year || 'all'}-${month || 'all'}`;
}

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

function buildWhereCondition(year: string | null, month: string | null): any {
  const where: any = {};
  if (year && year !== '(All)') {
    if (month && month !== '(All)') {
      where.AND = [
        { bulanReport: { contains: `-${getMonthName(month)}-` } },
        { bulanReport: { contains: year } }
      ];
    } else {
      where.bulanReport = { contains: year };
    }
  } else if (month && month !== '(All)') {
    where.bulanReport = { contains: `-${getMonthName(month)}-` };
  }
  return where;
}

// Non-monetary/metadata fields to exclude from payroll elements
const excludedFields = new Set([
  'Name', 'Directorate', 'Grade', 'Birth Date', 'Length of Service',
  'Length Of Service', 'Gender', 'Employee No', 'Position', 'Org Unit',
  'Tax Status', 'Tax File No', 'No KTP', 'Employment Status',
  'Join Date', 'Terminate Date', 'Net Salary', 'Gross Salary', 'Basic Salary',
]);

// Fields that end with _remark, _remark2, _remark3 are also excluded
function isRemarkField(key: string): boolean {
  return key.endsWith('_remark') || key.endsWith('_remark2') || key.endsWith('_remark3');
}

function extractElements(records: any[]): Map<string, number> {
  const elementMap = new Map<string, number>();

  records.forEach(record => {
    const d = record.data as any;

    Object.entries(d).forEach(([key, val]) => {
      if (excludedFields.has(key) || isRemarkField(key)) return;

      const value = parseFloat(val as string) || 0;
      if (value > 0) {
        elementMap.set(key, (elementMap.get(key) || 0) + value);
      }
    });
  });

  return elementMap;
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

    const cacheKey = getElementsCacheKey(year, month);
    const cached = elementsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ELEMENTS_CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // Current period
    const whereCondition = buildWhereCondition(year, month);

    const currentRecords = await prisma.employeeComponent.findMany({
      where: whereCondition,
      select: { data: true },
    });

    const currentElements = extractElements(currentRecords);

    let currentResult = Array.from(currentElements.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Previous period
    let previousResult: any[] = [];
    const previousElements = new Map<string, number>();

    if (year && year !== '(All)' && month && month !== '(All)') {
      const prev = getPreviousMonth(year, month);
      const prevWhere = buildWhereCondition(prev.year, prev.month);

      const prevRecords = await prisma.employeeComponent.findMany({
        where: prevWhere,
        select: { data: true },
      });

      const prevElements = extractElements(prevRecords);
      prevElements.forEach((v, k) => previousElements.set(k, v));

      previousResult = Array.from(prevElements.entries())
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }

    // Add percentage change
    currentResult = currentResult.map(item => {
      const previousValue = Math.round(previousElements.get(item.name) || 0);
      const percentageChange = previousValue > 0
        ? Math.round(((item.value - previousValue) / previousValue) * 10000) / 100
        : 0;

      return { ...item, previousValue, percentageChange };
    });

    previousResult = previousResult.map(item => {
      const currentValue = currentResult.find(c => c.name === item.name)?.value || 0;
      const percentageChange = item.value > 0 && currentValue > 0
        ? Math.round(((currentValue - item.value) / item.value) * 10000) / 100
        : 0;

      return { ...item, currentValue, percentageChange };
    });

    const responseData = { current: currentResult, previous: previousResult };

    elementsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    if (elementsCache.size > 100) {
      const oldestKey = elementsCache.keys().next().value;
      if (oldestKey) elementsCache.delete(oldestKey);
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching payroll elements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll elements' },
      { status: 500 }
    );
  }
}