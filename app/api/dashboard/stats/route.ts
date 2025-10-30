// app/api/dashboard/stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();

    const [totalUploads, totalReports, totalEmployees, lastUpload] = await Promise.all([
      prisma.upload.count(),
      prisma.report.count(),
      prisma.employee.count(),
      prisma.upload.findFirst({
        orderBy: { uploadedAt: "desc" },
        select: { uploadedAt: true },
      }),
    ]);

    return NextResponse.json({
      totalUploads,
      totalReports,
      totalEmployees,
      lastUploadDate: lastUpload?.uploadedAt || null,
    });
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}