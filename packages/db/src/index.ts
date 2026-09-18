import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient — mencegah exhaust koneksi di dev (hot reload)
 * dan dipakai bersama oleh web + worker.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.LOG_LEVEL === "debug" ? ["query", "warn", "error"] : ["warn", "error"],
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
export default prisma;