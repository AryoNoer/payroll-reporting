// lib/headcount-fields.ts
/**
 * Headcount Report Fields
 * Fokus pada data employee/demographic, bukan salary components
 */
export const HEADCOUNT_FIELDS : string[] = [
  'No',
  'Name',
  'Employee No',
  'No KTP',
  'Gov. Tax File No.',
  'Position',
  'Department',
  'Directorate',
  'Directorate 2',
  'Tax Location',
  'Cost Center By Function',
  'Jobstatus Code',
  'Jobstatus Name',
  'Work Location Code',
  'Work Location',
  'Cost Center Code',
  'Tax Location Name',
  'Cost Center',
  'Coa',
  'Level',
  'Grade',
  'Gender',
  'Employment Status',
  'Join Date',
  'Terminate Date',
] as const;

export type HeadcountField = string;

export function isHeadcountField(field: string): field is HeadcountField {
  return HEADCOUNT_FIELDS.includes(field);
}