// app/api/uploads/components/periods/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();

    // Get unique periods from employee_components
    const periods = await prisma.employeeComponent.groupBy({
      by: ['bulanReport'],
      _count: {
        id: true
      },
      orderBy: {
        bulanReport: 'desc'
      }
    });

    return NextResponse.json(
      periods.map(p => ({
        bulanReport: p.bulanReport,
        count: p._count.id
      }))
    );
  } catch (error) {
    console.error("[GET /api/uploads/components/periods] Error:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}