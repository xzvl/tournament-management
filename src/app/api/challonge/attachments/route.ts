import { NextRequest, NextResponse } from 'next/server';

const CHALLONGE_V21_BASE_URL = 'https://api.challonge.com/v2.1';
const CHALLONGE_V1_BASE_URL = 'https://api.challonge.com/v1';

function getChallongeV21Headers(apiKey: string): HeadersInit {
  return {
    'Authorization-Type': 'v1',
    'Authorization': apiKey,
    'Accept': 'application/json'
  };
}

function normalizeV21Attachment(item: any) {
  const attributes = item?.attributes ?? {};
  return {
    match_attachment: {
      id: item?.id,
      url: attributes?.url ?? null,
      asset_url: attributes?.url ?? null,
      description: attributes?.description ?? ''
    }
  };
}

function normalizeV1Attachment(item: any) {
  const attachment = item?.match_attachment ?? item ?? {};
  return {
    match_attachment: {
      id: attachment?.id,
      url: attachment?.url ?? null,
      asset_url: attachment?.asset_url ?? null,
      description: attachment?.description ?? ''
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const challongeId = url.searchParams.get('challongeId');
    const matchId = url.searchParams.get('matchId');
    const apiKey = request.headers.get('x-challonge-api-key') || url.searchParams.get('apiKey');

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

    if (attachmentsResponse.ok) {
      const responseData = await attachmentsResponse.json();
      const attachmentsData = Array.isArray(responseData?.data) ? responseData.data : [];
      const attachments = attachmentsData.map(normalizeV21Attachment);

      return NextResponse.json({
        success: true,
        attachments,
        total: Array.isArray(attachments) ? attachments.length : 0
      });
    }

    // Fallback to v1 when v2.1 attachments endpoint returns Not Found/Bad Request.
    const v1Response = await fetch(
      `${CHALLONGE_V1_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/matches/${encodeURIComponent(matchId)}/attachments.json?api_key=${encodeURIComponent(apiKey)}`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    );

    if (!v1Response.ok) {
      const v21ErrorText = await attachmentsResponse.text();
      const v1ErrorText = await v1Response.text();
      console.error('Challonge attachments GET error (v2.1):', v21ErrorText);
      console.error('Challonge attachments GET error (v1 fallback):', v1ErrorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch attachments from Challonge',
        details: {
          v21: v21ErrorText,
          v1: v1ErrorText
        }
      }, { status: v1Response.status });
    }

    const v1Data = await v1Response.json();
    const attachments = Array.isArray(v1Data) ? v1Data.map(normalizeV1Attachment) : [];

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
    const providedUrl = formData.get('url')?.toString() || '';
    const file = formData.get('file') as File | null;

    if (!challongeId || !matchId || !apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing challongeId, matchId, or apiKey'
      }, { status: 400 });
    }

    const fallbackUrl = `${new URL(request.url).origin}/${encodeURIComponent(challongeId)}/player?match=${encodeURIComponent(matchId)}`;
    const normalizedUrl = providedUrl || fallbackUrl;

    // v2.1 docs require JSON:API payload for create attachment.
    if (!file) {
      const v21Payload = {
        data: {
          type: 'match_attachment',
          attributes: {
            url: normalizedUrl,
            description: description || 'Match attachment'
          }
        }
      };

      const v21Response = await fetch(
        `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/matches/${encodeURIComponent(matchId)}/attachments.json`,
        {
          method: 'POST',
          headers: {
            ...getChallongeV21Headers(apiKey),
            'Content-Type': 'application/vnd.api+json'
          },
          body: JSON.stringify(v21Payload)
        }
      );

      if (v21Response.ok) {
        const responseData = await v21Response.json();
        return NextResponse.json({
          success: true,
          attachment: normalizeV21Attachment(responseData?.data)
        });
      }

      const v21ErrorText = await v21Response.text();
      console.error('Challonge attachments POST v2.1 error:', v21ErrorText);
    }

    // Fallback to v1 form upload for file-based attachments or v2.1 failures.
    const v1Payload = new FormData();
    v1Payload.append('match_attachment[description]', description || 'Match attachment');
    v1Payload.append('match_attachment[url]', normalizedUrl);
    if (file) {
      v1Payload.append('match_attachment[asset]', file, file.name);
    }

    const v1Response = await fetch(
      `${CHALLONGE_V1_BASE_URL}/tournaments/${encodeURIComponent(challongeId)}/matches/${encodeURIComponent(matchId)}/attachments.json?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: v1Payload
      }
    );

    if (!v1Response.ok) {
      const errorText = await v1Response.text();
      console.error('Challonge attachments POST v1 fallback error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Failed to create attachment in Challonge',
        details: errorText
      }, { status: v1Response.status });
    }

    const v1Data = await v1Response.json();
    return NextResponse.json({
      success: true,
      attachment: normalizeV1Attachment(v1Data)
    });
  } catch (error) {
    console.error('Attachments POST API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
