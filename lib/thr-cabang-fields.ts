// lib/thr-cabang-fields.ts
/**
 * THR Cabang Report Fields
 * Untuk COA 500 (bukan Kantor Pusat)
 */
export const THR_CABANG_FIELDS: string[] = [
  'No',
  'Name',
  'Employee No',
  'Position',
  'Department',
  'Directorate',
  'Directorate 2',
  'Jobstatus Code',
  'Cost Center Code',
  'Cost Center By Function',
  'COA',
  'Employment Status',
  'Join Date',
  'Terminate Date',
  'Join Date For Calc',
  'Start THR',
  'Total Hari Pembagi',
  'Masa Kerja',
  'Masa Efektif (THN)',
  'Masa Efektif (BLN)',
  'Total Masa kerja Sampai THR',
  'Accrue Masa kerja THR YTD',
  'Basic Salary Full',
  'Basic Jabatan',
  'Netral Tunjangan Pendidikan',
  'Basic Tunjangan Operasional',
  'Gross Upah',
  'Estimasi THR 1 Tahun',
  'ESTIMASI THR YTD (Per Tgl Report)',
] as const;

export type THRCabangField = string;

export function isTHRCabangField(field: string): field is THRCabangField {
  return THR_CABANG_FIELDS.includes(field);
}