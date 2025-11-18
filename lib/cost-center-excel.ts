/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/cost-center-excel.ts

import * as XLSX from 'xlsx';
import { AggregatedReport, getAllDirectorates, COST_CENTER_COMPONENTS } from './cost-center-aggregation';

// ========================================
// COLOR DEFINITIONS
// ========================================
const COLORS = {
  headerBlue: 'C5D9F1',      // Light blue for main headers
  headerRed: 'F4B084',       // Orange/red for Cost Center
  headerYellow: 'FFD966',    // Yellow for alternating
  headerGreen: 'A9D08E',     // Green for alternating
  coa600Gray: 'D9D9D9',      // Gray for COA 600 rows
  coa500Beige: 'F2DCDB',     // Beige for COA 500 rows
  grandTotalBlue: 'B4C7E7',  // Blue for grand total
  white: 'FFFFFF',
};

/**
 * Apply cell style with background color and borders
 */
function styleCell(ws: any, cell: string, bgColor: string, bold = false, align = 'center') {
  if (!ws[cell]) ws[cell] = { v: '', t: 's' };
  
  ws[cell].s = {
    fill: { fgColor: { rgb: bgColor } },
    font: { bold: bold, name: 'Calibri', sz: 11 },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
    alignment: { horizontal: align, vertical: 'center' },
  };
}

/**
 * Apply number formatting to cell
 */
function styleNumberCell(ws: any, cell: string, value: number | string, bgColor = COLORS.white) {
  if (!ws[cell]) ws[cell] = { v: value, t: typeof value === 'number' ? 'n' : 's' };
  else ws[cell].v = value;
  
  ws[cell].s = {
    fill: { fgColor: { rgb: bgColor } },
    font: { name: 'Calibri', sz: 11 },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: typeof value === 'number' ? '#,##0' : '@',
  };
}

/**
 * Generate Excel workbook for Cost Center Report
 * Structure: Multi-level headers with dynamic directorate columns
 */
export function generateCostCenterExcel(
  aggregatedData: AggregatedReport,
  reportName: string,
  period: Date
): XLSX.WorkBook {
  console.log('\n📄 Generating Cost Center Excel...');

  const wb = XLSX.utils.book_new();
  const ws: any = {};

  // Get all unique directorates
  const allDirectorates = getAllDirectorates(aggregatedData);
  console.log(`✓ Found ${allDirectorates.length} directorates`);

  let currentRow = 0;

  // ========================================
  // ROW 1-2: Title & Period
  // ========================================
  ws['A1'] = { v: 'Salary Cost', t: 's' };
  styleCell(ws, 'A1', COLORS.headerBlue, true);
  
  ws['B1'] = { v: period.getFullYear().toString(), t: 's' };
  styleCell(ws, 'B1', COLORS.headerBlue, true);
  currentRow = 2;

  // ========================================
  // ROW 3: Headers - COA | Komponen Gaji | Period
  // ========================================
  ws[`A${currentRow + 1}`] = { v: 'COA', t: 's' };
  styleCell(ws, `A${currentRow + 1}`, COLORS.headerBlue, true);
  
  ws[`B${currentRow + 1}`] = { v: 'Komponen Gaji', t: 's' };
  styleCell(ws, `B${currentRow + 1}`, COLORS.headerBlue, true);
  
  ws[`C${currentRow + 1}`] = { v: period.toLocaleDateString('id-ID', { month: 'long' }), t: 's' };
  styleCell(ws, `C${currentRow + 1}`, COLORS.headerBlue, true);
  currentRow++;

  // ========================================
  // ROW 4: "Cost Center" repeated with alternating colors
  // ========================================
  ws[`A${currentRow + 1}`] = { v: '', t: 's' };
  ws[`B${currentRow + 1}`] = { v: '', t: 's' };
  
  let colIndex = 2;
  let colorToggle = false;
  allDirectorates.forEach(() => {
    const colLetter1 = XLSX.utils.encode_col(colIndex);
    const colLetter2 = XLSX.utils.encode_col(colIndex + 1);
    
    const color = colorToggle ? COLORS.headerYellow : COLORS.headerGreen;
    
    ws[`${colLetter1}${currentRow + 1}`] = { v: 'Cost Center', t: 's' };
    styleCell(ws, `${colLetter1}${currentRow + 1}`, color, true);
    
    ws[`${colLetter2}${currentRow + 1}`] = { v: '', t: 's' };
    styleCell(ws, `${colLetter2}${currentRow + 1}`, color, true);
    
    colIndex += 2;
    colorToggle = !colorToggle;
  });
  currentRow++;

  // ========================================
  // ROW 5: Jumlah Karyawan | Directorate Name
  // ========================================
  ws[`A${currentRow + 1}`] = { v: '', t: 's' };
  ws[`B${currentRow + 1}`] = { v: '', t: 's' };
  
  colIndex = 2;
  colorToggle = false;
  allDirectorates.forEach((dirName) => {
    const colLetter1 = XLSX.utils.encode_col(colIndex);
    const colLetter2 = XLSX.utils.encode_col(colIndex + 1);
    
    const color = colorToggle ? COLORS.headerYellow : COLORS.headerGreen;
    
    ws[`${colLetter1}${currentRow + 1}`] = { v: 'Jumlah Karyawan', t: 's' };
    styleCell(ws, `${colLetter1}${currentRow + 1}`, color, true);
    
    ws[`${colLetter2}${currentRow + 1}`] = { v: dirName, t: 's' };
    styleCell(ws, `${colLetter2}${currentRow + 1}`, color, true);
    
    colIndex += 2;
    colorToggle = !colorToggle;
  });
  currentRow++;

  // ========================================
  // DATA ROWS
  // ========================================

  // Grand Total Row
  currentRow = addDataRow(
    ws,
    currentRow,
    '',
    'Grand Total',
    aggregatedData.grandTotal.employeeCount,
    aggregatedData.grandTotal.components,
    allDirectorates,
    aggregatedData,
    COLORS.grandTotalBlue
  );

  // COA 600 Rows
  currentRow = addCoaSection(
    ws,
    currentRow,
    '600',
    aggregatedData.coa600,
    allDirectorates,
    COLORS.coa600Gray
  );

  // COA 500 Rows
  currentRow = addCoaSection(
    ws,
    currentRow,
    '500',
    aggregatedData.coa500,
    allDirectorates,
    COLORS.coa500Beige
  );

  // Set column range
  const lastCol = XLSX.utils.encode_col(1 + allDirectorates.length * 2);
  ws['!ref'] = `A1:${lastCol}${currentRow}`;

  // Set column widths
  const colWidths = [
    { wch: 8 },  // COA
    { wch: 45 }, // Komponen Gaji
  ];
  for (let i = 0; i < allDirectorates.length; i++) {
    colWidths.push({ wch: 15 }); // Jumlah Karyawan
    colWidths.push({ wch: 20 }); // Directorate value
  }
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Cost Center Report');

  console.log(`✓ Excel generated with ${currentRow} rows`);
  return wb;
}

/**
 * Add a single data row (Grand Total)
 */
function addDataRow(
  ws: any,
  currentRow: number,
  coaValue: string,
  componentName: string,
  totalEmployeeCount: number,
  components: Record<string, number>,
  allDirectorates: string[],
  aggregatedData: AggregatedReport,
  bgColor = COLORS.white
): number {
  const rowNum = currentRow + 1;

  // COA column
  ws[`A${rowNum}`] = { v: coaValue, t: coaValue ? 's' : 'z' };
  styleCell(ws, `A${rowNum}`, bgColor, true, 'center');
  
  // Komponen column
  ws[`B${rowNum}`] = { v: componentName, t: 's' };
  styleCell(ws, `B${rowNum}`, bgColor, true, 'left');

  // ✅ Grand Total = Sum of COA 600 Total + COA 500 Total per directorate
  let colIndex = 2;
  allDirectorates.forEach((dirName) => {
    const colLetter1 = XLSX.utils.encode_col(colIndex);
    const colLetter2 = XLSX.utils.encode_col(colIndex + 1);

    // Find directorate in both COAs
    const dir600 = aggregatedData.coa600.directorates.find(
      (d) => d.directorateName === dirName
    );
    const dir500 = aggregatedData.coa500.directorates.find(
      (d) => d.directorateName === dirName
    );

    // ✅ Calculate total from BOTH COAs (sum of ALL components per directorate)
    let empCount = 0;
    let totalValue = 0;

    if (dir600) {
      // Sum all components for COA 600
      const coa600Total = COST_CENTER_COMPONENTS.reduce(
        (sum, comp) => sum + (dir600.components[comp] || 0),
        0
      );
      if (coa600Total > 0) {
        empCount += dir600.employeeCount;
        totalValue += coa600Total;
      }
    }

    if (dir500) {
      // Sum all components for COA 500
      const coa500Total = COST_CENTER_COMPONENTS.reduce(
        (sum, comp) => sum + (dir500.components[comp] || 0),
        0
      );
      if (coa500Total > 0) {
        empCount += dir500.employeeCount;
        totalValue += coa500Total;
      }
    }

    // Write values
    if (empCount > 0) {
      styleNumberCell(ws, `${colLetter1}${rowNum}`, empCount, bgColor);
    } else {
      ws[`${colLetter1}${rowNum}`] = { v: '-', t: 's' };
      styleCell(ws, `${colLetter1}${rowNum}`, bgColor, false, 'center');
    }

    if (totalValue > 0) {
      styleNumberCell(ws, `${colLetter2}${rowNum}`, totalValue, bgColor);
    } else {
      ws[`${colLetter2}${rowNum}`] = { v: '-', t: 's' };
      styleCell(ws, `${colLetter2}${rowNum}`, bgColor, false, 'center');
    }

    colIndex += 2;
  });

  return rowNum;
}

/**
 * Add COA section (Total + Component rows)
 */
function addCoaSection(
  ws: any,
  currentRow: number,
  coaValue: string,
  coaData: any,
  allDirectorates: string[],
  bgColor = COLORS.white
): number {
  let rowNum = currentRow;

  // Total row for this COA
  rowNum++;
  ws[`A${rowNum}`] = { v: coaValue, t: 's' };
  styleCell(ws, `A${rowNum}`, bgColor, true, 'center');
  
  ws[`B${rowNum}`] = { v: 'Total', t: 's' };
  styleCell(ws, `B${rowNum}`, bgColor, true, 'left');

  let colIndex = 2;
  allDirectorates.forEach((dirName) => {
    const colLetter1 = XLSX.utils.encode_col(colIndex);
    const colLetter2 = XLSX.utils.encode_col(colIndex + 1);

    const dir = coaData.directorates.find((d: any) => d.directorateName === dirName);
    
    if (dir) {
      // Sum all components for this directorate
      const totalComponents = COST_CENTER_COMPONENTS.reduce(
        (sum, comp) => sum + (dir.components[comp] || 0),
        0
      );
      
      // ✅ Only show employee count if there's actual data
      if (totalComponents > 0) {
        styleNumberCell(ws, `${colLetter1}${rowNum}`, dir.employeeCount, bgColor);
        styleNumberCell(ws, `${colLetter2}${rowNum}`, totalComponents, bgColor);
      } else {
        // No data for this directorate in this COA
        ws[`${colLetter1}${rowNum}`] = { v: '-', t: 's' };
        styleCell(ws, `${colLetter1}${rowNum}`, bgColor, false, 'center');
        ws[`${colLetter2}${rowNum}`] = { v: '-', t: 's' };
        styleCell(ws, `${colLetter2}${rowNum}`, bgColor, false, 'center');
      }
    } else {
      // Directorate not found in this COA
      ws[`${colLetter1}${rowNum}`] = { v: '-', t: 's' };
      styleCell(ws, `${colLetter1}${rowNum}`, bgColor, false, 'center');
      
      ws[`${colLetter2}${rowNum}`] = { v: '-', t: 's' };
      styleCell(ws, `${colLetter2}${rowNum}`, bgColor, false, 'center');
    }

    colIndex += 2;
  });

  // Component rows
  COST_CENTER_COMPONENTS.forEach((componentName) => {
    rowNum++;
    ws[`A${rowNum}`] = { v: '', t: 's' }; // Empty COA for component rows
    styleCell(ws, `A${rowNum}`, bgColor, false, 'center');
    
    ws[`B${rowNum}`] = { v: componentName, t: 's' };
    styleCell(ws, `B${rowNum}`, bgColor, false, 'left');

    let colIndex = 2;
    allDirectorates.forEach((dirName) => {
      const colLetter1 = XLSX.utils.encode_col(colIndex);
      const colLetter2 = XLSX.utils.encode_col(colIndex + 1);

      const dir = coaData.directorates.find((d: any) => d.directorateName === dirName);
      
      // ✅ CORRECT: Leave Jumlah Karyawan column EMPTY for component rows
      ws[`${colLetter1}${rowNum}`] = { v: '-', t: 's' };
      styleCell(ws, `${colLetter1}${rowNum}`, bgColor, false, 'center');
      
      if (dir) {
        // Employee count (same for all components in same directorate)
        styleNumberCell(ws, `${colLetter1}${rowNum}`, dir.employeeCount, bgColor);
        
        // Component value
        const value = dir.components[componentName] || 0;
        if (value > 0) {
          styleNumberCell(ws, `${colLetter2}${rowNum}`, value, bgColor);
        } else {
          ws[`${colLetter2}${rowNum}`] = { v: '-', t: 's' };
          styleCell(ws, `${colLetter2}${rowNum}`, bgColor, false, 'center');
        }
      } else {
        ws[`${colLetter1}${rowNum}`] = { v: '-', t: 's' };
        styleCell(ws, `${colLetter1}${rowNum}`, bgColor, false, 'center');
        
        ws[`${colLetter2}${rowNum}`] = { v: '-', t: 's' };
        styleCell(ws, `${colLetter2}${rowNum}`, bgColor, false, 'center');
      }

      colIndex += 2;
    });
  });

  return rowNum;
}

/**
 * Convert workbook to buffer for download
 */
export function costCenterWorkbookToBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}