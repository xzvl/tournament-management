import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import { verifyAuth } from '@/lib/auth';

const parsePlayers = (value: unknown) => {
  if (!value) return [] as string[];
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string');
      }
    } catch {
      return [] as string[];
    }
  }
  return [] as string[];
};

const normalizePlayerName = (value: string) => {
  return value.replace(/\s+/g, ' ').trim();
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ challongeId: string }> }
) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { challongeId } = await context.params;

    const tournaments = await executeQuery(
      'SELECT ch_id, to_id, pre_registered_players FROM challonge_tournaments WHERE challonge_id = ? LIMIT 1',
      [challongeId]
    ) as Array<{ ch_id: number; to_id: number | null; pre_registered_players: string | null }>;

    if (tournaments.length === 0) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }

    const tournament = tournaments[0];
    const user = authCheck.user;
    if (user.role !== 'admin' && tournament.to_id !== user.user_id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      players: parsePlayers(tournament.pre_registered_players)
    });
  } catch (error) {
    console.error('Get pre-registered players error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ challongeId: string }> }
) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { challongeId } = await context.params;
    const body = await request.json();
    const playerName = typeof body?.playerName === 'string' ? normalizePlayerName(body.playerName) : '';

    if (!playerName) {
      return NextResponse.json({ success: false, error: 'Player name is required' }, { status: 400 });
    }

    const tournaments = await executeQuery(
      'SELECT ch_id, to_id, pre_registered_players FROM challonge_tournaments WHERE challonge_id = ? LIMIT 1',
      [challongeId]
    ) as Array<{ ch_id: number; to_id: number | null; pre_registered_players: string | null }>;

    if (tournaments.length === 0) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }

    const tournament = tournaments[0];
    const user = authCheck.user;
    if (user.role !== 'admin' && tournament.to_id !== user.user_id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const players = parsePlayers(tournament.pre_registered_players);
    const hasExisting = players.some((player) => player.toLowerCase() === playerName.toLowerCase());
    const nextPlayers = hasExisting ? players : [...players, playerName];

    await executeQuery(
      'UPDATE challonge_tournaments SET pre_registered_players = ?, updated_at = CURRENT_TIMESTAMP WHERE ch_id = ?',
      [JSON.stringify(nextPlayers), tournament.ch_id]
    );

    return NextResponse.json({ success: true, players: nextPlayers });
  } catch (error) {
    console.error('Add pre-registered player error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
