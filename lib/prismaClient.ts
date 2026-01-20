/**
 * Prisma Client Singleton
 * Handles lazy initialization to avoid build-time issues
 */

import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

function createPrismaClient(): PrismaClient {
  // Prisma v7 with SQLite - connection string is set via DATABASE_URL env var
  // and read from prisma.config.ts which has the datasource configured
  return new PrismaClient();
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
}

// Don't instantiate at module load time
export default null as any;
