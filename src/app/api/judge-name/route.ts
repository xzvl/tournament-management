import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
    const judge = await prisma.judge.findUnique({
      where: { judge_id: Number(judgeId) },
      select: { judge_id: true, judge_name: true }
    });

    if (!judge) {
      return NextResponse.json(
        { success: false, error: 'Judge not found' },
        { status: 404 }
      );
    }

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
