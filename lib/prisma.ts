// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.includes("?")
    ? `${process.env.DATABASE_URL}&statement_timeout=180000`
    : `${process.env.DATABASE_URL}?statement_timeout=180000`
  : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["error", "warn"]
      : ["error"],
    datasourceUrl: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/* graceful shutdown */
async function gracefulShutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

/* connection test */
export async function testSupabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { success: true, message: "Supabase connection OK" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
