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
      try {
        const assignments = typeof assignedJudgeIds === 'string'
          ? JSON.parse(assignedJudgeIds)
          : assignedJudgeIds;
        const judgeAssignments = assignments as Record<string, number>;
        stadiumNumber = judgeAssignments?.[judgeId.toString()] || null;
      } catch (parseError) {
        console.error('Error parsing assigned_judge_ids:', parseError);
        return NextResponse.json(
          { success: false, error: 'Invalid tournament configuration' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      stadiumNumber
    });
  } catch (error) {
    console.error('Error fetching judge stadium:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
