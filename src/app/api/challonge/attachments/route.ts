import { NextRequest, NextResponse } from 'next/server';

const CHALLONGE_V21_BASE_URL = 'https://api.challonge.com/v2.1';

function getChallongeV21Headers(apiKey: string): HeadersInit {
  return {
    'Authorization-Type': 'v1',
    'Authorization': apiKey,
    'Accept': 'application/json'
  };
}

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
      `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/matches/${encodeURIComponent(matchId)}/attachments.json`,
      {
        method: 'GET',
        headers: {
          ...getChallongeV21Headers(apiKey),
          'Content-Type': 'application/vnd.api+json'
        }
      }
    );

    if (!attachmentsResponse.ok) {
      const errorText = await attachmentsResponse.text();
      console.error('Challonge API error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch attachments from Challonge'
      }, { status: attachmentsResponse.status });
    }

    const responseData = await attachmentsResponse.json();
    const attachmentsData = Array.isArray(responseData?.data) ? responseData.data : [];

    // Normalize v2.1 JSON:API response to existing v1-like shape used by UI.
    const attachments = attachmentsData.map((item: any) => {
      const attributes = item?.attributes ?? {};
      return {
        match_attachment: {
          id: item?.id,
          url: attributes?.url ?? null,
          asset_url: attributes?.url ?? null,
          description: attributes?.description ?? ''
        }
      };
    });

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
      `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/matches/${encodeURIComponent(matchId)}/attachments.json`,
      {
        method: 'POST',
        headers: getChallongeV21Headers(apiKey),
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

    const responseData = await attachmentsResponse.json();
    const attributes = responseData?.data?.attributes ?? {};

    const attachment = {
      match_attachment: {
        id: responseData?.data?.id,
        url: attributes?.url ?? null,
        asset_url: attributes?.url ?? null,
        description: attributes?.description ?? description
      }
    };

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
