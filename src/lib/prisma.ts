import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function ensureDbInitialized(): Promise<void> {
  // Cloud PostgreSQL tables are managed by Prisma schema migrations / db push
  return Promise.resolve();
}

export default prisma;
