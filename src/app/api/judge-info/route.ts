import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const judgeId = searchParams.get('judgeId');
    const challongeId = searchParams.get('challongeId');

    if (!judgeId || !challongeId) {
      return NextResponse.json(
        { success: false, error: 'Judge ID and Challonge ID are required' },
        { status: 400 }
      );
    }

    // Get judge information
    const judge = await prisma.judge.findUnique({
      where: { judge_id: Number(judgeId) },
      select: { judge_id: true, name: true, username: true }
    });

    if (!judge) {
      return NextResponse.json(
        { success: false, error: 'Judge not found' },
        { status: 404 }
      );
    }

    // Get stadium number from tournament assignments
    const tournament = await prisma.challongeTournament.findUnique({
      where: { challonge_id: challongeId },
      select: { assigned_judge_ids: true }
    });

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    let stadiumNumber: number | null = null;
    const assignedJudgeIds = tournament.assigned_judge_ids as unknown;

    if (assignedJudgeIds) {
      const assignments = typeof assignedJudgeIds === 'string'
        ? JSON.parse(assignedJudgeIds)
        : assignedJudgeIds;

      if (assignments && typeof assignments === 'object') {
        const judgeAssignments = assignments as Record<string, number[]>;
        const stadiums = judgeAssignments[judgeId.toString()];
        if (stadiums && stadiums.length > 0) {
          stadiumNumber = stadiums[0];
        }
      }
    }

    return NextResponse.json({
      success: true,
      judge: {
        id: judge.judge_id,
        name: judge.name,
        username: judge.username,
        stadiumNumber
      }
    });
  } catch (error) {
    console.error('Error fetching judge info:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
