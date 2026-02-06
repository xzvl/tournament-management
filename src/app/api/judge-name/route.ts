import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const judgeId = searchParams.get('judgeId');

    if (!judgeId) {
      return NextResponse.json(
        { success: false, error: 'Judge ID is required' },
        { status: 400 }
      );
    }

    // Get judge name from database
    const judges = await executeQuery(
      'SELECT judge_id, judge_name FROM judges WHERE judge_id = ?',
      [judgeId]
    ) as Array<{ judge_id: number; judge_name: string }>;

    if (judges.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Judge not found' },
        { status: 404 }
      );
    }

    const judge = judges[0];

    return NextResponse.json({
      success: true,
      name: judge.judge_name
    });
  } catch (error) {
    console.error('Error fetching judge name:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
