// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
  db: {
    url: process.env.DATABASE_URL 
      ? process.env.DATABASE_URL.includes('?')
        ? `${process.env.DATABASE_URL}&statement_timeout=180000`
        : `${process.env.DATABASE_URL}?statement_timeout=180000`
      : undefined
  },
},
    // ✅ Supabase-optimized transaction settings
    transactionOptions: {
      maxWait: 30000,  // 30 seconds (Supabase has timeout limits)
      timeout: 90000,  // 90 seconds max per transaction
      isolationLevel: 'ReadCommitted', // Best for bulk inserts
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ✅ Supabase connection test with proper error handling
const connectWithTimeout = async () => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Supabase connection timeout after 10s')), 10000)
  );

  const connect = prisma.$connect();

  try {
    await Promise.race([connect, timeout]);
    console.log('✅ Supabase database connected successfully');
    
    // Test query to verify connection and show stats
    try {
      const count = await prisma.employeeComponent.count();
      console.log(`📊 Database contains ${count.toLocaleString()} employee components`);
      
      // Show database size estimate (rough calculation)
      if (count > 0) {
        const estimatedSizeMB = Math.round((count * 0.5) / 1000); // ~500 bytes per row
        console.log(`💾 Estimated database size: ~${estimatedSizeMB}MB`);
        
        // Warn if approaching Supabase free tier limit (2GB)
        if (estimatedSizeMB > 1500) {
          console.warn('⚠️  Database size approaching 2GB limit. Consider upgrading Supabase plan.');
        }
      }
    } catch (queryError) {
      console.warn('⚠️  Could not fetch database stats (table might not exist yet)');
    }
  } catch (error) {
    console.error('❌ Supabase connection failed:', error instanceof Error ? error.message : error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check your DATABASE_URL in .env file');
    console.error('2. Verify Supabase project is active (not paused)');
    console.error('3. Check if database password is correct');
    console.error('4. Ensure network allows connections to Supabase');
    console.error('5. Visit: https://supabase.com/dashboard/project/oebsybbxoivdwpdugrjy/settings/database');
  }
};

connectWithTimeout();

// ✅ Graceful shutdown for Supabase connections
const gracefulShutdown = async () => {
  try {
    await prisma.$disconnect();
    console.log('🔌 Supabase database disconnected');
  } catch (error) {
    console.error('Error disconnecting from Supabase:', error);
  }
};

process.on('beforeExit', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ✅ Export helper for manual connection testing
export async function testSupabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { success: true, message: 'Supabase connection OK' };
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Connection failed' 
    };
  }
}