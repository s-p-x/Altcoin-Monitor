/**
 * Prisma Client Singleton
 * Handles lazy initialization to avoid build-time issues
 * This ensures PrismaClient is never instantiated during build phase
 */

import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

/**
 * Get or create Prisma client instance
 * Only called at runtime, never during build
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Only instantiate when actually needed (at runtime)
    prisma = new PrismaClient();
  }
  return prisma;
}

export default null as any;
