import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Test basic connection
    const testResult = await executeQuery('SELECT 1 as test') as any[];
    console.log('Database test result:', testResult);

    // Test users table
    const usersResult = await executeQuery('SELECT username, user_role FROM users LIMIT 3') as any[];
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