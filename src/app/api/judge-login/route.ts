import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { executeQuery } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, challongeId, token } = body;

    if (!challongeId) {
      return NextResponse.json(
        { success: false, message: 'Tournament ID is required' },
        { status: 400 }
      );
    }

    if (token) {
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';

      try {
        const decoded = jwt.verify(token, jwtSecret) as {
          type?: string;
          judge_id?: number;
          username?: string;
          challongeId?: string;
        };

        if (decoded?.type !== 'judge-login' || !decoded.judge_id || !decoded.username) {
          return NextResponse.json(
            { success: false, message: 'Invalid token' },
            { status: 401 }
          );
        }

        const judges = await executeQuery(
          'SELECT judge_id FROM judges WHERE judge_id = ? AND username = ?',
          [decoded.judge_id, decoded.username]
        ) as Array<{ judge_id: number }>;

        if (judges.length === 0) {
          return NextResponse.json(
            { success: false, message: 'Judge not found' },
            { status: 401 }
          );
        }

        // Check if judge is assigned to this tournament
        const tournaments = await executeQuery(
          'SELECT assigned_judge_ids FROM challonge_tournaments WHERE challonge_id = ?',
          [challongeId]
        ) as Array<{ assigned_judge_ids: string | null }>;

        if (tournaments.length === 0) {
          return NextResponse.json(
            { success: false, message: 'Tournament not found' },
            { status: 404 }
          );
        }

        const assignedJudgeIds = tournaments[0].assigned_judge_ids;
        if (assignedJudgeIds) {
          try {
            const judgeAssignments = JSON.parse(assignedJudgeIds) as Record<string, number[]>;
            const isAssigned = decoded.judge_id.toString() in judgeAssignments;

            if (!isAssigned) {
              return NextResponse.json(
                { success: false, message: 'You are not assigned to this tournament' },
                { status: 403 }
              );
            }
          } catch (parseError) {
            console.error('Error parsing assigned_judge_ids:', parseError);
            return NextResponse.json(
              { success: false, message: 'Tournament configuration error' },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json(
            { success: false, message: 'No judges assigned to this tournament' },
            { status: 403 }
          );
        }

        return NextResponse.json({ success: true, judgeId: decoded.judge_id });
      } catch (error) {
        return NextResponse.json(
          { success: false, message: 'Invalid or expired token' },
          { status: 401 }
        );
      }
    }

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Validate username and password from database
    const judges = await executeQuery(
      'SELECT judge_id, username FROM judges WHERE username = ? AND password = ?',
      [username, password]
    ) as Array<{ judge_id: number; username: string }>;

    if (judges.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const judgeId = judges[0].judge_id;

    // Check if judge is assigned to this tournament
    const tournaments = await executeQuery(
      'SELECT assigned_judge_ids FROM challonge_tournaments WHERE challonge_id = ?',
      [challongeId]
    ) as Array<{ assigned_judge_ids: string | null }>;

    if (tournaments.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tournament not found' },
        { status: 404 }
      );
    }

    const assignedJudgeIds = tournaments[0].assigned_judge_ids;
    if (assignedJudgeIds) {
      try {
        const judgeAssignments = JSON.parse(assignedJudgeIds) as Record<string, number[]>;
        const isAssigned = judgeId.toString() in judgeAssignments;

        if (!isAssigned) {
          return NextResponse.json(
            { success: false, message: 'You are not assigned to this tournament' },
            { status: 403 }
          );
        }
      } catch (parseError) {
        console.error('Error parsing assigned_judge_ids:', parseError);
        return NextResponse.json(
          { success: false, message: 'Tournament configuration error' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, message: 'No judges assigned to this tournament' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, judgeId: judgeId });
  } catch (error) {
    console.error('Judge login error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}