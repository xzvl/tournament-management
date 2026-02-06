import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

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

    const tournaments = await executeQuery(
      'SELECT ch_id, pre_registered_players FROM challonge_tournaments WHERE challonge_id = ? LIMIT 1',
      [challongeId]
    ) as Array<{ ch_id: number; pre_registered_players: string | null }>;

    if (tournaments.length === 0) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      players: parsePlayers(tournaments[0].pre_registered_players)
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

    const tournaments = await executeQuery(
      'SELECT ch_id, pre_registered_players FROM challonge_tournaments WHERE challonge_id = ? LIMIT 1',
      [challongeId]
    ) as Array<{ ch_id: number; pre_registered_players: string | null }>;

    if (tournaments.length === 0) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }

    const tournament = tournaments[0];
    const players = parsePlayers(tournament.pre_registered_players);
    const alreadyJoined = players.some((player) => player.toLowerCase() === playerName.toLowerCase());

    if (alreadyJoined) {
      if (communityId && communityId > 0) {
        const playerRows = await executeQuery(
          'SELECT player_id, community_ids FROM players WHERE player_name = ? LIMIT 1',
          [playerName]
        ) as Array<{ player_id: number; community_ids: string | null }>;

        if (playerRows.length > 0) {
          const currentIds = parseCommunityIds(playerRows[0].community_ids);
          const nextIds = currentIds.includes(communityId) ? currentIds : [...currentIds, communityId];

          await executeQuery(
            'UPDATE players SET community_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE player_id = ?',
            [JSON.stringify(nextIds), playerRows[0].player_id]
          );
        }
      }

      return NextResponse.json({
        success: true,
        alreadyJoined: true,
        message: 'Player is already Join'
      });
    }

    const nextPlayers = [...players, playerName];
    await executeQuery(
      'UPDATE challonge_tournaments SET pre_registered_players = ?, updated_at = CURRENT_TIMESTAMP WHERE ch_id = ?',
      [JSON.stringify(nextPlayers), tournament.ch_id]
    );

    if (communityId && communityId > 0) {
      const playerRows = await executeQuery(
        'SELECT player_id, community_ids FROM players WHERE player_name = ? LIMIT 1',
        [playerName]
      ) as Array<{ player_id: number; community_ids: string | null }>;

      if (playerRows.length > 0) {
        const currentIds = parseCommunityIds(playerRows[0].community_ids);
        const nextIds = currentIds.includes(communityId) ? currentIds : [...currentIds, communityId];

        await executeQuery(
          'UPDATE players SET community_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE player_id = ?',
          [JSON.stringify(nextIds), playerRows[0].player_id]
        );
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

    const tournaments = await executeQuery(
      'SELECT ch_id, pre_registered_players FROM challonge_tournaments WHERE challonge_id = ? LIMIT 1',
      [challongeId]
    ) as Array<{ ch_id: number; pre_registered_players: string | null }>;

    if (tournaments.length === 0) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }

    const tournament = tournaments[0];
    const players = parsePlayers(tournament.pre_registered_players);
    const nextPlayers = players.filter((player) => player.toLowerCase() !== playerName.toLowerCase());

    if (nextPlayers.length !== players.length) {
      await executeQuery(
        'UPDATE challonge_tournaments SET pre_registered_players = ?, updated_at = CURRENT_TIMESTAMP WHERE ch_id = ?',
        [JSON.stringify(nextPlayers), tournament.ch_id]
      );
    }

    return NextResponse.json({ success: true, players: nextPlayers });
  } catch (error) {
    console.error('Remove pre-register error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
