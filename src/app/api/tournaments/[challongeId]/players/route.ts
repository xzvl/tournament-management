import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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

    const tournament = await prisma.challongeTournament.findUnique({
      where: { challonge_id: challongeId },
      select: { ch_id: true, to_id: true, pre_registered_players: true }
    });

    if (!tournament) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }
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

    const tournament = await prisma.challongeTournament.findUnique({
      where: { challonge_id: challongeId },
      select: { ch_id: true, to_id: true, pre_registered_players: true }
    });

    if (!tournament) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }
    const user = authCheck.user;
    if (user.role !== 'admin' && tournament.to_id !== user.user_id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const players = parsePlayers(tournament.pre_registered_players);
    const hasExisting = players.some((player) => player.toLowerCase() === playerName.toLowerCase());
    const nextPlayers = hasExisting ? players : [...players, playerName];

    await prisma.challongeTournament.update({
      where: { ch_id: tournament.ch_id },
      data: { pre_registered_players: nextPlayers }
    });

    return NextResponse.json({ success: true, players: nextPlayers });
  } catch (error) {
    console.error('Add pre-registered player error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
