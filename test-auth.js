// test-auth.js
import { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';

const prisma = new PrismaClient();

async function testAuth() {
  console.log('🔍 Testing authentication...\n');

  // Test 1: Check user exists
  const user = await prisma.user.findUnique({
    where: { email: 'admin@payroll.com' }
  });

  console.log('1️⃣ User found:', user ? '✅ YES' : '❌ NO');
  if (user) {
    console.log('   - ID:', user.id);
    console.log('   - Email:', user.email);
    console.log('   - Role:', user.role);
    console.log('   - Password hash:', user.password.substring(0, 20) + '...');
  }

  // Test 2: Check password hash
  if (user) {
    const testPassword = 'admin123';
    const isValid = await compare(testPassword, user.password);
    console.log('\n2️⃣ Password "admin123" valid:', isValid ? '✅ YES' : '❌ NO');
  }

  await prisma.$disconnect();
}

testAuth().catch(console.error);