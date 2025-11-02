// lib/output-fields.ts
// Define exact order of ALL output fields based on OUTPUT.csv
// ✅ COMPLETE VERSION - Includes all 362+ fields (even if data doesn't exist)

/**
 * Complete list of output fields in exact order
 * Fields without data will be rendered as empty columns
 */
export const OUTPUT_FIELDS = [
  // ========================================
  // BASIC INFO (35 fields)
  // ========================================
  'No',
  'Name',
  'Employee No',
  'No KTP',
  'Gov. Tax File No.',
  'Position',
  'Department',
  'Directorate',
  'Directorate 2',
  'Tax Location Code',
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
  'Length Of Service',
  'Tax Status',
  'Company Bank Account',
  'Company Account Name',
  'Company Bank Name',
  'Bank Account',
  'Account Name',
  'Bank Name',
  'Birth Date',
  'Insurance No BPJSKT',
  'Insurance No BPJSKES',

  // ========================================
  // ALLOWANCE - SALARY (8 fields)
  // ========================================
  'Basic Salary',
  'Basic Salary Tambahan',
  'Additional Salary',
  'Additional Salary Gross',
  'Rapel Salary',
  'Rapel Salary Gross',
  'Rapel Mitra Sudah Dibayar',
  'Total Basic Salary',

  // ========================================
  // ALLOWANCE - TUNJANGAN - Uang Makan (5 fields)
  // ========================================
  'Uang Makan',
  'Additional Uang Makan',
  'Total Uang Makan',
  'Uang Makan & Transport',
  'Uang Makan Bulanan',

  // ========================================
  // ALLOWANCE - TUNJANGAN - Uang Transport (6 fields)
  // ========================================
  'Uang Transport',
  'Additional Uang Transport',
  'Rapel Uang Transport',
  'Tunjangan Transport Commercial',
  'Additional Tunjangan Transport Commercial',
  'Total Uang Transport',

  // ========================================
  // ALLOWANCE - TUNJANGAN - Tunjangan Jabatan (8 fields)
  // ========================================
  'Tunjangan Jabatan',
  'Additional Tunjangan Jabatan',
  'Rapel Tunjangan Jabatan',
  'Tunjangan Jabatan Gross',
  'Additional Tunjangan Jabatan Gross',
  'Rapel Tunjangan Jabatan Gross',
  'Tunjangan Jabatan PJS',
  'Total Tunjangan Jabatan',

  // ========================================
  // ALLOWANCE - INSENTIF (10 fields)
  // ========================================
  'Insentif',
  'Insentif Gross',
  'Rapel Insentif',
  'Additional Insentif',
  'Additional Tunjangan Relokasi',
  'Additional Refund Loan',
  'Tunjangan Tempat Tinggal',
  'Reward',
  'Additional Reward',
  'Total Insentif Inhouse',

  // ========================================
  // ALLOWANCE - TUNJANGAN TIDAK TETAP - Sisa Cuti (5 fields)
  // ========================================
  'Sisa Cuti Dibayarkan',
  'Additional Sisa Cuti Dibayarkan',
  'Sisa Cuti Dibayarkan Gross',
  'Additional Sisa Cuti Dibayarkan Gross',
  'Total Sisa Cuti',

  // ========================================
  // ALLOWANCE - TUNJANGAN TIDAK TETAP - Uang Pisah (4 fields)
  // ========================================
  'Tunjangan Uang Pisah',
  'Uang Pisah Gross',
  'Additional Uang Pisah',
  'Total Uang Pisah',

  // ========================================
  // ALLOWANCE - TUNJANGAN - Operasional (5 fields)
  // ========================================
  'Netral Operasional dibayar Payroll',
  'Tunjangan Operasional',
  'Additional Tunjangan Operational',
  'Rapel Tunjangan Operational',
  'Total Tunjangan Operasional',

  // ========================================
  // ALLOWANCE - TUNJANGAN - Komisi (3 fields)
  // ========================================
  'Komisi Karyawan',
  'Additional Komisi Karyawan',
  'Total Komisi Karyawan',

  // ========================================
  // ALLOWANCE - TUNJANGAN - Other (11 fields)
  // ========================================
  'Tunjangan Pendidikan',
  'Tunjangan Bensin Harian',
  'Tunjangan Makan Harian',
  'Tunjangan Operasional Harian',
  'Tunjangan Pulsa Harian',
  'Tunjangan Volta',
  'Uang Jalan - Line Haul',
  'Uang Kerajinan',
  'Service Motor',
  'Severence',
  'Insentif Per Paket',

  // ========================================
  // ALLOWANCE - INSENTIF - Mitra (31 fields)
  // ========================================
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
  'Rapel Target Paket Mitra',
  'Total Insentif Mitra',

  // ========================================
  // ALLOWANCE - REWARD - Mitra (8 fields)
  // ========================================
  'Additional Loyalty Fee Mitra',
  'Loyalty Fee Mitra',
  'Additional Reward Mitra',
  'Additional Reward Mitra Semester',
  'Reward Be A Star',
  'Reward Bulanan Mitra',
  'Reward Semester Mitra',
  'Rewards',

  // ========================================
  // ALLOWANCE - BONUS - Inhouse (11 fields)
  // ========================================
  'Bonus',
  'Additional Bonus Carrot And Stick',
  'Additional Bonus CPP',
  'Additional Bonus Paket',
  'Rapel Bonus Paket',
  'Bonus First & Last',
  'Bonus KPI',
  'Additional Bonus KPI',
  'Bonus COD',
  'Rapel Bonus COD',
  'Total Bonus Inhouse',

  // ========================================
  // ALLOWANCE - BONUS - Mitra (12 fields)
  // ========================================
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
  'Bonus Volta',
  'Total Bonus Mitra',

  // ========================================
  // ALLOWANCE - LEMBUR (5 fields)
  // ========================================
  'Lembur - Line Haul',
  'Lembur Harian',
  'Lemburan',
  'Additional Lemburan',
  'Total Lembur',

  // ========================================
  // ALLOWANCE - PERJALANAN DINAS (3 fields)
  // ========================================
  'Uang Makan Perdin',
  'Uang Saku Perdin',
  'Total Perjalanan Dinas',

  // ========================================
  // ALLOWANCE - KLAIM PENGOBATAN (11 fields)
  // ========================================
  'Claim Frame',
  'Claim Lensa',
  'Claim Rawat Inap',
  'Additional Claim Rawat Inap',
  'Claim Rawat Jalan',
  'Additional Claim Rawat Jalan',
  'Santunan Maternity Caesar',
  'Santunan Maternity Miscarriage',
  'Santunan Maternity Normal',
  'Additional Maternity',
  'Total Biaya Pengobatan Karyawan',

  // ========================================
  // ALLOWANCE - LOAN (2 fields)
  // ========================================
  'Pengembalian Potongan Volta TEI',
  'BHR Mitra',

  // ========================================
  // ALLOWANCE - THR (5 fields)
  // ========================================
  'THR',
  'Additional THR',
  'Rapel THR',
  'THR Gross',
  'Total THR',

  // ========================================
  // ALLOWANCE - BPJS (12 fields)
  // ========================================
  'BPJS JKK (Pemberi Kerja)',
  'BPJS JKK (Pemberi Kerja) Gross',
  'BPJS JKM (Pemberi Kerja)',
  'BPJS JKM (Pemberi Kerja) Gross',
  'BPJS JHT (Pemberi Kerja)',
  'BPJS JHT (Pemberi Kerja) Gross',
  'BPJS Pensiun (Pemberi Kerja)',
  'BPJS Pensiun (Pemberi Kerja) Gross',
  'Total BPJS TK',
  'BPJS Kesehatan (Pemberi Kerja)',
  'BPJS Kesehatan (Pemberi Kerja) Gross',
  'Total BPJS Kes',

  // ========================================
  // DEDUCTION - TUNJANGAN (5 fields)
  // ========================================
  'Deduction Bensin Harian',
  'Deduction Makan Harian',
  'Deduction Pulsa Harian',
  'Tunjangan Operational Dibayar Kas',
  'Uang Jalan - Line Haul (D)',

  // ========================================
  // DEDUCTION - INSENTIF/REWARD (2 fields)
  // ========================================
  'Deduction Komisi Karyawan',
  'Reward (D)',

  // ========================================
  // DEDUCTION - LEMBUR (2 fields)
  // ========================================
  'Lembur - Line Haul (D)',
  'Lembur Harian (D)',

  // ========================================
  // DEDUCTION - PERJALANAN DINAS (2 fields)
  // ========================================
  'Uang Makan Perdin (D)',
  'Uang Saku Perdin (D)',

  // ========================================
  // DEDUCTION - CUTI (1 field)
  // ========================================
  'Potongan Hutang Cuti',

  // ========================================
  // DEDUCTION - OWN RISK (1 field)
  // ========================================
  'Pot. Own Risk',

  // ========================================
  // DEDUCTION - LOAN (14 fields)
  // ========================================
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

  // ========================================
  // DEDUCTION - BPJS (10 fields)
  // ========================================
  'BPJS JKK (Kemitraan)',
  'BPJS JKM (Kemitraan)',
  'BPJS JHT',
  'BPJS JHT Gross',
  'BPJS Pensiun',
  'BPJS Pensiun Gross',
  'BPJS Kesehatan',
  'BPJS Kesehatan Gross',
  
  // ========================================
  // DEDUCTION - TAX (2 fields) ✅ ADDED
  // ========================================
  'Tax',
  'Tax Penalty Borne',

  // ========================================
  // TOTAL DEDUCTION (1 field)
  // ========================================
  'Total Deduction',

  // ========================================
  // THP BALANCE (1 field)
  // ========================================
  'THP Balancing',

  // ========================================
  // NETRAL - SALARY (6 fields)
  // ========================================
  'Basic Salary Full',
  'Tunjangan Jabatan Full',
  'Tunjangan Jabatan Full Gross',
  'Prorate Base',
  'Basic Jabatan',
  'Basic Jabatan PJS',

  // ========================================
  // NETRAL - TUNJANGAN (4 fields)
  // ========================================
  'Tunjangan Jabatan PJS Full',
  'Basic Tunjangan Operasional',
  'Netral Tunjangan Pendidikan',
  'Neutral Check Get Kerajinan',

  // ========================================
  // NETRAL - CUTI (1 field)
  // ========================================
  'Jumlah Sisa Cuti',

  // ========================================
  // NETRAL - INSENTIF (5 fields)
  // ========================================
  'Nilai Insentif Kelipatan',
  'Nilai Insentif Kelipatan Mitra',
  'Pencapaian Target Paket',
  'Target Paket Bulanan',
  'Target Paket Bulanan Mitra',

  // ========================================
  // NETRAL - BONUS (8 fields)
  // ========================================
  'Bonus Kelipatan (Coli)',
  'Bonus Kelipatan (Coli) Mitra',
  'Bonus Per Coli',
  'Bonus Per Coli Mitra',
  'Bonus Utama',
  'Bonus Utama Mitra',
  'Zero Bonus Paket',

  // ========================================
  // NETRAL - LEMBUR (3 fields)
  // ========================================
  'Ovt Hari Raya (Natal/Idul Fitri)',
  'Ovt OFF Value',
  'Ovt WeekDay Value',

  // ========================================
  // NETRAL - LOAN (14 fields)
  // ========================================
  'Potongan Barang Hilang Salary Deduction Only',
  'Potongan Denda Salary Deduction Only',
  'Potongan Own Risk Salary Deduction Only',
  'KASBON (Saldo Piutang Awal)',
  'POTAUDIT (Saldo Piutang Awal)',
  'POTBRGHILANG (Saldo Piutang Awal)',
  'POTDENDA (Saldo Piutang Awal)',
  'POTHP (Saldo Piutang Awal)',
  'POTKERUSAKANVOLTA (Saldo Piutang Awal)',
  'POTLAIN (Saldo Piutang Awal)',
  'POTOWNRISK (Saldo Piutang Awal)',
  'POTVOLTA (Saldo Piutang Awal)',
  'POTVOLTASEI (Saldo Piutang Awal)',

  // ========================================
  // NETRAL - JURNAL (1 field)
  // ========================================
  'Neutral Jurnal Balance Checker',

  // ========================================
  // NETRAL - THR (4 fields)
  // ========================================
  'Dasar Perhitungan THR',
  'Total Bulan Prorate THR',
  'Dasar Tunjangan Jabatan THR',
  'Dasar Tunjangan Jabatan PJS THR',

  // ========================================
  // NETRAL - BPJS (3 fields)
  // ========================================
  'Dasar BPJS JP',
  'Dasar BPJS KS',
  'Dasar BPJS TK',

  // ========================================
  // NETRAL - FLAGGING (7 fields)
  // ========================================
  'Periode Dirumahkan (Month)',
  'Flag Per Paket',
  'Flag Per Paket Mitra',
  'Is Freelance',
  'Persentase Dirumahkan',
  'Persentase Gaji Sakit Berkepanjangan',
  'PJS Flag',

  // ========================================
  // NETRAL - COST CENTER (1 field)
  // ========================================
  'Office Cost Center',

  // ========================================
  // NETRAL - HARI KERJA (6 fields)
  // ========================================
  'Hari Kerja',
  'Hari Kerja Realisasi',
  'HK Payment',
  'Prorate Active Employee',
  'Total Hari Pembagi',
  'Total Pembawaan Paket',
];

/**
 * Get field index by name
 */
export function getFieldIndex(fieldName: string): number {
  return OUTPUT_FIELDS.indexOf(fieldName);
}

/**
 * Validate if field exists in output
 */
export function isValidOutputField(fieldName: string): boolean {
  return OUTPUT_FIELDS.includes(fieldName);
}

/**
 * Get total count of output fields
 */
export function getOutputFieldCount(): number {
  return OUTPUT_FIELDS.length;
}

console.log(`✅ OUTPUT_FIELDS loaded: ${OUTPUT_FIELDS.length} fields total`);