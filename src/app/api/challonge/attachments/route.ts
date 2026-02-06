import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const challongeId = url.searchParams.get('challongeId');
    const matchId = url.searchParams.get('matchId');
    const apiKey = url.searchParams.get('apiKey');

    if (!challongeId || !matchId || !apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing challongeId, matchId, or apiKey'
      }, { status: 400 });
    }

    const attachmentsResponse = await fetch(
      `https://api.challonge.com/v1/tournaments/${challongeId}/matches/${matchId}/attachments.json?api_key=${apiKey}`
    );

    if (!attachmentsResponse.ok) {
      const errorText = await attachmentsResponse.text();
      console.error('Challonge API error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch attachments from Challonge'
      }, { status: attachmentsResponse.status });
    }

    const attachments = await attachmentsResponse.json();

    return NextResponse.json({
      success: true,
      attachments,
      total: Array.isArray(attachments) ? attachments.length : 0
    });
  } catch (error) {
    console.error('Attachments API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const challongeId = formData.get('challongeId')?.toString();
    const matchId = formData.get('matchId')?.toString();
    const apiKey = formData.get('apiKey')?.toString();
    const description = formData.get('description')?.toString() || '';
    const file = formData.get('file') as File | null;

    if (!challongeId || !matchId || !apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing challongeId, matchId, or apiKey'
      }, { status: 400 });
    }

    const payload = new FormData();
    if (description) {
      payload.append('match_attachment[description]', description);
    }
    if (file) {
      payload.append('match_attachment[asset]', file, file.name);
    }

    const attachmentsResponse = await fetch(
      `https://api.challonge.com/v1/tournaments/${challongeId}/matches/${matchId}/attachments.json?api_key=${apiKey}`,
      {
        method: 'POST',
        body: payload
      }
    );

    if (!attachmentsResponse.ok) {
      const errorText = await attachmentsResponse.text();
      console.error('Challonge API error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to create attachment in Challonge'
      }, { status: attachmentsResponse.status });
    }

    const attachment = await attachmentsResponse.json();

    return NextResponse.json({
      success: true,
      attachment
    });
  } catch (error) {
    console.error('Attachments POST API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
