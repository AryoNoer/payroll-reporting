// app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();

    const reports = await prisma.report.findMany({
      where: { userId: user.id },
      include: {
        upload: {
          select: {
            originalName: true,
            period: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reports);
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { uploadId, name, description, selectedFields } = body;

    if (!uploadId || !name || !selectedFields || selectedFields.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify upload exists and belongs to user
    const upload = await prisma.upload.findFirst({
      where: {
        id: uploadId,
        userId: user.id,
        status: "COMPLETED",
      },
    });

    if (!upload) {
      return NextResponse.json(
        { error: "Upload not found or not accessible" },
        { status: 404 }
      );
    }

    // Count total records
    const totalRecords = await prisma.employee.count({
      where: { uploadId },
    });

    // Create report
    const report = await prisma.report.create({
      data: {
        name,
        description: description || null,
        uploadId,
        userId: user.id,
        selectedFields,
        totalRecords,
      },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Report creation error:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}