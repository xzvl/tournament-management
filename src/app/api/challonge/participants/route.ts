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

    // Fetch from Challonge API v2.1
    const challongeResponse = await fetch(
      `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/participants.json`,
      {
        method: 'GET',
        headers: getChallongeV21Headers(apiKey)
      }
    );

    if (!challongeResponse.ok) {
      const errorText = await challongeResponse.text();
      console.error('Challonge API error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch participants from Challonge'
      }, { status: challongeResponse.status });
    }

    const responseData = await challongeResponse.json();
    const participantsData = Array.isArray(responseData?.data) ? responseData.data : [];

    // Normalize v2.1 JSON:API response to the existing v1-like shape used by UI code.
    const participants = participantsData.map((item: any) => {
      const attributes = item?.attributes ?? {};
      const participantId = Number(item?.id);
      const normalizedId = Number.isFinite(participantId) ? participantId : item?.id;

      return {
        participant: {
          id: normalizedId,
          name: attributes?.name ?? 'Unknown Player',
          display_name: attributes?.name ?? 'Unknown Player',
          username: attributes?.username ?? null,
          group_id: attributes?.group_id ?? null,
          final_rank: attributes?.final_rank ?? null,
          group_player_ids: []
        }
      };
    });

    return NextResponse.json({
      success: true,
      participants
    });

  } catch (error) {
    console.error('Participants API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
