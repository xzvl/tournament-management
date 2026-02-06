import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

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

const resolveUniqueUsername = async (base: string) => {
  let candidate = base;
  let suffix = 1;

  while (suffix < 100) {
    const existing = await prisma.player.findFirst({
      where: { username: candidate },
      select: { player_id: true }
    });
    if (!existing) {
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

    try {
      await prisma.$transaction(async (tx) => {
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

        const existing = await tx.player.findFirst({
          where: { player_name: playerName },
          select: { player_id: true }
        });

        let playerId: number;

        if (existing) {
          playerId = existing.player_id;
        } else {
          const baseUsername = normalizeUsername(playerName);
          const username = await resolveUniqueUsername(baseUsername);
          const password = generatePassword(10);
          const name = normalizeName(playerName);

          const inserted = await tx.player.create({
            data: {
              username,
              password,
              name,
              player_name: playerName
            },
            select: { player_id: true }
          });
          playerId = inserted.player_id;
        }

        const normalizedStatus = matchStatus || 'completed';
        const normalizedSide = stadiumSide === 'B Side' ? 'B Side' : 'X Side';

        await tx.playerStat.create({
          data: {
            challonge_id: challongeId,
            player_id: playerId,
            match_id: String(matchId),
            spin: Number(spin) || 0,
            burst: Number(burst) || 0,
            over: Number(over) || 0,
            extreme: Number(extreme) || 0,
            penalty: Number(penalty) || 0,
            match_result: matchResult,
            stadium_side: normalizedSide,
            match_status: normalizedStatus,
            match_stage: matchStage
          }
        });
      }
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Player stats save error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save player stats' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Player stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
