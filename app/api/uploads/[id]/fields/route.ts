/* eslint-disable @typescript-eslint/no-explicit-any */

// app/api/uploads/[id]/fields/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ Changed to Promise
) {
  try {
    const user = await requireAuth();
    const { id: uploadId } = await params; // ✅ Await params

    console.log(`\n=== FETCHING AVAILABLE FIELDS FOR UPLOAD ${uploadId} ===`);

    // Verify upload belongs to user
    const upload = await prisma.upload.findFirst({
      where: {
        id: uploadId,
        userId: user.id,
      },
    });

    if (!upload) {
      console.error(`❌ Upload not found: ${uploadId}`);
      return NextResponse.json(
        { error: "Upload not found" },
        { status: 404 }
      );
    }

    console.log(`✅ Upload found: ${upload.originalName}`);

    // Get a sample employee to extract ALL available fields
    const sampleEmployee = await prisma.employee.findFirst({
      where: { uploadId },
    });

    if (!sampleEmployee) {
      console.error(`❌ No employee data found for upload ${uploadId}`);
      return NextResponse.json(
        { error: "No employee data found" },
        { status: 404 }
      );
    }

    console.log(`✅ Sample employee found: ${sampleEmployee.name}`);

    const salaryData = sampleEmployee.salaryData as any;
    const allowanceData = sampleEmployee.allowanceData as any;
    const deductionData = sampleEmployee.deductionData as any;
    const neutralData = sampleEmployee.neutralData as any;

    // Collect ALL unique fields
    const salaryFields = Object.keys(salaryData || {});
    const allowanceFields = Object.keys(allowanceData || {});
    const deductionFields = Object.keys(deductionData || {});
    const neutralFields = Object.keys(neutralData || {});

    console.log(`Found fields:`);
    console.log(`  - Salary: ${salaryFields.length}`);
    console.log(`  - Allowance: ${allowanceFields.length}`);
    console.log(`  - Deduction: ${deductionFields.length}`);
    console.log(`  - Neutral: ${neutralFields.length}`);
    console.log(`  - TOTAL: ${salaryFields.length + allowanceFields.length + deductionFields.length + neutralFields.length}`);

    // Build response
    const response = {
      salary: salaryFields.map(name => ({
        id: name,
        code: name,
        name: name,
        type: "SALARY",
      })),
      allowance: allowanceFields.map(name => ({
        id: name,
        code: name,
        name: name,
        type: "ALLOWANCE",
      })),
      deduction: deductionFields.map(name => ({
        id: name,
        code: name,
        name: name,
        type: "DEDUCTION",
      })),
      neutral: neutralFields.map(name => ({
        id: name,
        code: name,
        name: name,
        type: "NEUTRAL",
      })),
    };

    console.log("✅ Fields fetch completed");
    console.log('=== END ===\n');

    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Error fetching fields:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch fields",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}