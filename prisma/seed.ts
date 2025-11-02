/* eslint-disable @typescript-eslint/no-explicit-any */

import { PrismaClient, ComponentType } from '@prisma/client';
import { parse } from 'papaparse';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding master data components...');
  
  // Read Master Data Component.csv
  const csvPath = join(process.cwd(), 'data', 'Master Data Component.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  
  const { data } = parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  for (const row of data as any[]) {
    if (row.Code && row.Name && row.Type) {
      const type = row.Type.toUpperCase() as ComponentType;
      
      await prisma.component.upsert({
        where: { code: row.Code },
        update: {
          name: row.Name,
          type: type,
          notes: row.Notes || null,
          isActive: row.Notes !== 'Inactive',
        },
        create: {
          code: row.Code,
          name: row.Name,
          type: type,
          notes: row.Notes || null,
          isActive: row.Notes !== 'Inactive',
        },
      });
    }
  }
  
  console.log('✅ Master data components seeded successfully');
  
  // Create default admin user
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { email: 'dinda@test.com' },
    update: {},
    create: {
      email: 'dinda@test.com',
      name: 'Dinda',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  
  console.log('✅ Default admin user created');
  console.log('   Email: dinda@test.com');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });