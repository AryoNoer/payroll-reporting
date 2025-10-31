/* eslint-disable @typescript-eslint/no-explicit-any */


// app/api/uploads/[id]/fields/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const uploadId = params.id;

    console.log(`\n=== FETCHING AVAILABLE FIELDS FOR UPLOAD ${uploadId} ===`);

    // Verify upload belongs to user
    const upload = await prisma.upload.findFirst({
      where: {
        id: uploadId,
        userId: user.id,
      },
    });

    if (!upload) {
      return NextResponse.json(
        { error: "Upload not found" },
        { status: 404 }
      );
    }

    // Get a sample employee to extract available fields
    const sampleEmployee = await prisma.employee.findFirst({
      where: { uploadId },
    });

    if (!sampleEmployee) {
      return NextResponse.json(
        { error: "No employee data found" },
        { status: 404 }
      );
    }

    const salaryData = sampleEmployee.salaryData as any;
    const allowanceData = sampleEmployee.allowanceData as any;
    const deductionData = sampleEmployee.deductionData as any;
    const neutralData = sampleEmployee.neutralData as any;

    // Collect all unique fields
    const salaryFields = Object.keys(salaryData || {});
    const allowanceFields = Object.keys(allowanceData || {});
    const deductionFields = Object.keys(deductionData || {});
    const neutralFields = Object.keys(neutralData || {});

    console.log(`Found fields:`);
    console.log(`  - Salary: ${salaryFields.length}`);
    console.log(`  - Allowance: ${allowanceFields.length}`);
    console.log(`  - Deduction: ${deductionFields.length}`);
    console.log(`  - Neutral: ${neutralFields.length}`);

    // Get component info from master data
    const allFieldNames = [
      ...salaryFields,
      ...allowanceFields,
      ...deductionFields,
      ...neutralFields,
    ];

    const components = await prisma.component.findMany({
      where: {
        OR: [
          { name: { in: allFieldNames } },
          { isActive: true },
        ],
      },
    });

    console.log(`Matched ${components.length} components from master data`);

    // Build response with categorized fields
    const categorizedFields = {
      salary: salaryFields.map(name => {
        const component = components.find(c => c.name === name);
        return {
          id: component?.id || name,
          code: component?.code || name,
          name: name,
          type: "SALARY",
        };
      }),
      allowance: allowanceFields.map(name => {
        const component = components.find(c => c.name === name);
        return {
          id: component?.id || name,
          code: component?.code || name,
          name: name,
          type: "ALLOWANCE",
        };
      }),
      deduction: deductionFields.map(name => {
        const component = components.find(c => c.name === name);
        return {
          id: component?.id || name,
          code: component?.code || name,
          name: name,
          type: "DEDUCTION",
        };
      }),
      neutral: neutralFields.map(name => {
        const component = components.find(c => c.name === name);
        return {
          id: component?.id || name,
          code: component?.code || name,
          name: name,
          type: "NEUTRAL",
        };
      }),
    };

    console.log("=== FIELDS FETCH COMPLETED ===\n");

    return NextResponse.json(categorizedFields);

  } catch (error) {
    console.error("Error fetching fields:", error);
    return NextResponse.json(
      { error: "Failed to fetch fields" },
      { status: 500 }
    );
  }
}