import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

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
    const tournaments = await executeQuery(
      'SELECT assigned_judge_ids FROM challonge_tournaments WHERE challonge_id = ?',
      [challongeId]
    ) as Array<{ assigned_judge_ids: string | null }>;

    if (tournaments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    let stadiumNumber: number | null = null;
    const assignedJudgeIds = tournaments[0].assigned_judge_ids;

    if (assignedJudgeIds) {
      try {
        const judgeAssignments = JSON.parse(assignedJudgeIds) as Record<string, number>;
        stadiumNumber = judgeAssignments[judgeId.toString()] || null;
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
