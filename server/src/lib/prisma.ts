import { PrismaClient } from "@prisma/client";

// Singleton Prisma client — avoids creating a new client per import,
// which exhausts DB connections under ts-node-dev's hot reload.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}