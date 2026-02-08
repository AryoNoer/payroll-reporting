// lib/prisma.ts
// ✅ Updated for Railway PostgreSQL (no Supabase dependency)

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ✅ Add statement timeout to prevent long-running queries
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

// ✅ Prevent multiple instances in development
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/* ✅ Graceful shutdown handlers */
async function gracefulShutdown() {
  console.log("Closing database connection...");
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

/* ✅ Database connection test function */
export async function testDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Database connection successful");
    return { success: true, message: "Database connection OK" };
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/* ✅ Helper: Get database status */
export async function getDatabaseStatus() {
  try {
    const result = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT version() as version
    `;
    return {
      connected: true,
      version: result[0]?.version || "Unknown",
      host: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "Unknown",
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}