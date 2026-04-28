import { NextRequest, NextResponse } from 'next/server';

const CHALLONGE_V21_BASE_URL = 'https://api.challonge.com/v2.1';

function getChallongeV21Headers(apiKey: string): HeadersInit {
  return {
    'Authorization-Type': 'v1',
    'Authorization': apiKey,
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/json'
  };
}

function toNumericId(value: unknown): number | string | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : String(value);
}

function getRelationshipId(matchAttributes: any, key: 'player1' | 'player2'): number | string | null {
  const relationshipId = matchAttributes?.relationships?.[key]?.data?.id;
  return toNumericId(relationshipId);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const challongeId = url.searchParams.get('challongeId');
    const apiKey = url.searchParams.get('apiKey');

    if (!challongeId || !apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing challongeId or apiKey'
      }, { status: 400 });
    }

    // Fetch matches from Challonge API v2.1
    const matchesResponse = await fetch(
      `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/matches.json`,
      {
        method: 'GET',
        headers: getChallongeV21Headers(apiKey)
      }
    );

    if (!matchesResponse.ok) {
      const errorText = await matchesResponse.text();
      console.error('Challonge API error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch matches from Challonge'
      }, { status: matchesResponse.status });
    }

    const matchesPayload = await matchesResponse.json();
    const matchesData = Array.isArray(matchesPayload?.data) ? matchesPayload.data : [];

    // Normalize v2.1 JSON:API response to the existing v1-like shape used by UI code.
    const matches = matchesData.map((item: any) => {
      const attributes = item?.attributes ?? {};
      const player1Id = getRelationshipId(attributes, 'player1');
      const player2Id = getRelationshipId(attributes, 'player2');

      return {
        match: {
          id: toNumericId(item?.id),
          player1_id: player1Id,
          player2_id: player2Id,
          winner_id: toNumericId(attributes?.winner_id),
          loser_id: null,
          scores_csv: typeof attributes?.scores === 'string'
            ? attributes.scores.replace(/\s+/g, '')
            : '',
          state: attributes?.state ?? 'pending',
          round: attributes?.round ?? null,
          group_id: null,
          identifier: attributes?.identifier ?? null
        }
      };
    });

    // Also fetch participants and normalize to maintain existing UI contracts.
    const participantsResponse = await fetch(
      `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/participants.json`,
      {
        method: 'GET',
        headers: getChallongeV21Headers(apiKey)
      }
    );

    let participants = [];
    if (participantsResponse.ok) {
      const participantsPayload = await participantsResponse.json();
      const participantsData = Array.isArray(participantsPayload?.data)
        ? participantsPayload.data
        : [];

      participants = participantsData.map((item: any) => {
        const attributes = item?.attributes ?? {};
        return {
          participant: {
            id: toNumericId(item?.id),
            name: attributes?.name ?? 'Unknown Player',
            display_name: attributes?.name ?? 'Unknown Player',
            username: attributes?.username ?? null,
            group_id: attributes?.group_id ?? null,
            final_rank: attributes?.final_rank ?? null,
            group_player_ids: []
          }
        };
      });
    }

    return NextResponse.json({
      success: true,
      matches,
      participants
    });

  } catch (error) {
    console.error('Matches API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { challongeId, apiKey, matchId, winnerId, scoresCsv } = body || {};

    if (!challongeId || !apiKey || !matchId) {
      return NextResponse.json({
        success: false,
        error: 'Missing challongeId, apiKey, or matchId'
      }, { status: 400 });
    }

    const showMatchResponse = await fetch(
      `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/matches/${encodeURIComponent(String(matchId))}.json`,
      {
        method: 'GET',
        headers: getChallongeV21Headers(apiKey)
      }
    );

    if (!showMatchResponse.ok) {
      const errorText = await showMatchResponse.text();
      console.error('Challonge get match error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch match details from Challonge'
      }, { status: showMatchResponse.status });
    }

    const showMatchPayload = await showMatchResponse.json();
    const matchAttributes = showMatchPayload?.data?.attributes ?? {};
    const player1Id = getRelationshipId(matchAttributes, 'player1');
    const player2Id = getRelationshipId(matchAttributes, 'player2');

    if (!player1Id || !player2Id) {
      return NextResponse.json({
        success: false,
        error: 'Unable to determine match participants'
      }, { status: 422 });
    }

    const [rawScore1 = '', rawScore2 = ''] = String(scoresCsv ?? '').split('-');
    const score1 = rawScore1.trim();
    const score2 = rawScore2.trim();

    if (!score1 || !score2) {
      return NextResponse.json({
        success: false,
        error: 'scoresCsv must be provided in "score1-score2" format'
      }, { status: 400 });
    }

    const winnerIdString = winnerId !== undefined && winnerId !== null ? String(winnerId) : '';

    const updatePayload = {
      data: {
        type: 'Match',
        attributes: {
          match: [
            {
              participant_id: String(player1Id),
              score_set: score1,
              advancing: winnerIdString === String(player1Id)
            },
            {
              participant_id: String(player2Id),
              score_set: score2,
              advancing: winnerIdString === String(player2Id)
            }
          ]
        }
      }
    };

    const updateResponse = await fetch(
      `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/matches/${encodeURIComponent(String(matchId))}.json`,
      {
        method: 'PUT',
        headers: getChallongeV21Headers(apiKey),
        body: JSON.stringify(updatePayload)
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Challonge update match error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to update match in Challonge'
      }, { status: updateResponse.status });
    }

    const updatedPayload = await updateResponse.json();
    const updatedAttributes = updatedPayload?.data?.attributes ?? {};
    const updatedPlayer1Id = getRelationshipId(updatedAttributes, 'player1') ?? player1Id;
    const updatedPlayer2Id = getRelationshipId(updatedAttributes, 'player2') ?? player2Id;

    const match = {
      match: {
        id: toNumericId(updatedPayload?.data?.id ?? matchId),
        player1_id: updatedPlayer1Id,
        player2_id: updatedPlayer2Id,
        winner_id: toNumericId(updatedAttributes?.winner_id) ?? toNumericId(winnerId),
        loser_id: null,
        scores_csv: typeof updatedAttributes?.scores === 'string'
          ? updatedAttributes.scores.replace(/\s+/g, '')
          : String(scoresCsv ?? ''),
        state: updatedAttributes?.state ?? 'complete',
        round: updatedAttributes?.round ?? null,
        group_id: null,
        identifier: updatedAttributes?.identifier ?? null
      }
    };

    return NextResponse.json({
      success: true,
      match
    });
  } catch (error) {
    console.error('Matches update API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
