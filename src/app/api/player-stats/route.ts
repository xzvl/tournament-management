import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getConnection } from '@/lib/database';

const SPECIAL_CHARS = '!@#$%^&*';
const USERNAME_FALLBACK = 'player';
const NAME_FALLBACK = 'Player';

const normalizeUsername = (value: string) => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || USERNAME_FALLBACK;
};

const normalizeName = (value: string) => {
  const cleaned = value
    .replace(/[^a-z0-9 ]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || NAME_FALLBACK;
};

const pickRandomChar = (chars: string) => {
  const index = crypto.randomInt(0, chars.length);
  return chars[index];
};

const generatePassword = (length = 10) => {
  const baseChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const allChars = baseChars + SPECIAL_CHARS;
  const output: string[] = [];

  output.push(pickRandomChar(SPECIAL_CHARS));
  for (let i = 1; i < length; i += 1) {
    output.push(pickRandomChar(allChars));
  }

  for (let i = output.length - 1; i > 0; i -= 1) {
    const swapIndex = crypto.randomInt(0, i + 1);
    [output[i], output[swapIndex]] = [output[swapIndex], output[i]];
  }

  return output.join('');
};

const resolveUniqueUsername = async (base: string, connection: any) => {
  let candidate = base;
  let suffix = 1;

  while (suffix < 100) {
    const [rows] = await connection.execute(
      'SELECT player_id FROM players WHERE username = ? LIMIT 1',
      [candidate]
    );
    const existing = rows as Array<{ player_id: number }>;
    if (existing.length === 0) {
      return candidate;
    }
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }

  return `${base}_${Date.now()}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { challongeId, matchId, matchStage, matchStatus, players } = body;

    if (!challongeId || !matchId || !Array.isArray(players) || players.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload' },
        { status: 400 }
      );
    }

    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      for (const player of players) {
        const {
          playerName,
          spin,
          burst,
          over,
          extreme,
          penalty,
          matchResult,
          stadiumSide
        } = player || {};

        if (!playerName) {
          throw new Error('Player name is required');
        }

        const [existingPlayers] = await connection.execute(
          'SELECT player_id FROM players WHERE player_name = ? LIMIT 1',
          [playerName]
        );
        const existing = existingPlayers as Array<{ player_id: number }>;

        let playerId: number;

        if (existing.length > 0) {
          playerId = existing[0].player_id;
        } else {
          const baseUsername = normalizeUsername(playerName);
          const username = await resolveUniqueUsername(baseUsername, connection);
          const password = generatePassword(10);
          const name = normalizeName(playerName);

          const [insertResult] = await connection.execute(
            'INSERT INTO players (username, password, name, player_name, community_ids) VALUES (?, ?, ?, ?, ?)',
            [username, password, name, playerName, null]
          );

          const insertData = insertResult as { insertId: number };
          playerId = insertData.insertId;
        }

        const normalizedStatus = matchStatus || 'completed';
        const normalizedSide = stadiumSide === 'B Side' ? 'B Side' : 'X Side';

        await connection.execute(
          `INSERT INTO player_stats
            (challonge_id, player_id, match_id, spin, burst, \`over\`, extreme, penalty, match_result, stadium_side, match_status, match_stage)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ,
          [
            challongeId,
            playerId,
            String(matchId),
            Number(spin) || 0,
            Number(burst) || 0,
            Number(over) || 0,
            Number(extreme) || 0,
            Number(penalty) || 0,
            matchResult,
            normalizedSide,
            normalizedStatus,
            matchStage
          ]
        );
      }

      await connection.commit();

      return NextResponse.json({ success: true });
    } catch (error) {
      await connection.rollback();
      console.error('Player stats save error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save player stats' },
        { status: 500 }
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Player stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
