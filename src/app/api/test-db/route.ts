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
    return NextResponse.json({
      success: false,
      error: 'Database connection failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}