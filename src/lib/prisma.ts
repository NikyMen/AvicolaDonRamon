import { PrismaClient } from "@prisma/client";

// Singleton para evitar múltiples instancias en desarrollo (hot reload).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Indica si hay una base de datos configurada. */
export const hasDatabase = Boolean(process.env.DATABASE_URL);
