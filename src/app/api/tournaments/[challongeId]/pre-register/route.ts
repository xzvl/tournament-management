import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

const parseCommunityIds = (value: unknown) => {
  if (!value) return [] as number[];
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'number' && !Number.isNaN(item));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'number' && !Number.isNaN(item));
      }
    } catch {
      return [] as number[];
    }
  }
  return [] as number[];
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ challongeId: string }> }
) {
  try {
    const { challongeId } = await context.params;

    const tournament = await prisma.challongeTournament.findUnique({
      where: { challonge_id: challongeId },
      select: { ch_id: true, pre_registered_players: true }
    });

    if (!tournament) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      players: parsePlayers(tournament.pre_registered_players)
    });
  } catch (error) {
    console.error('Get pre-register list error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ challongeId: string }> }
) {
  try {
    const { challongeId } = await context.params;
    const body = await request.json();
    const playerName = typeof body?.playerName === 'string' ? normalizePlayerName(body.playerName) : '';
    const parsedCommunityId = Number(body?.communityId);
    const communityId = Number.isFinite(parsedCommunityId) ? parsedCommunityId : null;

    if (!playerName) {
      return NextResponse.json({ success: false, error: 'Player name is required' }, { status: 400 });
    }

    const tournament = await prisma.challongeTournament.findUnique({
      where: { challonge_id: challongeId },
      select: { ch_id: true, pre_registered_players: true }
    });

    if (!tournament) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }
    const players = parsePlayers(tournament.pre_registered_players);
    const alreadyJoined = players.some((player) => player.toLowerCase() === playerName.toLowerCase());

    if (alreadyJoined) {
      if (communityId && communityId > 0) {
        const playerRow = await prisma.player.findFirst({
          where: { player_name: playerName },
          select: { player_id: true, community_ids: true }
        });

        if (playerRow) {
          const currentIds = parseCommunityIds(playerRow.community_ids);
          const nextIds = currentIds.includes(communityId) ? currentIds : [...currentIds, communityId];

          await prisma.player.update({
            where: { player_id: playerRow.player_id },
            data: { community_ids: nextIds }
          });
        }
      }

      return NextResponse.json({
        success: true,
        alreadyJoined: true,
        message: 'Player is already Join'
      });
    }

    const nextPlayers = [...players, playerName];
    await prisma.challongeTournament.update({
      where: { ch_id: tournament.ch_id },
      data: { pre_registered_players: nextPlayers }
    });

    if (communityId && communityId > 0) {
      const playerRow = await prisma.player.findFirst({
        where: { player_name: playerName },
        select: { player_id: true, community_ids: true }
      });

      if (playerRow) {
        const currentIds = parseCommunityIds(playerRow.community_ids);
        const nextIds = currentIds.includes(communityId) ? currentIds : [...currentIds, communityId];

        await prisma.player.update({
          where: { player_id: playerRow.player_id },
          data: { community_ids: nextIds }
        });
      }
    }

    return NextResponse.json({
      success: true,
      alreadyJoined: false,
      message: 'Successfully Join the tournament'
    });
  } catch (error) {
    console.error('Pre-register error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ challongeId: string }> }
) {
  try {
    const { challongeId } = await context.params;
    const body = await request.json();
    const playerName = typeof body?.playerName === 'string' ? normalizePlayerName(body.playerName) : '';

    if (!playerName) {
      return NextResponse.json({ success: false, error: 'Player name is required' }, { status: 400 });
    }

    const tournament = await prisma.challongeTournament.findUnique({
      where: { challonge_id: challongeId },
      select: { ch_id: true, pre_registered_players: true }
    });

    if (!tournament) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }
    const players = parsePlayers(tournament.pre_registered_players);
    const nextPlayers = players.filter((player) => player.toLowerCase() !== playerName.toLowerCase());

    if (nextPlayers.length !== players.length) {
      await prisma.challongeTournament.update({
        where: { ch_id: tournament.ch_id },
        data: { pre_registered_players: nextPlayers }
      });
    }

    return NextResponse.json({ success: true, players: nextPlayers });
  } catch (error) {
    console.error('Remove pre-register error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
