/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/cost-center-aggregation.ts

import { deriveCoa } from "./field-calculations";

/**
 * Komponen gaji yang akan di-aggregate
 * Sesuai dengan template Cost Center Report
 */
export const COST_CENTER_COMPONENTS = [
  'Total Basic Salary',        // ← From calculations
  'Total Tunjangan Jabatan',   // ← From calculations
  'Uang Makan',
  'Total Uang Transport',      // ← From calculations
  'Lemburan',
  'Total Uang pisah',          // ← From calculations
  'Total Insentif',            // ← From calculations
  'Tunjangan Volta',
  'Insentif Volta',
  'Total Bonus paket',
  'Tunjangan Operasional Dibayar Payroll',
  'Total BPJS TK',             // ← From calculations
  'Total BPJS Kes',            // ← From calculations
  'THR',
  'BHR Mitra',
] as const;

export type CostCenterComponent = typeof COST_CENTER_COMPONENTS[number];

/**
 * Structure untuk aggregated data
 */
export interface DirectorateData {
  directorateName: string;
  employeeCount: number;
  components: Record<string, number>; // component name -> sum
}

export interface CoaData {
  coa: string; // "600" or "500"
  coaLabel: string; // "Kantor Pusat" or "Cabang"
  directorates: DirectorateData[];
  totalEmployees: number;
}

export interface AggregatedReport {
  coa600: CoaData;
  coa500: CoaData;
  grandTotal: {
    employeeCount: number;
    components: Record<string, number>;
  };
}

/**
 * Main aggregation function
 */
export function aggregateCostCenterData(employees: any[]): AggregatedReport {
  console.log(`\n🔄 Starting Cost Center Aggregation`);
  console.log(`📊 Processing ${employees.length} employees...`);

  // Initialize result structure
  const result: AggregatedReport = {
    coa600: {
      coa: "600",
      coaLabel: "Kantor Pusat",
      directorates: [],
      totalEmployees: 0,
    },
    coa500: {
      coa: "500",
      coaLabel: "Cabang",
      directorates: [],
      totalEmployees: 0,
    },
    grandTotal: {
      employeeCount: 0,
      components: {},
    },
  };

  // Group by COA → Directorate
  const groupedData: Record<string, Record<string, any[]>> = {
    "600": {},
    "500": {},
  };

  employees.forEach((emp) => {
    // Get COA
    const neutralData = (emp.neutralData as any) || {};
    const salaryData = (emp.salaryData as any) || {};
    const costCenter = String(
      neutralData['Cost Center'] || 
      salaryData['Cost Center'] || 
      ''
    );
    
    const coa = deriveCoa(costCenter);

    // Get Directorate
    const directorate = String(emp.directorate || 'Unknown').trim() || 'Unknown';

    // Initialize group
    if (!groupedData[coa]) groupedData[coa] = {};
    if (!groupedData[coa][directorate]) groupedData[coa][directorate] = [];

    // Add to group
    groupedData[coa][directorate].push(emp);
  });

  console.log(`✓ Grouped into COA 600 & 500`);

  // Process COA 600
  result.coa600.directorates = processDirectorates(groupedData["600"]);
  result.coa600.totalEmployees = result.coa600.directorates.reduce(
    (sum, d) => sum + d.employeeCount,
    0
  );

  // Process COA 500
  result.coa500.directorates = processDirectorates(groupedData["500"]);
  result.coa500.totalEmployees = result.coa500.directorates.reduce(
    (sum, d) => sum + d.employeeCount,
    0
  );

  // Calculate grand total
  result.grandTotal.employeeCount =
    result.coa600.totalEmployees + result.coa500.totalEmployees;

  result.grandTotal.components = calculateGrandTotalComponents(
    result.coa600.directorates,
    result.coa500.directorates
  );

  console.log(`\n📈 Aggregation Summary:`);
  console.log(`  COA 600: ${result.coa600.totalEmployees} employees, ${result.coa600.directorates.length} directorates`);
  console.log(`  COA 500: ${result.coa500.totalEmployees} employees, ${result.coa500.directorates.length} directorates`);
  console.log(`  Grand Total: ${result.grandTotal.employeeCount} employees`);

  return result;
}

/**
 * Process directorates for a COA group
 */
function processDirectorates(
  directorateGroups: Record<string, any[]>
): DirectorateData[] {
  const directorates: DirectorateData[] = [];

  for (const [directorateName, empList] of Object.entries(directorateGroups)) {
    const components: Record<string, number> = {};

    // Initialize all components to 0
    COST_CENTER_COMPONENTS.forEach((component) => {
      components[component] = 0;
    });

    // Sum components for all employees in this directorate
    empList.forEach((emp) => {
      const allData = {
        ...(emp.salaryData as any || {}),
        ...(emp.allowanceData as any || {}),
        ...(emp.deductionData as any || {}),
        ...(emp.neutralData as any || {}),
      };

      // DEBUG: Print available fields for first employee
      if (empList.indexOf(emp) === 0) {
        console.log(`\n📋 Available fields for ${directorateName}:`);
        console.log(Object.keys(allData).filter(k => k.includes('Basic') || k.includes('Tunjangan')));
      }

      COST_CENTER_COMPONENTS.forEach((component) => {
        const value = Number(allData[component]) || 0;
        components[component] += value;
      });
    });

    directorates.push({
      directorateName,
      employeeCount: empList.length,
      components,
    });
  }

  // Sort by directorate name
  directorates.sort((a, b) =>
    a.directorateName.localeCompare(b.directorateName)
  );

  return directorates;
}

/**
 * Calculate grand total across all directorates
 */
function calculateGrandTotalComponents(
  coa600Directorates: DirectorateData[],
  coa500Directorates: DirectorateData[]
): Record<string, number> {
  const grandTotalComponents: Record<string, number> = {};

  COST_CENTER_COMPONENTS.forEach((component) => {
    grandTotalComponents[component] = 0;
  });

  // Sum from COA 600
  coa600Directorates.forEach((dir) => {
    COST_CENTER_COMPONENTS.forEach((component) => {
      grandTotalComponents[component] += dir.components[component] || 0;
    });
  });

  // Sum from COA 500
  coa500Directorates.forEach((dir) => {
    COST_CENTER_COMPONENTS.forEach((component) => {
      grandTotalComponents[component] += dir.components[component] || 0;
    });
  });

  return grandTotalComponents;
}

/**
 * Get unique list of directorates across both COAs
 */
export function getAllDirectorates(aggregatedData: AggregatedReport): string[] {
  const directorates = new Set<string>();

  aggregatedData.coa600.directorates.forEach((d) =>
    directorates.add(d.directorateName)
  );
  aggregatedData.coa500.directorates.forEach((d) =>
    directorates.add(d.directorateName)
  );

  return Array.from(directorates).sort();
}