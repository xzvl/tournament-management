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

    // Fetch from Challonge API
    const challongeResponse = await fetch(
      `https://api.challonge.com/v1/tournaments/${challongeId}/participants.json?api_key=${apiKey}`
    );

    if (!challongeResponse.ok) {
      const errorText = await challongeResponse.text();
      console.error('Challonge API error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch participants from Challonge'
      }, { status: challongeResponse.status });
    }

    const participants = await challongeResponse.json();

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
