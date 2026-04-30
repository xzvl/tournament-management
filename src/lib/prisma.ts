import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function resolveDatabaseUrl(): string | undefined {
  // Support both custom env and Vercel Postgres integration env names.
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  );
}

const databaseUrl = resolveDatabaseUrl();

if (!databaseUrl) {
  console.warn('Prisma initialization warning: no database URL env var found. Expected DATABASE_URL or POSTGRES_PRISMA_URL.');
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient(
  databaseUrl
    ? {
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
      }
    : undefined
);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
