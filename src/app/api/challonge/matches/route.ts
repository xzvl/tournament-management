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

function getRelationshipId(matchItem: any, key: 'player1' | 'player2'): number | string | null {
  const relationshipId = matchItem?.relationships?.[key]?.data?.id;
  if (relationshipId !== undefined && relationshipId !== null) {
    return toNumericId(relationshipId);
  }

  // Some v2.1 match records omit player relationships and only include
  // participant ids under points_by_participant.
  const points = Array.isArray(matchItem?.attributes?.points_by_participant)
    ? matchItem.attributes.points_by_participant
    : [];
  const index = key === 'player1' ? 0 : 1;
  return toNumericId(points[index]?.participant_id);
}

function getMatchGroupId(matchItem: any): number | string | null {
  const relationshipGroupId = matchItem?.relationships?.group?.data?.id;
  if (relationshipGroupId !== undefined && relationshipGroupId !== null) {
    return toNumericId(relationshipGroupId);
  }

  return toNumericId(matchItem?.attributes?.group_id);
}

function normalizeIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

async function fetchParticipantDetail(
  challongeId: string,
  participantId: number | string,
  apiKey: string
) {
  const response = await fetch(
    `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/participants/${encodeURIComponent(String(participantId))}.json`,
    {
      method: 'GET',
      headers: getChallongeV21Headers(apiKey)
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const item = payload?.data;
  const attributes = item?.attributes ?? {};
  const normalizedId = toNumericId(item?.id ?? participantId);

  return {
    participant: {
      id: normalizedId,
      name: attributes?.name ?? 'Unknown Player',
      display_name: attributes?.name ?? 'Unknown Player',
      username: attributes?.username ?? null,
      group_id: toNumericId(attributes?.group_id),
      final_rank: attributes?.final_rank ?? null,
      group_player_ids: normalizeIdArray(attributes?.group_player_ids)
    }
  };
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

    // Also fetch participants and normalize to maintain existing UI contracts.
    const participantsResponse = await fetch(
      `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/participants.json`,
      {
        method: 'GET',
        headers: getChallongeV21Headers(apiKey)
      }
    );

    let participants = [];
    const participantGroupById = new Map<number | string, number | string | null>();
    if (participantsResponse.ok) {
      const participantsPayload = await participantsResponse.json();
      const participantsData = Array.isArray(participantsPayload?.data)
        ? participantsPayload.data
        : [];

      participants = participantsData.map((item: any) => {
        const attributes = item?.attributes ?? {};
        const participantId = toNumericId(item?.id);
        const participantGroupId = toNumericId(attributes?.group_id);
        const groupPlayerIds = normalizeIdArray(attributes?.group_player_ids);

        if (participantId !== null) {
          participantGroupById.set(participantId, participantGroupId);
        }

        return {
          participant: {
            id: participantId,
            name: attributes?.name ?? 'Unknown Player',
            display_name: attributes?.name ?? 'Unknown Player',
            username: attributes?.username ?? null,
            group_id: participantGroupId,
            final_rank: attributes?.final_rank ?? null,
            group_player_ids: groupPlayerIds
          }
        };
      });
    }

    const matchParticipantIds = new Set<number | string>();
    matchesData.forEach((item: any) => {
      const player1Id = getRelationshipId(item, 'player1');
      const player2Id = getRelationshipId(item, 'player2');
      if (player1Id !== null) matchParticipantIds.add(player1Id);
      if (player2Id !== null) matchParticipantIds.add(player2Id);
    });

    const missingParticipantIds = Array.from(matchParticipantIds).filter(
      (id) => !participantGroupById.has(id)
    );

    if (missingParticipantIds.length > 0) {
      const fetchedParticipants = await Promise.all(
        missingParticipantIds.map((id) => fetchParticipantDetail(challongeId, id, apiKey))
      );

      fetchedParticipants.forEach((participantEntry) => {
        if (!participantEntry) return;
        participants.push(participantEntry);

        const p = participantEntry.participant;
        if (p.id !== null) {
          participantGroupById.set(p.id, p.group_id ?? null);
        }
      });
    }

    // Normalize v2.1 JSON:API response to the existing v1-like shape used by UI code.
    const matches = matchesData.map((item: any) => {
      const attributes = item?.attributes ?? {};
      const hasExplicitPlayerRelationships = Boolean(
        item?.relationships?.player1?.data?.id && item?.relationships?.player2?.data?.id
      );
      const player1Id = getRelationshipId(item, 'player1');
      const player2Id = getRelationshipId(item, 'player2');

      // Some v2.1 responses do not include explicit group links for matches.
      // When omitted, infer group_id if both players are in the same participant group.
      let groupId = getMatchGroupId(item);
      if (groupId === null && hasExplicitPlayerRelationships && player1Id !== null && player2Id !== null) {
        const player1Group = participantGroupById.get(player1Id) ?? null;
        const player2Group = participantGroupById.get(player2Id) ?? null;
        if (player1Group !== null && player1Group === player2Group) {
          groupId = player1Group;
        }
      }

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
          group_id: groupId,
          identifier: attributes?.identifier ?? null
        }
      };
    });

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
    const showMatchData = showMatchPayload?.data ?? {};
    const matchAttributes = showMatchData?.attributes ?? {};
    const player1Id = getRelationshipId(showMatchData, 'player1');
    const player2Id = getRelationshipId(showMatchData, 'player2');

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
    const updatedData = updatedPayload?.data ?? {};
    const updatedAttributes = updatedData?.attributes ?? {};
    const updatedPlayer1Id = getRelationshipId(updatedData, 'player1') ?? player1Id;
    const updatedPlayer2Id = getRelationshipId(updatedData, 'player2') ?? player2Id;
    const updatedGroupId = getMatchGroupId(updatedData);

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
        group_id: updatedGroupId,
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
