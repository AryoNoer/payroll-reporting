// lib/field-calculations.ts
// Complete calculation & derivation functions for payroll reporting
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ========================================
 * DERIVED FIELDS (Business Logic)
 * ========================================
 */

/**
 * Calculate Cost Center By Function based on business rules
 * Rule 1: Jika Job Status Code dimulai dengan 8 digit angka → ambil 8 digit itu saja
 * Rule 2: Jika Job Status Code starts with "CAB_" → ambil 2 huruf pertama dari Cost Center Code
 */
export function deriveCostCenterByFunction(
  jobStatusCode: string | number | null | undefined,
  costCenterCode: string | number | null | undefined
): string {
  if (!jobStatusCode && !costCenterCode) return '';

  const jobStatus = String(jobStatusCode || '').trim();
  const costCenter = String(costCenterCode || '').trim();

  // Rule 1: Jika Job Status Code dimulai dengan 8 digit angka → ambil 8 digit pertama saja
  // Contoh: "26100000_UNIT_2506_CSPROGO" → "26100000"
  const match8Digits = jobStatus.match(/^(\d{8})/);
  if (match8Digits) {
    return match8Digits[1]; // Return only the 8 digits
  }

  // Rule 2: Jika Job Status Code starts with "CAB_" → ambil 2 huruf pertama dari Cost Center Code
  if (jobStatus.toUpperCase().startsWith('CAB_')) {
    // Ambil 2 huruf pertama dari Cost Center Code
    if (costCenter && /^[A-Za-z]{2}/.test(costCenter)) {
      return costCenter.substring(0, 2).toUpperCase(); // "AA00000001" → "AA"
    }
    // Jika tidak ada 2 huruf di depan, return as-is
    return costCenter;
  }

  // Default: return Job Status Code atau Cost Center Code
  return jobStatus || costCenter;
}

/**
 * Derive Coa from Cost Center
 * Rule: Jika contains "kantor pusat" → "600", else → "500"
 */
export function deriveCoa(costCenter: string | number | null | undefined): string {
  if (!costCenter) return '500'; // Default

  const centerLower = String(costCenter).toLowerCase();
  
  if (centerLower.includes('kantor pusat')) {
    return '600';
  }

  return '500';
}

/**
 * Derive Department from Org Unit (Direct copy)
 */
export function deriveDepartment(orgUnit: string | number | null | undefined): string {
  return String(orgUnit || '');
}

/**
 * Derive Tax Location Code from Tax Location (Direct copy)
 */
export function deriveTaxLocationCode(taxLocation: string | number | null | undefined): string {
  return String(taxLocation || '');
}

/**
 * Derive Tax Location Name from Tax Location (Direct copy)
 */
export function deriveTaxLocationName(taxLocation: string | number | null | undefined): string {
  return String(taxLocation || '');
}


/**
 * Derive Bank Account from Bank Account Name (Direct copy)
 */
export function deriveBankAccount(bankAccountName: string | number | null | undefined): string {
  return String(bankAccountName || '');
}

// lib/field-calculations.ts

/**
 * Derive Level from Grade based on mapping
 */
export function deriveLevel(grade: string | null | undefined): number | string {
  if (!grade) return '';
  
  const gradeStr = String(grade).toLowerCase().trim();
  
  // Grade to Level mapping
  const gradeMapping: Record<string, number> = {
    'ceo': 13,
    'chief': 12,
    'direktur': 12,
    'vice president': 11,
    'general manager': 10,
    'general manager pjs': 9,
    'senior manager': 9,
    'senior manager pjs': 9,
    'manager': 8,
    'manager pjs': 7,
    'junior manager': 7,
    'junior manager pjs': 7,
    'assistant manager': 6,
    'assistant manager pjs': 6,
    'senior supervisor': 5,
    'senior supervisor pjs': 5,
    'supervisor': 4,
    'supervisor pjs': 4,
    'senior staff': 3,
    'senior staff pjs': 3,
    'staff': 2,
    'junior staff': 1,
    'non-staff': 0,
  };
  
  // Try exact match first
  if (gradeMapping[gradeStr]) {
    return gradeMapping[gradeStr];
  }
  
  // Try partial match
  for (const [key, level] of Object.entries(gradeMapping)) {
    if (gradeStr.includes(key)) {
      return level;
    }
  }
  
  return ''; // Empty if no match
}

/**
 * ========================================
 * CALCULATED FIELDS (SUBTOTAL Formulas)
 * ========================================
 */

/**
 * Total Basic Salary = SUBTOTAL(9, AJ5:AO5)
 * Sum of: Basic Salary, Basic Salary Tambahan, Additional Salary, 
 *         Additional Salary Gross, Rapel Salary, Rapel Salary Gross
 */
export function calculateTotalBasicSalary(data: any): number {
  return (
    (Number(data['Basic Salary']) || 0) +
    (Number(data['Basic Salary Tambahan']) || 0) +
    (Number(data['Additional Salary']) || 0) +
    (Number(data['Additional Salary Gross']) || 0) +
    (Number(data['Rapel Salary']) || 0) +
    (Number(data['Rapel Salary Gross']) || 0)
  );
}

/**
 * Total Uang Makan = SUBTOTAL(9, AR5:AS5)
 * Sum of: Uang Makan, Additional Uang Makan
 */
export function calculateTotalUangMakan(data: any): number {
  return (
    (Number(data['Uang Makan']) || 0) +
    (Number(data['Additional Uang Makan']) || 0)
  );
}

/**
 * Total Uang Transport = SUBTOTAL(9, AU5:BA5)
 * Sum of: Uang Transport, Additional Uang Transport, Rapel Uang Transport,
 *         Tunjangan Transport Commercial, Additional Tunjangan Transport Commercial,
 *         and 2 more fields
 */
export function calculateTotalUangTransport(data: any): number {
  return (
    (Number(data['Uang Transport']) || 0) +
    (Number(data['Additional Uang Transport']) || 0) +
    (Number(data['Rapel Uang Transport']) || 0) +
    (Number(data['Tunjangan Transport Commercial']) || 0) +
    (Number(data['Additional Tunjangan Transport Commercial']) || 0)
    // Note: Add 2 more fields if identified from actual data
  );
}

/**
 * Total Tunjangan Jabatan = SUBTOTAL(9, BC5:BI5)
 * Sum of: Tunjangan Jabatan, Additional Tunjangan Jabatan, Rapel Tunjangan Jabatan,
 *         Tunjangan Jabatan Gross, Additional Tunjangan Jabatan Gross,
 *         Rapel Tunjangan Jabatan Gross, Tunjangan Jabatan PJS
 */
export function calculateTotalTunjanganJabatan(data: any): number {
  return (
    (Number(data['Tunjangan Jabatan']) || 0) +
    (Number(data['Additional Tunjangan Jabatan']) || 0) +
    (Number(data['Rapel Tunjangan Jabatan']) || 0) +
    (Number(data['Tunjangan Jabatan Gross']) || 0) +
    (Number(data['Additional Tunjangan Jabatan Gross']) || 0) +
    (Number(data['Rapel Tunjangan Jabatan Gross']) || 0) +
    (Number(data['Tunjangan Jabatan PJS']) || 0)
  );
}

/**
 * Total Insentif Inhouse = SUBTOTAL(9, BK5:BS5)
 * Sum of: Insentif, Insentif Gross, Rapel Insentif, Additional Insentif,
 *         Additional Tunjangan Relokasi, Additional Refund Loan,
 *         Tunjangan Tempat Tinggal, Reward, Additional Reward
 */
export function calculateTotalInsentifInhouse(data: any): number {
  return (
    (Number(data['Insentif']) || 0) +
    (Number(data['Insentif Gross']) || 0) +
    (Number(data['Rapel Insentif']) || 0) +
    (Number(data['Additional Insentif']) || 0) +
    (Number(data['Additional Tunjangan Relokasi']) || 0) +
    (Number(data['Additional Refund Loan']) || 0) +
    (Number(data['Tunjangan Tempat Tinggal']) || 0) +
    (Number(data['Reward']) || 0) +
    (Number(data['Additional Reward']) || 0)
  );
}

/**
 * Total Sisa Cuti = SUBTOTAL(9, BU5:BX5)
 * Sum of: Sisa Cuti Dibayarkan, Additional Sisa Cuti Dibayarkan,
 *         Sisa Cuti Dibayarkan Gross, Additional Sisa Cuti Dibayarkan Gross
 */
export function calculateTotalSisaCuti(data: any): number {
  return (
    (Number(data['Sisa Cuti Dibayarkan']) || 0) +
    (Number(data['Additional Sisa Cuti Dibayarkan']) || 0) +
    (Number(data['Sisa Cuti Dibayarkan Gross']) || 0) +
    (Number(data['Additional Sisa Cuti Dibayarkan Gross']) || 0)
  );
}

/**
 * Total Uang Pisah = SUBTOTAL(9, BZ5:CB5)
 * Sum of: Tunjangan Uang Pisah, Uang Pisah Gross, Additional Uang Pisah
 */
export function calculateTotalUangPisah(data: any): number {
  return (
    (Number(data['Tunjangan Uang Pisah']) || 0) +
    (Number(data['Uang Pisah Gross']) || 0) +
    (Number(data['Additional Uang Pisah']) || 0)
  );
}

/**
 * Total Tunjangan Operasional = SUBTOTAL(9, CD5:CG5)
 * Sum of: Tunjangan Operasional, Additional Tunjangan Operational,
 *         Rapel Tunjangan Operational, and 1 more field
 */
export function calculateTotalTunjanganOperasional(data: any): number {
  return (
    (Number(data['Tunjangan Operasional']) || 0) +
    (Number(data['Additional Tunjangan Operational']) || 0) +
    (Number(data['Rapel Tunjangan Operational']) || 0)
  );
}

/**
 * Total Komisi Karyawan = SUBTOTAL(9, CI5:CJ5)
 * Sum of: Komisi Karyawan, Additional Komisi Karyawan
 */
export function calculateTotalKomisiKaryawan(data: any): number {
  return (
    (Number(data['Komisi Karyawan']) || 0) +
    (Number(data['Additional Komisi Karyawan']) || 0)
  );
}

/**
 * Total Insentif Mitra = SUBTOTAL(9, CV5:DZ5)
 * This is a VERY LONG range (31 fields)
 * Includes all Insentif Mitra variations + Target Paket Mitra + Bonus variations
 */
export function calculateTotalInsentifMitra(data: any): number {
  const fields = [
    'Insentif Per Paket Mitra',
    'Insentif Perbantuan',
    'Additional Insentif Perbantuan',
    'Insentif Volta',
    'Target Paket',
    'Additional Target Paket',
    'Rapel Target Paket',
    'Additional Insentif Kerajinan Mitra',
    'Additional Insentif Sorter MItra',
    'Insentif Hari Minggu',
    'Rapel Insentif Hari Minggu',
    'Insentif Hari Minggu Mitra',
    'Insentif Kehadiran',
    'Insentif Kerajinan Mitra',
    'Insentif Mitra',
    'Additional Insentif Mitra',
    'Rapel Insentif Mitra',
    'Insentif Mitra Lain',
    'Additional Insentif Mitra Lain',
    'Rapel Insentif Mitra Lain',
    'Insentif Mitra Sorter',
    'Rapel Insentif Mitra Sorter',
    'Insentif Pembawaan Mitra 10 Kg',
    'Additional Insentif Per Paket Mitra',
    'Insentif Perbantuan Mitra',
    'Insentif Produktifitas Mitra',
    'Rapel Insentif Produktifitas Mitra',
    'Target Paket Mitra',
    'Additional Target Paket Mitra',
    'Rapel Target Paket Mitra'
  ];

  let total = 0;
  fields.forEach(field => {
    total += Number(data[field]) || 0;
  });

  return total;
}

/**
 * Total Bonus Inhouse = SUBTOTAL(9, EJ5:ES5)
 * Sum of all bonus variations for internal employees
 */
export function calculateTotalBonusInhouse(data: any): number {
  const fields = [
    'Bonus',
    'Additional Bonus Carrot And Stick',
    'Additional Bonus CPP',
    'Additional Bonus Paket',
    'Rapel Bonus Paket',
    'Bonus First & Last',
    'Bonus KPI',
    'Additional Bonus KPI',
    'Bonus COD',
    'Rapel Bonus COD'
  ];

  let total = 0;
  fields.forEach(field => {
    total += Number(data[field]) || 0;
  });

  return total;
}

/**
 * Total Bonus Mitra = SUBTOTAL(9, EU5:FE5)
 * Sum of all bonus variations for mitra
 */
export function calculateTotalBonusMitra(data: any): number {
  const fields = [
    'Bonus COD Mitra',
    'Additional Bonus COD Mitra',
    'Rapel Bonus COD Mitra',
    'Rapel Bonus Paket Mitra',
    'Rapel Bonus Per Paket',
    'Rapel Bonus Per Paket Mitra',
    'Bonus Mitra',
    'Additional Bonus Mitra',
    'Bonus Paket Coordinator',
    'Bonus Per Coli Mitra',
    'Bonus Volta'
  ];

  let total = 0;
  fields.forEach(field => {
    total += Number(data[field]) || 0;
  });

  return total;
}

/**
 * Total Lembur = SUBTOTAL(9, FG5:FJ5)
 * Sum of: Lembur - Line Haul, Lembur Harian, Lemburan, Additional Lemburan
 */
export function calculateTotalLembur(data: any): number {
  return (
    (Number(data['Lembur - Line Haul']) || 0) +
    (Number(data['Lembur Harian']) || 0) +
    (Number(data['Lemburan']) || 0) +
    (Number(data['Additional Lemburan']) || 0)
  );
}

/**
 * Total Perjalanan Dinas = SUBTOTAL(9, FL5:FM5)
 * Sum of: Uang Makan Perdin, Uang Saku Perdin
 */
export function calculateTotalPerjalananDinas(data: any): number {
  return (
    (Number(data['Uang Makan Perdin']) || 0) +
    (Number(data['Uang Saku Perdin']) || 0)
  );
}

/**
 * Total Biaya Pengobatan Karyawan = SUBTOTAL(9, FO5:FX5)
 * Sum of all medical claims
 */
export function calculateTotalBiayaPengobatanKaryawan(data: any): number {
  const fields = [
    'Claim Frame',
    'Claim Lensa',
    'Claim Rawat Inap',
    'Additional Claim Rawat Inap',
    'Claim Rawat Jalan',
    'Additional Claim Rawat Jalan',
    'Santunan Maternity Caesar',
    'Santunan Maternity Miscarriage',
    'Santunan Maternity Normal',
    'Additional Maternity'
  ];

  let total = 0;
  fields.forEach(field => {
    total += Number(data[field]) || 0;
  });

  return total;
}

/**
 * Total THR = SUBTOTAL(9, GB5:GD5)
 * Sum of: THR, Additional THR, Rapel THR
 */
export function calculateTotalTHR(data: any): number {
  return (
    (Number(data['THR']) || 0) +
    (Number(data['Additional THR']) || 0) +
    (Number(data['Rapel THR']) || 0)
  );
}

/**
 * Total BPJS TK = SUBTOTAL(9, GG5:GN5)
 * Sum of all BPJS Tenaga Kerja (Pemberi Kerja)
 */
export function calculateTotalBPJSTK(data: any): number {
  return (
    (Number(data['BPJS JKK (Pemberi Kerja)']) || 0) +
    (Number(data['BPJS JKK (Pemberi Kerja) Gross']) || 0) +
    (Number(data['BPJS JKM (Pemberi Kerja)']) || 0) +
    (Number(data['BPJS JKM (Pemberi Kerja) Gross']) || 0) +
    (Number(data['BPJS JHT (Pemberi Kerja)']) || 0) +
    (Number(data['BPJS JHT (Pemberi Kerja) Gross']) || 0) +
    (Number(data['BPJS Pensiun (Pemberi Kerja)']) || 0) +
    (Number(data['BPJS Pensiun (Pemberi Kerja) Gross']) || 0)
  );
}

/**
 * Total BPJS Kes = SUBTOTAL(9, GP5:GQ5)
 * Sum of: BPJS Kesehatan (Pemberi Kerja), BPJS Kesehatan (Pemberi Kerja) Gross
 */
export function calculateTotalBPJSKes(data: any): number {
  return (
    (Number(data['BPJS Kesehatan (Pemberi Kerja)']) || 0) +
    (Number(data['BPJS Kesehatan (Pemberi Kerja) Gross']) || 0)
  );
}

/**
 * Total Deduction
 * NOTE: Formula says "tidak ada rumus" - assuming manual or calculated from all deductions
 * This calculates sum of all deduction fields
 */
export function calculateTotalDeduction(data: any): number {
  const deductionFields = [
    'Deduction Bensin Harian',
    'Deduction Makan Harian',
    'Deduction Pulsa Harian',
    'Tunjangan Operational Dibayar Kas',
    'Uang Jalan - Line Haul (D)',
    'Deduction Komisi Karyawan',
    'Reward (D)',
    'Lembur - Line Haul (D)',
    'Lembur Harian (D)',
    'Uang Makan Perdin (D)',
    'Uang Saku Perdin (D)',
    'Potongan Hutang Cuti',
    'Pot. Own Risk',
    'Pot. Audit',
    'Pot. Barang Hilang',
    'Pot. Denda',
    'Pot. Handphone',
    'Pot. Kasbon',
    'Pot. Kasbon Harian',
    'Pot. Kerusakan Volta',
    'Pot. Lain',
    'Pot. Lain Gross',
    'Pot. Volta SEI',
    'Pot. Volta T-FAS',
    'Potongan COD',
    'Potongan Uang Penalti',
    'Deposit Atribut',
    'BPJS JKK (Kemitraan)',
    'BPJS JKM (Kemitraan)',
    'BPJS JHT',
    'BPJS JHT Gross',
    'BPJS Pensiun',
    'BPJS Pensiun Gross',
    'BPJS Kesehatan',
    'BPJS Kesehatan Gross'
  ];

  let total = 0;
  deductionFields.forEach(field => {
    total += Number(data[field]) || 0;
  });

  return total;
}

/**
 * ========================================
 * MASTER FUNCTION - Apply All Calculations
 * ========================================
 */
export function applyCalculationsAndDerivations(data: any): any {
  // 1. Derived fields (business logic)
  data['Cost Center By Function'] = deriveCostCenterByFunction(
    data['Jobstatus Code'],
    data['Cost Center Code']
  );
  data['Coa'] = deriveCoa(data['Cost Center']);
  data['Department'] = deriveDepartment(data['Org Unit']);
  data['Tax Location Code'] = deriveTaxLocationCode(data['Tax Location']);
  data['Tax Location Name'] = deriveTaxLocationName(data['Tax Location']);
  data['Bank Account'] = deriveBankAccount(data['Account Name']);
  data['Level'] = deriveLevel(data['Grade']);

  // 2. Calculated totals (SUBTOTAL formulas)
  data['Total Basic Salary'] = calculateTotalBasicSalary(data);
  data['Total Uang Makan'] = calculateTotalUangMakan(data);
  data['Total Uang Transport'] = calculateTotalUangTransport(data);
  data['Total Tunjangan Jabatan'] = calculateTotalTunjanganJabatan(data);
  data['Total Insentif Inhouse'] = calculateTotalInsentifInhouse(data);
  data['Total Sisa Cuti'] = calculateTotalSisaCuti(data);
  data['Total Uang Pisah'] = calculateTotalUangPisah(data);
  data['Total Tunjangan Operasional'] = calculateTotalTunjanganOperasional(data);
  data['Total Komisi Karyawan'] = calculateTotalKomisiKaryawan(data);
  data['Total Insentif Mitra'] = calculateTotalInsentifMitra(data);
  data['Total Bonus Inhouse'] = calculateTotalBonusInhouse(data);
  data['Total Bonus Mitra'] = calculateTotalBonusMitra(data);
  data['Total Lembur'] = calculateTotalLembur(data);
  data['Total Perjalanan Dinas'] = calculateTotalPerjalananDinas(data);
  data['Total Biaya Pengobatan Karyawan'] = calculateTotalBiayaPengobatanKaryawan(data);
  data['Total THR'] = calculateTotalTHR(data);
  data['Total BPJS TK'] = calculateTotalBPJSTK(data);
  data['Total BPJS Kes'] = calculateTotalBPJSKes(data);
  data['Total Deduction'] = calculateTotalDeduction(data);

  return data;
}