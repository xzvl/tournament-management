import { NextRequest, NextResponse } from 'next/server';

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

    // Fetch matches from Challonge API
    const matchesResponse = await fetch(
      `https://api.challonge.com/v1/tournaments/${challongeId}/matches.json?api_key=${apiKey}`
    );

    if (!matchesResponse.ok) {
      const errorText = await matchesResponse.text();
      console.error('Challonge API error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch matches from Challonge'
      }, { status: matchesResponse.status });
    }

    const matches = await matchesResponse.json();

    // Also fetch participants to get group_player_ids mapping
    const participantsResponse = await fetch(
      `https://api.challonge.com/v1/tournaments/${challongeId}/participants.json?api_key=${apiKey}`
    );

    let participants = [];
    if (participantsResponse.ok) {
      participants = await participantsResponse.json();
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

    const params = new URLSearchParams();
    if (scoresCsv) {
      params.set('match[scores_csv]', String(scoresCsv));
    }
    if (winnerId) {
      params.set('match[winner_id]', String(winnerId));
    }

    const updateResponse = await fetch(
      `https://api.challonge.com/v1/tournaments/${challongeId}/matches/${matchId}.json?api_key=${apiKey}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
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

    const match = await updateResponse.json();

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
