// lib/excel-template.ts
// Generate Excel with 4-level hierarchical headers and merged cells
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as XLSX from 'xlsx';
import { categorizeFields, FieldCategory } from './field-categories';

interface MergeRange {
  s: { r: number; c: number }; // start
  e: { r: number; c: number }; // end
}

export interface ExcelTemplateOptions {
  sheetName?: string;
  autoWidth?: boolean;
  maxWidth?: number;
}

/**
 * Fields that should be treated as TEXT (not numbers)
 * This prevents Excel from truncating or converting values
 */
const TEXT_FIELDS = [
  'Jobstatus Code',
  'No KTP',
  'Gov. Tax File No.',
  'Employee No',
  'Cost Center Code',
  'Work Location Code',
  'Tax Location Code',
  'Company Bank Account',
  'Bank Account',
  'Insurance No BPJSKT',
  'Insurance No BPJSKES'
];

/**
 * Generate Excel workbook with 4-level hierarchical headers
 */
export function generateTemplatedExcel(
  data: any[],
  fieldNames: string[],
  options: ExcelTemplateOptions = {}
): XLSX.WorkBook {
  const {
    sheetName = 'Report',
    autoWidth = true,
    maxWidth = 50
  } = options;

  if (data.length === 0 || fieldNames.length === 0) {
    throw new Error('No data or fields provided');
  }

  console.log('\n=== GENERATING TEMPLATED EXCEL ===');
  console.log(`Fields to process: ${fieldNames.length}`);
  console.log(`Data rows: ${data.length}`);

  // Categorize all fields
  const fieldCategories = categorizeFields(fieldNames);
  
  // Build 4 header rows
  const headers = buildHeaderRows(fieldNames, fieldCategories);
  
  // Convert data to array format with text formatting
  const dataRows = data.map(row => 
    fieldNames.map(field => {
      const value = row[field] ?? '';
      
      // ✅ FIX: Force text format for specific fields
      if (TEXT_FIELDS.includes(field) && value !== '') {
        // Prefix with apostrophe to force Excel text format
        return String(value);
      }
      
      return value;
    })
  );

  // Combine headers + data
  const allRows = [...headers, ...dataRows];

  // Create worksheet from array
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // ✅ FIX: Apply text format to specific columns
  applyTextFormatting(ws, fieldNames, headers.length, data.length);

  // Calculate and apply merges
  const merges = calculateMerges(fieldNames, fieldCategories);
  ws['!merges'] = merges;

  console.log(`✓ Generated ${merges.length} merged cells`);

  // Apply column widths
  if (autoWidth) {
    ws['!cols'] = calculateColumnWidths(allRows, maxWidth);
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  console.log('✓ Excel workbook generated successfully');
  console.log('=== GENERATION COMPLETE ===\n');

  return wb;
}

/**
 * Apply text formatting to specific columns to prevent truncation
 */
function applyTextFormatting(
  ws: XLSX.WorkSheet,
  fieldNames: string[],
  headerRowCount: number,
  dataRowCount: number
): void {
  // Find indices of text fields
  const textFieldIndices: number[] = [];
  fieldNames.forEach((field, index) => {
    if (TEXT_FIELDS.includes(field)) {
      textFieldIndices.push(index);
    }
  });

  if (textFieldIndices.length === 0) return;

  console.log(`✓ Applying text format to ${textFieldIndices.length} columns`);

  // Apply to all data rows (skip headers)
  for (let row = headerRowCount; row < headerRowCount + dataRowCount; row++) {
    textFieldIndices.forEach(colIndex => {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
      const cell = ws[cellAddress];
      
      if (cell && cell.v !== undefined && cell.v !== '') {
        // Force as string type
        cell.t = 's'; // 's' = string type
        cell.v = String(cell.v); // Ensure value is string
        
        // Add number format code for text
        if (!cell.z) {
          cell.z = '@'; // '@' = text format in Excel
        }
      }
    });
  }
}

/**
 * Build 4 header rows from field names and categories
 */
function buildHeaderRows(
  fieldNames: string[],
  fieldCategories: Map<string, FieldCategory>
): any[][] {
  const row1: string[] = []; // Empty row (like OUTPUT.csv)
  const row2: string[] = []; // Level 1: Basic Info, Allowance, Deduction, THP, Netral
  const row3: string[] = []; // Level 2: Salary, Tunjangan, Insentif, etc.
  const row4: string[] = []; // Level 3: Detail categories
  const row5: string[] = []; // Level 4: Actual field names

  fieldNames.forEach(fieldName => {
    const category = fieldCategories.get(fieldName) || {
      level1: 'Netral',
      level2: 'Netral',
      level3: 'Netral'
    };

    row1.push(''); // Empty for all columns
    row2.push(category.level1);
    row3.push(category.level2);
    row4.push(category.level3);
    row5.push(fieldName);
  });

  return [row1, row2, row3, row4, row5];
}

/**
 * Calculate merge ranges for headers
 */
function calculateMerges(
  fieldNames: string[],
  fieldCategories: Map<string, FieldCategory>
): MergeRange[] {
  const merges: MergeRange[] = [];

  // Helper to add merge if range > 1 column
  const addMerge = (row: number, startCol: number, endCol: number) => {
    if (endCol > startCol) {
      merges.push({
        s: { r: row, c: startCol },
        e: { r: row, c: endCol }
      });
    }
  };

  // Process each header row (rows 1-4, 0-indexed)
  [1, 2, 3].forEach(rowIndex => {
    let currentCategory = '';
    let startCol = 0;

    fieldNames.forEach((fieldName, colIndex) => {
      const category = fieldCategories.get(fieldName) || {
        level1: 'Netral',
        level2: 'Netral',
        level3: 'Netral'
      };

      let categoryValue: string;
      if (rowIndex === 1) categoryValue = category.level1;
      else if (rowIndex === 2) categoryValue = category.level2;
      else categoryValue = category.level3;

      // Start new group
      if (categoryValue !== currentCategory) {
        // Merge previous group if exists
        if (currentCategory !== '') {
          addMerge(rowIndex, startCol, colIndex - 1);
        }
        
        currentCategory = categoryValue;
        startCol = colIndex;
      }

      // Last column - merge if needed
      if (colIndex === fieldNames.length - 1) {
        addMerge(rowIndex, startCol, colIndex);
      }
    });
  });

  // Row 0 (empty row) - merge all columns as one
  merges.push({
    s: { r: 0, c: 0 },
    e: { r: 0, c: fieldNames.length - 1 }
  });

  return merges;
}

/**
 * Calculate optimal column widths
 */
function calculateColumnWidths(
  rows: any[][],
  maxWidth: number
): Array<{ wch: number }> {
  if (rows.length === 0) return [];

  const colCount = rows[0].length;
  const widths: number[] = new Array(colCount).fill(10); // minimum width

  // Sample first 100 rows for width calculation
  const sampleRows = rows.slice(0, Math.min(100, rows.length));

  for (let col = 0; col < colCount; col++) {
    for (const row of sampleRows) {
      const cellValue = String(row[col] || '');
      widths[col] = Math.max(widths[col], cellValue.length);
    }
  }

  return widths.map(w => ({ 
    wch: Math.min(w + 2, maxWidth) 
  }));
}

/**
 * Helper to generate Excel buffer from workbook
 */
export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { 
    type: 'buffer', 
    bookType: 'xlsx',
    cellStyles: true 
  }) as Buffer;
}

/**
 * Get summary of categories for logging
 */
export function getCategorySummary(
  fieldNames: string[],
  fieldCategories: Map<string, FieldCategory>
): Record<string, number> {
  const summary: Record<string, number> = {};

  fieldNames.forEach(name => {
    const category = fieldCategories.get(name);
    if (category) {
      const key = category.level1;
      summary[key] = (summary[key] || 0) + 1;
    }
  });

  return summary;
}