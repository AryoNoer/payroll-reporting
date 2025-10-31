/* eslint-disable @typescript-eslint/no-explicit-any */

// scripts/verify-fields.ts
import { prisma } from '@/lib/prisma';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'papaparse';

interface FieldAnalysis {
  csvHeaders: string[];
  csvHeaderCount: number;
  dbFieldCounts: {
    salary: number;
    allowance: number;
    deduction: number;
    neutral: number;
    total: number;
  };
  missingFields: string[];
  extraFields: string[];
  metadataInNeutral: string[];
  passed: boolean;
}

async function verifyFields(): Promise<FieldAnalysis> {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 FIELD COUNT VERIFICATION - 178 FIELDS TEST');
  console.log('='.repeat(60) + '\n');

  // Step 1: Get CSV headers
  console.log('[Step 1] Reading CSV headers...');
  let csvHeaders: string[] = [];
  
  try {
    const csvPath = join(process.cwd(), 'data', 'Tarikkan RAW DATA.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    if (lines.length > 1) {
      const firstLine = lines[0] || '';
      const secondLine = lines[1] || '';
      
      const firstLineUpper = firstLine.toUpperCase();
      const hasCategories = 
        firstLineUpper.includes('SALARY') || 
        firstLineUpper.includes('ALLOWANCE');
      
      const secondLineHasNames = 
        secondLine.includes('Name') || 
        secondLine.includes('Employee');
      
      if (hasCategories && secondLineHasNames) {
        console.log('✓ Detected double header format');
        const categoryParse = parse(firstLine, { header: false });
        const fieldParse = parse(secondLine, { header: false });
        
        const categories = (categoryParse.data[0] || []) as string[];
        const fields = (fieldParse.data[0] || []) as string[];
        
        // Merge headers
        for (let i = 0; i < Math.max(categories.length, fields.length); i++) {
          const category = (categories[i] || '').trim();
          const field = (fields[i] || '').trim();
          
          if (!field || /^\d+$/.test(field)) {
            csvHeaders.push(category || `Column_${i}`);
          } else {
            csvHeaders.push(field || `Column_${i}`);
          }
        }
      } else {
        const parsed = parse(secondLine, { header: false });
        csvHeaders = (parsed.data[0] || []) as string[];
      }
    }
    
    // Filter out empty headers
    csvHeaders = csvHeaders.filter(h => h && h.trim());
    
    console.log(`✓ Found ${csvHeaders.length} columns in CSV`);
    console.log(`  Sample: ${csvHeaders.slice(0, 5).join(', ')}...`);
    console.log(`  Expected to store: ${csvHeaders.length - 1} (excluding "No")\n`);
  } catch {
    console.log('⚠️  Could not read CSV file, will check database only\n');
  }

  // Step 2: Get employee data from database
  console.log('[Step 2] Fetching employee data from database...');
  const employee = await prisma.employee.findFirst({
    include: {
      upload: {
        select: {
          originalName: true,
          status: true,
          uploadedAt: true
        }
      }
    }
  });
  
  if (!employee) {
    console.log('❌ No employee found in database');
    console.log('   Please upload a CSV file first.');
    return {
      csvHeaders: [],
      csvHeaderCount: 0,
      dbFieldCounts: { salary: 0, allowance: 0, deduction: 0, neutral: 0, total: 0 },
      missingFields: [],
      extraFields: [],
      metadataInNeutral: [],
      passed: false
    };
  }

  console.log(`✓ Found employee: ${employee.name} (${employee.employeeNo})`);
  console.log(`  From upload: ${employee.upload.originalName}`);
  console.log(`  Upload status: ${employee.upload.status}`);
  console.log(`  Uploaded at: ${new Date(employee.upload.uploadedAt).toLocaleString()}\n`);

  // Step 3: Analyze JSON fields
  console.log('[Step 3] Analyzing JSON field distribution...');
  
  const salaryData = employee.salaryData as any;
  const allowanceData = employee.allowanceData as any;
  const deductionData = employee.deductionData as any;
  const neutralData = employee.neutralData as any;

  const salaryFields = Object.keys(salaryData || {});
  const allowanceFields = Object.keys(allowanceData || {});
  const deductionFields = Object.keys(deductionData || {});
  const neutralFields = Object.keys(neutralData || {});

  const totalFieldsInJson = 
    salaryFields.length +
    allowanceFields.length +
    deductionFields.length +
    neutralFields.length;

  console.log('📊 Field Distribution:');
  console.log(`   ├─ Salary:    ${salaryFields.length.toString().padStart(3)} fields`);
  console.log(`   ├─ Allowance: ${allowanceFields.length.toString().padStart(3)} fields`);
  console.log(`   ├─ Deduction: ${deductionFields.length.toString().padStart(3)} fields`);
  console.log(`   ├─ Neutral:   ${neutralFields.length.toString().padStart(3)} fields`);
  console.log(`   └─ TOTAL:     ${totalFieldsInJson.toString().padStart(3)} fields\n`);

  // Step 4: Check metadata fields in neutral
  console.log('[Step 4] Checking metadata fields in neutral category...');
  const metadataFields = [
    'Name', 'Employee No', 'Gender', 'No KTP', 'Gov. Tax File No.',
    'Position', 'Directorate', 'Org Unit', 'Grade', 'Employment Status',
    'Join Date', 'Terminate Date', 'Length of Service', 'Tax Status'
  ];

  const metadataInNeutral = metadataFields.filter(mf => 
    neutralFields.includes(mf)
  );

  console.log(`   Expected metadata in neutral: ${metadataFields.length}`);
  console.log(`   Found in neutral: ${metadataInNeutral.length}`);
  
  if (metadataInNeutral.length === metadataFields.length) {
    console.log(`   Status: ✅ All metadata fields available for selection\n`);
  } else {
    console.log(`   Status: ⚠️  Some metadata missing from neutral\n`);
    const missing = metadataFields.filter(mf => !metadataInNeutral.includes(mf));
    console.log(`   Missing: ${missing.join(', ')}\n`);
  }

  // Step 5: Compare with CSV headers
  let missingFields: string[] = [];
  let extraFields: string[] = [];
  
  if (csvHeaders.length > 0) {
    console.log('[Step 5] Comparing CSV headers with database fields...');
    
    const allDbFields = [
      ...salaryFields,
      ...allowanceFields,
      ...deductionFields,
      ...neutralFields
    ];

    const csvFieldsToCheck = csvHeaders.filter(h => h !== 'No');
    missingFields = csvFieldsToCheck.filter(h => !allDbFields.includes(h));
    extraFields = allDbFields.filter(f => !csvFieldsToCheck.includes(f));

    if (missingFields.length > 0) {
      console.log(`\n   ⚠️  Missing Fields (in CSV but not in DB): ${missingFields.length}`);
      missingFields.slice(0, 10).forEach((field, idx) => {
        console.log(`      ${idx + 1}. ${field}`);
      });
      if (missingFields.length > 10) {
        console.log(`      ... and ${missingFields.length - 10} more`);
      }
    } else {
      console.log('\n   ✅ All CSV fields are stored in database!');
    }

    if (extraFields.length > 0) {
      console.log(`\n   ℹ️  Extra Fields (in DB but not in original CSV): ${extraFields.length}`);
      console.log(`      (This is OK if fields were added/renamed during processing)`);
    }
    console.log('');
  }

  // Step 6: Sample fields from each category
  console.log('[Step 6] Sample fields from each category:\n');

  if (salaryFields.length > 0) {
    console.log('💰 SALARY FIELDS:');
    salaryFields.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f}`);
    });
    console.log('');
  }

  if (allowanceFields.length > 0) {
    console.log('📈 ALLOWANCE FIELDS (first 15):');
    allowanceFields.slice(0, 15).forEach((f, i) => {
      console.log(`   ${i + 1}. ${f}`);
    });
    if (allowanceFields.length > 15) {
      console.log(`   ... and ${allowanceFields.length - 15} more\n`);
    }
  }

  if (deductionFields.length > 0) {
    console.log('📉 DEDUCTION FIELDS (first 15):');
    deductionFields.slice(0, 15).forEach((f, i) => {
      console.log(`   ${i + 1}. ${f}`);
    });
    if (deductionFields.length > 15) {
      console.log(`   ... and ${deductionFields.length - 15} more\n`);
    }
  }

  if (neutralFields.length > 0) {
    console.log('📊 NEUTRAL FIELDS (first 20):');
    neutralFields.slice(0, 20).forEach((f, i) => {
      console.log(`   ${i + 1}. ${f}`);
    });
    if (neutralFields.length > 20) {
      console.log(`   ... and ${neutralFields.length - 20} more\n`);
    }
  }

  // Step 7: Final validation
  console.log('='.repeat(60));
  console.log('📋 VALIDATION SUMMARY');
  console.log('='.repeat(60));

  const EXPECTED_TOTAL = 177; // 178 - 1 "No" column
  const difference = totalFieldsInJson - EXPECTED_TOTAL;

  console.log(`CSV Headers:          ${csvHeaders.length || 'N/A'}`);
  console.log(`Expected in DB:       ${EXPECTED_TOTAL} (excluding "No")`);
  console.log(`Actually Stored:      ${totalFieldsInJson}`);
  console.log(`Difference:           ${difference > 0 ? '+' : ''}${difference}`);
  console.log(`Missing Fields:       ${missingFields.length}`);
  console.log(`Metadata in Neutral:  ${metadataInNeutral.length}/${metadataFields.length}`);

  // Determine if test passed
  const passed = 
    Math.abs(difference) <= 5 &&
    missingFields.length === 0 &&
    metadataInNeutral.length >= metadataFields.length - 2;

  console.log(`\n🎯 Test Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('='.repeat(60) + '\n');

  if (!passed) {
    console.log('💡 Troubleshooting Tips:');
    if (Math.abs(difference) > 5) {
      console.log('   • Field count mismatch detected');
      console.log('   • Check skipFields in processUploadData()');
      console.log('   • Verify categorization logic');
    }
    if (missingFields.length > 0) {
      console.log('   • Some CSV fields are not being stored');
      console.log('   • Check field name matching logic');
    }
    if (metadataInNeutral.length < metadataFields.length - 2) {
      console.log('   • Metadata fields not saved to neutralData');
      console.log('   • Add: if (dedicatedFields.has(key)) neutralData[key] = parsedValue');
    }
    console.log('');
  }

  return {
    csvHeaders,
    csvHeaderCount: csvHeaders.length,
    dbFieldCounts: {
      salary: salaryFields.length,
      allowance: allowanceFields.length,
      deduction: deductionFields.length,
      neutral: neutralFields.length,
      total: totalFieldsInJson
    },
    missingFields,
    extraFields,
    metadataInNeutral,
    passed
  };
}

// Main execution
verifyFields()
  .then(async (result) => {
    // Save result to JSON
    const outputPath = join(process.cwd(), 'scripts', 'verify-result.json');
    
    try {
      writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`📄 Detailed results saved to: ${outputPath}\n`);
    } catch {
      console.log('⚠️  Could not save results to file\n');
    }

    await prisma.$disconnect();
    process.exit(result.passed ? 0 : 1);
  })
  .catch(async (e) => {
    console.error('\n❌ Test failed with error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });