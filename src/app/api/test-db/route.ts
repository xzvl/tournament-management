import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Test basic connection
    const testResult = await prisma.$queryRaw(Prisma.sql`SELECT 1`);
    console.log('Database test result:', testResult);

    const usersResult = await prisma.user.findMany({
      select: { username: true, user_role: true },
      take: 3
    });
    console.log('Users query result:', usersResult);

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      testQuery: testResult,
      users: usersResult
    });

  } catch (error) {
    console.error('Database test error:', error);
    const hasDbEnv = Boolean(
      process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING
    );

    return NextResponse.json({
      success: false,
      error: 'Database connection failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
      hasDatabaseEnv: hasDbEnv,
      expectedEnv: ['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL']
    }, { status: 500 });
  }
}