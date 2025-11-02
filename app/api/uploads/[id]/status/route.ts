// app/api/uploads/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: uploadId } = await params;

    // Get upload status
    const upload = await prisma.upload.findFirst({
      where: {
        id: uploadId,
        userId: user.id,
      },
      select: {
        id: true,
        status: true,
        progress: true,
        rowCount: true,
        errorMessage: true,
        uploadedAt: true,
      },
    });

    if (!upload) {
      return NextResponse.json(
        { error: "Upload not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: upload.id,
      status: upload.status,
      progress: upload.progress,
      rowCount: upload.rowCount,
      errorMessage: upload.errorMessage,
      uploadedAt: upload.uploadedAt,
    });

  } catch (error) {
    console.error("[GET /api/uploads/[id]/status] Error:", error);
    
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: "Failed to fetch upload status" },
      { status: 500 }
    );
  }
}