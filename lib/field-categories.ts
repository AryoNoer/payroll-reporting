// lib/field-categories.ts
// Category mapping untuk 4-level hierarchical Excel headers

export interface FieldCategory {
  level1: string; // Main category: Basic Info, Allowance, Deduction, THP Balance, Netral
  level2: string; // Sub category: Salary, Tunjangan, Insentif, BPJS, etc.
  level3: string; // Detail category: Tunjangan Tidak Tetap, Loan, etc.
}

// Helper function untuk auto-detect category dari field name
export function getFieldCategory(fieldName: string): FieldCategory {
  const fieldLower = fieldName.toLowerCase();

  // ========================================
  // BASIC INFO (Metadata fields)
  // ========================================
  const basicInfoFields = [
    'no', 'name', 'employee no', 'no ktp', 'gov. tax file no.',
    'position', 'department', 'directorate', 'directorate 2', 'tax location code',
    'cost center by function', 'jobstatus code', 'jobstatus name',
    'work location code', 'work location', 'cost center code', 'tax location name',
    'cost center', 'coa', 'level', 'grade', 'gender', 'employment status',
    'join date', 'terminate date', 'length of service', 'tax status',
    'company bank account', 'company account name', 'company bank name',
    'bank account', 'account name', 'bank name', 'birth date',
    'insurance no bpjskt', 'insurance no bpjskes'
  ];

  if (basicInfoFields.some(f => fieldLower === f.toLowerCase())) {
    return { level1: 'Basic Info', level2: 'Basic Info', level3: 'Basic Info' };
  }

  // ========================================
  // ALLOWANCE - SALARY
  // ========================================
  if (fieldLower.includes('basic salary') || 
      fieldLower.includes('rapel salary') ||
      fieldLower.includes('additional salary') ||
      fieldLower === 'total basic salary') {
    return { level1: 'Allowance', level2: 'Salary', level3: 'Salary' };
  }

  // ========================================
  // ALLOWANCE - TUNJANGAN (Various types)
  // ========================================
  
  // Uang Makan & Transport
  if (fieldLower.includes('uang makan') || 
      fieldLower.includes('uang transport') ||
      fieldLower.includes('transport commercial') ||
      fieldLower === 'uang makan & transport') {
    return { level1: 'Allowance', level2: 'Tunjangan', level3: 'Tunjangan' };
  }

  // Tunjangan Jabatan
  if (fieldLower.includes('tunjangan jabatan')) {
    if (fieldLower.includes('pjs')) {
      return { level1: 'Allowance', level2: 'Tunjangan', level3: 'Tunjangan' };
    }
    return { level1: 'Allowance', level2: 'Tunjangan', level3: 'Tunjangan' };
  }

  // Tunjangan Tidak Tetap
  if (fieldLower.includes('sisa cuti dibayarkan') ||
      fieldLower.includes('uang pisah') ||
      fieldLower.includes('tunjangan relokasi') ||
      fieldLower.includes('refund loan')) {
    return { level1: 'Allowance', level2: 'Tunjangan Tidak Tetap', level3: 'Tunjangan Tidak Tetap' };
  }

  // Tunjangan Operasional
  if (fieldLower.includes('tunjangan operasional') ||
      fieldLower.includes('netral operasional') ||
      fieldLower.includes('komisi karyawan')) {
    return { level1: 'Allowance', level2: 'Tunjangan', level3: 'Tunjangan' };
  }

  // Tunjangan Harian
  if (fieldLower.includes('tunjangan pendidikan') ||
      fieldLower.includes('tunjangan bensin harian') ||
      fieldLower.includes('tunjangan makan harian') ||
      fieldLower.includes('tunjangan operasional harian') ||
      fieldLower.includes('tunjangan pulsa harian') ||
      fieldLower.includes('tunjangan volta')) {
    return { level1: 'Allowance', level2: 'Tunjangan', level3: 'Tunjangan' };
  }

  // ========================================
  // ALLOWANCE - INSENTIF
  // ========================================
  if (fieldLower.includes('insentif')) {
    // Insentif Mitra variations
    if (fieldLower.includes('mitra')) {
      return { level1: 'Allowance', level2: 'Insentif', level3: 'Insentif' };
    }
    // Regular Insentif
    return { level1: 'Allowance', level2: 'Insentif', level3: 'Insentif' };
  }

  // Target Paket (part of Insentif)
  if (fieldLower.includes('target paket')) {
    return { level1: 'Allowance', level2: 'Insentif', level3: 'Insentif' };
  }

  // ========================================
  // ALLOWANCE - BPJS (Pemberi Kerja)
  // ========================================
  if (fieldLower.includes('bpjs') && fieldLower.includes('pemberi kerja')) {
    return { level1: 'Allowance', level2: 'BPJS', level3: 'BPJS' };
  }

  // ========================================
  // ALLOWANCE - BONUS
  // ========================================
  if (fieldLower.includes('bonus')) {
    return { level1: 'Allowance', level2: 'Bonus', level3: 'Bonus' };
  }

  // ========================================
  // ALLOWANCE - REWARD
  // ========================================
  if (fieldLower.includes('reward') && !fieldLower.includes('(d)')) {
    return { level1: 'Allowance', level2: 'Reward', level3: 'Reward' };
  }

  // ========================================
  // ALLOWANCE - LEMBUR
  // ========================================
  if ((fieldLower.includes('lembur') || fieldLower.includes('lemburan')) && 
      !fieldLower.includes('(d)')) {
    return { level1: 'Allowance', level2: 'Lembur', level3: 'Lembur' };
  }

  // ========================================
  // ALLOWANCE - PERJALANAN DINAS
  // ========================================
  if ((fieldLower.includes('uang makan perdin') || 
       fieldLower.includes('uang saku perdin') ||
       fieldLower.includes('perjalanan dinas')) &&
      !fieldLower.includes('(d)')) {
    return { level1: 'Allowance', level2: 'Perjalanan Dinas', level3: 'Perjalanan Dinas' };
  }

  // ========================================
  // ALLOWANCE - KLAIM PENGOBATAN
  // ========================================
  if (fieldLower.includes('claim') || 
      fieldLower.includes('santunan') ||
      fieldLower.includes('maternity')) {
    return { level1: 'Allowance', level2: 'Klaim Pengobatan', level3: 'Klaim Pengobatan' };
  }

  // ========================================
  // ALLOWANCE - LOAN (as Allowance)
  // ========================================
  if (fieldLower.includes('bhr mitra') ||
      fieldLower.includes('pengembalian potongan volta')) {
    return { level1: 'Allowance', level2: 'Loan', level3: 'Loan' };
  }

  // ========================================
  // ALLOWANCE - THR
  // ========================================
  if (fieldLower.includes('thr') && !fieldLower.includes('dasar')) {
    return { level1: 'Allowance', level2: 'THR', level3: 'THR' };
  }

  // ========================================
  // ALLOWANCE - OTHER (catch remaining allowances)
  // ========================================
  if (fieldLower.includes('uang jalan') ||
      fieldLower.includes('uang kerajinan') ||
      fieldLower.includes('service motor') ||
      fieldLower.includes('severence') ||
      fieldLower.includes('loyalty fee')) {
    return { level1: 'Allowance', level2: 'Tunjangan', level3: 'Tunjangan' };
  }

  // ========================================
  // DEDUCTION
  // ========================================

  // Deduction - Tunjangan (negative)
  if (fieldLower.includes('deduction bensin') ||
      fieldLower.includes('deduction makan') ||
      fieldLower.includes('deduction pulsa') ||
      fieldLower.includes('deduction komisi') ||
      fieldLower.includes('operasional dibayar kas')) {
    return { level1: 'Deduction', level2: 'Tunjangan', level3: 'Tunjangan' };
  }

  // Deduction - Reward/Lembur (negative)
  if (fieldLower.includes('reward (d)') ||
      fieldLower.includes('lembur') && fieldLower.includes('(d)')) {
    return { level1: 'Deduction', level2: 'Reward', level3: 'Reward' };
  }

  // Deduction - Perjalanan Dinas (negative)
  if ((fieldLower.includes('uang makan perdin (d)') ||
       fieldLower.includes('uang saku perdin (d)')) ||
      (fieldLower.includes('uang jalan') && fieldLower.includes('(d)'))) {
    return { level1: 'Deduction', level2: 'Perjalanan Dinas', level3: 'Perjalanan Dinas' };
  }

  // Deduction - Cuti
  if (fieldLower.includes('potongan hutang cuti') ||
      fieldLower.includes('potongan cuti')) {
    return { level1: 'Deduction', level2: 'Cuti', level3: 'Cuti' };
  }

  // Deduction - Own Risk
  if (fieldLower.includes('own risk') || fieldLower.includes('potownrisk')) {
    return { level1: 'Deduction', level2: 'Own Risk', level3: 'Own Risk' };
  }

  // Deduction - Loan (Potongan)
  if (fieldLower.includes('pot. kasbon') ||
      fieldLower.includes('pot. audit') ||
      fieldLower.includes('pot. barang hilang') ||
      fieldLower.includes('pot. denda') ||
      fieldLower.includes('pot. handphone') ||
      fieldLower.includes('pot. kerusakan volta') ||
      fieldLower.includes('pot. lain') ||
      fieldLower.includes('pot. volta') ||
      fieldLower.includes('potongan cod') ||
      fieldLower.includes('potongan uang penalti') ||
      fieldLower.includes('deposit atribut') ||
      fieldLower.includes('kasbon (saldo') ||
      fieldLower.includes('potaudit') ||
      fieldLower.includes('potbrghilang') ||
      fieldLower.includes('potdenda') ||
      fieldLower.includes('pothp') ||
      fieldLower.includes('potkerusakanvolta') ||
      fieldLower.includes('potlain') ||
      fieldLower.includes('potvolta')) {
    return { level1: 'Deduction', level2: 'Loan', level3: 'Loan' };
  }

  // Deduction - BPJS (Karyawan/Kemitraan/Gross)
  if (fieldLower.includes('bpjs')) {
    if (fieldLower.includes('kemitraan') || 
        fieldLower.includes('gross') ||
        (fieldLower.includes('bpjs') && !fieldLower.includes('pemberi kerja'))) {
      return { level1: 'Deduction', level2: 'BPJS', level3: 'BPJS' };
    }
  }

  // ========================================
  // THP BALANCE
  // ========================================
  if (fieldLower === 'thp balancing' || fieldLower === 'total deduction') {
    return { level1: 'THP Balance', level2: 'THP Balance', level3: 'THP Balance' };
  }

  // ========================================
  // NETRAL
  // ========================================

  // Netral - Salary references
  if (fieldLower.includes('basic salary full') ||
      fieldLower.includes('prorate base') ||
      fieldLower.includes('basic jabatan')) {
    return { level1: 'Netral', level2: 'Salary', level3: 'Salary' };
  }

  // Netral - Tunjangan references
  if (fieldLower.includes('tunjangan jabatan full') ||
      fieldLower.includes('tunjangan operasional') && fieldLower.includes('basic') ||
      fieldLower.includes('netral tunjangan')) {
    return { level1: 'Netral', level2: 'Tunjangan', level3: 'Tunjangan' };
  }

  // Netral - Hari Kerja
  if (fieldLower.includes('hari kerja') || fieldLower.includes('hk payment')) {
    return { level1: 'Netral', level2: 'Hari Kerja', level3: 'Hari Kerja' };
  }

  // Netral - Insentif calculations
  if (fieldLower.includes('nilai insentif kelipatan') ||
      fieldLower.includes('pencapaian target') ||
      fieldLower.includes('target paket bulanan') ||
      fieldLower.includes('neutral check get')) {
    return { level1: 'Netral', level2: 'Insentif', level3: 'Insentif' };
  }

  // Netral - Bonus calculations
  if (fieldLower.includes('bonus kelipatan') ||
      fieldLower.includes('bonus per coli') ||
      fieldLower.includes('bonus utama') ||
      fieldLower.includes('zero bonus')) {
    return { level1: 'Netral', level2: 'Bonus', level3: 'Bonus' };
  }

  // Netral - Lembur
  if (fieldLower.includes('ovt hari raya') ||
      fieldLower.includes('ovt off value') ||
      fieldLower.includes('ovt weekday')) {
    return { level1: 'Netral', level2: 'Lembur', level3: 'Lembur' };
  }

  // Netral - Loan (Saldo Piutang)
  if (fieldLower.includes('potongan') && fieldLower.includes('salary deduction only')) {
    return { level1: 'Netral', level2: 'Loan', level3: 'Loan' };
  }

  // Netral - Jurnal
  if (fieldLower.includes('neutral jurnal') ||
      fieldLower.includes('jurnal balance')) {
    return { level1: 'Netral', level2: 'Jurnal', level3: 'Jurnal' };
  }

  // Netral - THR
  if (fieldLower.includes('dasar perhitungan thr') ||
      fieldLower.includes('total bulan prorate thr') ||
      fieldLower.includes('dasar tunjangan jabatan thr')) {
    return { level1: 'Netral', level2: 'THR', level3: 'THR' };
  }

  // Netral - BPJS basis
  if (fieldLower.includes('dasar bpjs')) {
    return { level1: 'Netral', level2: 'BPJS', level3: 'BPJS' };
  }

  // Netral - Flagging
  if (fieldLower.includes('periode dirumahkan') ||
      fieldLower.includes('flag per paket') ||
      fieldLower.includes('is freelance') ||
      fieldLower.includes('persentase dirumahkan') ||
      fieldLower.includes('persentase gaji sakit') ||
      fieldLower.includes('pjs flag')) {
    return { level1: 'Netral', level2: 'Flagging', level3: 'Flagging' };
  }

  // Netral - Cost Center
  if (fieldLower.includes('office cost center')) {
    return { level1: 'Netral', level2: 'Cost Center', level3: 'Cost Center' };
  }

  // Netral - Other calculations
  if (fieldLower.includes('total hari pembagi') ||
      fieldLower.includes('total pembawaan paket') ||
      fieldLower.includes('prorate active employee') ||
      fieldLower.includes('jumlah sisa cuti')) {
    return { level1: 'Netral', level2: 'Hari Kerja', level3: 'Hari Kerja' };
  }

  // ========================================
  // DEFAULT FALLBACK
  // ========================================
  // If nothing matches, try to categorize by type
  if (fieldLower.includes('tunjangan') || fieldLower.includes('allowance')) {
    return { level1: 'Allowance', level2: 'Tunjangan', level3: 'Tunjangan' };
  }
  if (fieldLower.includes('potongan') || fieldLower.includes('deduction')) {
    return { level1: 'Deduction', level2: 'Loan', level3: 'Loan' };
  }

  // Ultimate fallback to Netral
  return { level1: 'Netral', level2: 'Netral', level3: 'Netral' };
}

// Get all field names with their categories
export function categorizeFields(fieldNames: string[]): Map<string, FieldCategory> {
  const map = new Map<string, FieldCategory>();
  fieldNames.forEach(name => {
    map.set(name, getFieldCategory(name));
  });
  return map;
}