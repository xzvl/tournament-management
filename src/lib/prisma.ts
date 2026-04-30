import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function normalizeDatabaseUrl(url: string): string {
  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    // Supabase and many managed Postgres providers require SSL in serverless environments.
    if (!parsed.searchParams.has('sslmode')) {
      parsed.searchParams.set('sslmode', 'require');
    }

    // Supabase pooler URLs need pgbouncer mode for Prisma compatibility.
    if (host.includes('pooler.supabase.com') && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function resolveDatabaseUrl(): string | undefined {
  // Support both custom env and Vercel Postgres integration env names.
  const rawUrl = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  );

  return rawUrl ? normalizeDatabaseUrl(rawUrl) : undefined;
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
