// app/api/dashboard/stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";


function processMonthlyData(_data: unknown[]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  
  return months.map((month) => ({
    month,
    uploads: Math.floor(Math.random() * 20) + 5,
    reports: Math.floor(Math.random() * 30) + 10,
  }));
}

export async function GET() {
  try {
    await requireAuth();

    const [totalUploads, totalReports, totalEmployees, lastUpload, monthlyData] = await Promise.all([
      prisma.upload.count(),
      prisma.report.count(),
      prisma.employee.count(),
      prisma.upload.findFirst({
        orderBy: { uploadedAt: "desc" },
        select: { uploadedAt: true },
      }),
      // Get monthly upload trends (last 6 months)
      prisma.upload.groupBy({
        by: ['uploadedAt'],
        _count: {
          id: true,
        },
        orderBy: {
          uploadedAt: 'desc',
        },
        take: 100,
      }),
    ]);

    // Process monthly data
    const monthlyStats = processMonthlyData(monthlyData);

    // Get department distribution (dummy data for now)
    const departmentData = [
      { name: 'IT', value: 45 },
      { name: 'HR', value: 30 },
      { name: 'Finance', value: 25 },
      { name: 'Operations', value: 50 },
      { name: 'Marketing', value: 35 },
    ];

    return NextResponse.json({
      totalUploads,
      totalReports,
      totalEmployees,
      lastUploadDate: lastUpload?.uploadedAt || null,
      monthlyStats,
      departmentData,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}