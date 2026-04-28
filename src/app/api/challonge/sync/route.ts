import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const CHALLONGE_V21_BASE_URL = 'https://api.challonge.com/v2.1';

function getChallongeV21Headers(apiKey: string): HeadersInit {
  return {
    'Authorization-Type': 'v1',
    'Authorization': apiKey,
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/json'
  };
}

async function readJsonResponse(response: Response): Promise<any> {
  const responseText = await response.text();
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return { raw: responseText };
  }
}

function getChallongeErrorMessage(responseData: any, status: number): string {
  if (Array.isArray(responseData?.errors)) {
    const messages = responseData.errors
      .map((err: any) => err?.detail || err?.title || err?.message)
      .filter((msg: unknown): msg is string => typeof msg === 'string' && msg.length > 0);

    if (messages.length > 0) {
      return messages.join(', ');
    }
  }

  if (typeof responseData?.errors === 'string') {
    return responseData.errors;
  }

  if (typeof responseData?.message === 'string') {
    return responseData.message;
  }

  if (typeof responseData?.error === 'string') {
    return responseData.error;
  }

  return `Challonge API error: ${status}`;
}

function buildTournamentAttributes(
  tournament: any,
  options: { includeStartsAt: boolean; includeUrl: boolean }
) {
  const attributes: Record<string, unknown> = {
    name: tournament.challonge_name,
    // Final stage: Single Elimination
    tournament_type: 'single elimination',
    description: tournament.description || '',
    // Two-Stage format: groups feed into final stage
    group_stage_enabled: true,
    group_stage_options: {
      // Group Stage: Swiss, 32 participants per group, 16 advance
      stage_type: 'swiss',
      group_size: 32,
      participant_count_to_advance_per_group: 16,
      // Tie break order: Points Difference → Points Scored → Median-Buchholz
      tie_break_order: ['points_difference', 'points_scored', 'median_buchholz']
    },
    match_options: {
      accept_attachments: true,
      // Final Stage: break ties with placement matches up to 4th place
      consolation_matches_target_rank: 4
    }
  };

  if (options.includeUrl) {
    attributes.url = tournament.challonge_id;
  }

  if (options.includeStartsAt) {
    const startsAt = tournament.tournament_date
      ? new Date(tournament.tournament_date)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    attributes.starts_at = startsAt.toISOString();
  }

  return attributes;
}

async function checkTournamentExistsOnChallonge(
  challonge_id: string,
  api_key: string
) {
  const challongeUrl = `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(challonge_id)}.json`;

  try {
    const response = await fetch(challongeUrl, {
      method: 'GET',
      headers: getChallongeV21Headers(api_key)
    });

    if (response.ok) {
      const responseData = await readJsonResponse(response);
      console.log('Tournament exists on Challonge:', { tournament_id: challonge_id });
      return { exists: true, data: responseData };
    } else {
      console.log('Tournament does not exist on Challonge:', { tournament_id: challonge_id });
      return { exists: false, data: null };
    }
  } catch (error) {
    console.error('Error checking tournament existence:', error);
    return { exists: false, data: null };
  }
}

async function createTournamentOnChallonge(
  tournament: any,
  api_key: string
) {
  const tournamentData = {
    data: {
      type: 'tournament',
      attributes: buildTournamentAttributes(tournament, { includeStartsAt: true, includeUrl: true })
    }
  };

  const challongeUrl = `${CHALLONGE_V21_BASE_URL}/tournaments.json`;

  console.log('Creating tournament on Challonge:', { 
    challonge_url: tournament.challonge_url,
    tournament_name: tournament.challonge_name,
    tournament_id: tournament.challonge_id,
    payload: JSON.stringify(tournamentData, null, 2)
  });

  const response = await fetch(challongeUrl, {
    method: 'POST',
    headers: getChallongeV21Headers(api_key),
    body: JSON.stringify(tournamentData)
  });

  const responseData = await readJsonResponse(response);

  console.log('Challonge API response (create):', { 
    status: response.status, 
    statusText: response.statusText,
    data: responseData
  });

  return { response, responseData };
}

async function getTournamentStatusFromChallonge(
  tournamentId: string,
  api_key: string
) {
  const challongeUrl = `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(tournamentId)}.json`;

  try {
    const response = await fetch(challongeUrl, {
      method: 'GET',
      headers: getChallongeV21Headers(api_key)
    });

    if (!response.ok) {
      console.error('Failed to fetch tournament status:', response.status);
      return { hasStarted: false };
    }

    const responseData = await readJsonResponse(response);

    const state = responseData?.data?.attributes?.state;
    const hasStarted = typeof state === 'string' && !['signup', 'pending', 'checking_in', 'checked_in'].includes(state);
    
    console.log('Tournament status:', { tournament_id: tournamentId, state, hasStarted });
    
    return { hasStarted, state };
  } catch (error) {
    console.error('Error fetching tournament status:', error);
    return { hasStarted: false };
  }
}

async function updateTournamentOnChallonge(
  tournament: any,
  api_key: string,
  oldChallongeId: string
) {
  // Use the old challonge_id to find and update the tournament on Challonge
  const tournamentIdToUse = oldChallongeId || tournament.challonge_id;

  // Check if tournament has started
  const statusCheck = await getTournamentStatusFromChallonge(tournamentIdToUse, api_key);

  const includeUrl = Boolean(oldChallongeId && oldChallongeId !== tournament.challonge_id);

  const updateData = {
    data: {
      type: 'tournament',
      attributes: buildTournamentAttributes(tournament, {
        includeStartsAt: !statusCheck.hasStarted,
        includeUrl
      })
    }
  };

  if (statusCheck.hasStarted) {
    console.log('Tournament has started, skipping starts_at update');
  }

  const challongeUrl = `${CHALLONGE_V21_BASE_URL}/tournaments/${encodeURIComponent(tournamentIdToUse)}.json`;

  console.log('Updating tournament on Challonge:', { 
    tournament_id: tournamentIdToUse,
    new_tournament_id: tournament.challonge_id,
    payload: JSON.stringify(updateData, null, 2)
  });

  const response = await fetch(challongeUrl, {
    method: 'PUT',
    headers: getChallongeV21Headers(api_key),
    body: JSON.stringify(updateData)
  });

  const responseData = await readJsonResponse(response);

  console.log('Challonge API response (update):', { 
    status: response.status, 
    statusText: response.statusText,
    data: responseData
  });

  return { response, responseData };
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    const { tournament, user_id, isUpdate, oldChallongeId } = body;

    if (!tournament || !user_id) {
      return NextResponse.json({
        success: false,
        error: 'Tournament and user_id are required'
      }, { status: 400 });
    }

    // Get the user's Challonge credentials
    const user = await prisma.user.findUnique({
      where: { user_id },
      select: { api_key: true }
    });

    if (!user?.api_key) {
      return NextResponse.json({
        success: false,
        error: 'User does not have Challonge API credentials configured'
      }, { status: 400 });
    }

    const { api_key } = user;

    try {
      let result;

      const oldChallongeIdValue = typeof oldChallongeId === 'string'
        ? oldChallongeId.trim()
        : '';

      if (isUpdate && oldChallongeIdValue) {
        // Update existing tournament on Challonge using the old challonge_id
        result = await updateTournamentOnChallonge(tournament, api_key, oldChallongeIdValue);
      } else if (isUpdate && tournament.challonge_id) {
        // Fallback: If no oldChallongeId but it's an update, use current challonge_id
        result = await updateTournamentOnChallonge(tournament, api_key, tournament.challonge_id);
      } else {
        // Creating new tournament - first check if it already exists on Challonge
        const existsResult = await checkTournamentExistsOnChallonge(tournament.challonge_id, api_key);
        
        if (existsResult.exists) {
          // Tournament already exists, update it instead of creating
          console.log('Tournament already exists on Challonge, updating instead of creating');
          result = await updateTournamentOnChallonge(tournament, api_key, tournament.challonge_id);
        } else {
          // Tournament doesn't exist, create it
          result = await createTournamentOnChallonge(tournament, api_key);
        }
      }

      const { response, responseData } = result;

      if (!response.ok) {
        const errorMessage = getChallongeErrorMessage(responseData, response.status);

        console.error('Challonge API error:', { status: response.status, data: responseData });
        return NextResponse.json({
          success: false,
          error: errorMessage,
          details: responseData
        }, { status: response.status });
      }

      return NextResponse.json({
        success: true,
        message: isUpdate ? 'Successfully updated tournament on Challonge' : 'Successfully synced to Challonge',
        challonge_response: responseData
      });
    } catch (fetchError) {
      console.error('Challonge fetch error:', fetchError);
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      return NextResponse.json({
        success: false,
        error: `Failed to connect to Challonge: ${errorMsg}`
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Challonge sync error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
