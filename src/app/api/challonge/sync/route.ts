import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function checkTournamentExistsOnChallonge(
  challonge_id: string,
  challonge_username: string,
  api_key: string
) {
  const challongeUrl = `https://api.challonge.com/v1/tournaments/${challonge_id}.json`;
  const auth = Buffer.from(`${challonge_username}:${api_key}`).toString('base64');

  try {
    const response = await fetch(challongeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const responseText = await response.text();
      const responseData = JSON.parse(responseText);
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
  challonge_username: string,
  api_key: string
) {
  const startDate = tournament.tournament_date 
    ? new Date(tournament.tournament_date)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

  const tournamentData = {
    tournament: {
      name: tournament.challonge_name,
      url: tournament.challonge_id,
      tournament_type: 'single elimination',
      game_id: 337197,
      description: tournament.description || '',
      start_at: startDate.toISOString(),
      group_stages_enabled: true,
      tie_breaks: [
        'points difference',
        'points scored',
        'median buchholz'
      ],
      group_stage_type: 'swiss',
      swiss_rounds: 4,
      show_rounds: true,
      accept_attachments: true,
      ranked_by: 'swiss system points',
      allow_participant_match_reporting: true,
      pts_for_match_win: '1.0',
      pts_for_match_tie: '0.5',
      pts_for_bye: '1.0',
      consolation_matches_target_rank: 4,
      hold_third_place_match: true
    }
  };

  const challongeUrl = `https://api.challonge.com/v1/tournaments.json`;
  const auth = Buffer.from(`${challonge_username}:${api_key}`).toString('base64');

  console.log('Creating tournament on Challonge:', { 
    challonge_url: tournament.challonge_url,
    tournament_name: tournament.challonge_name,
    tournament_id: tournament.challonge_id,
    payload: JSON.stringify(tournamentData, null, 2)
  });

  const response = await fetch(challongeUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(tournamentData)
  });

  const responseText = await response.text();
  let responseData;

  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = { raw: responseText };
  }

  console.log('Challonge API response (create):', { 
    status: response.status, 
    statusText: response.statusText,
    data: responseData,
    body: responseText 
  });

  return { response, responseData };
}

async function getTournamentStatusFromChallonge(
  tournamentId: string,
  challonge_username: string,
  api_key: string
) {
  const challongeUrl = `https://api.challonge.com/v1/tournaments/${tournamentId}.json`;
  const auth = Buffer.from(`${challonge_username}:${api_key}`).toString('base64');

  try {
    const response = await fetch(challongeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch tournament status:', response.status);
      return { hasStarted: false };
    }

    const responseText = await response.text();
    const responseData = JSON.parse(responseText);
    
    // Tournament states: signup, underway, verified, complete
    // If state is not 'signup', it means the tournament has started
    const state = responseData?.tournament?.state;
    const hasStarted = state && state !== 'signup';
    
    console.log('Tournament status:', { tournament_id: tournamentId, state, hasStarted });
    
    return { hasStarted, state };
  } catch (error) {
    console.error('Error fetching tournament status:', error);
    return { hasStarted: false };
  }
}

async function updateTournamentOnChallonge(
  tournament: any,
  challonge_username: string,
  api_key: string,
  oldChallongeId: string
) {
  // Use the old challonge_id to find and update the tournament on Challonge
  const tournamentIdToUse = oldChallongeId || tournament.challonge_id;

  // Check if tournament has started
  const statusCheck = await getTournamentStatusFromChallonge(tournamentIdToUse, challonge_username, api_key);
  
  // Only update name and description
  const updateData: any = {
    tournament: {
      name: tournament.challonge_name,
      description: tournament.description || ''
    }
  };

  // Only include start_at if tournament hasn't started
  if (!statusCheck.hasStarted) {
    const startDate = tournament.tournament_date 
      ? new Date(tournament.tournament_date)
      : new Date();
    updateData.tournament['start_at'] = startDate.toISOString();
  } else {
    console.log('Tournament has started, skipping start_at update');
  }

  // If the challonge_id has changed, also update the url
  if (oldChallongeId && oldChallongeId !== tournament.challonge_id) {
    updateData.tournament['url'] = tournament.challonge_id;
  }

  const challongeUrl = `https://api.challonge.com/v1/tournaments/${tournamentIdToUse}.json`;
  const auth = Buffer.from(`${challonge_username}:${api_key}`).toString('base64');

  console.log('Updating tournament on Challonge:', { 
    tournament_id: tournamentIdToUse,
    new_tournament_id: tournament.challonge_id,
    payload: JSON.stringify(updateData, null, 2)
  });

  const response = await fetch(challongeUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(updateData)
  });

  const responseText = await response.text();
  let responseData;

  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = { raw: responseText };
  }

  console.log('Challonge API response (update):', { 
    status: response.status, 
    statusText: response.statusText,
    data: responseData,
    body: responseText 
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
      select: { challonge_username: true, api_key: true }
    });

    if (!user?.api_key) {
      return NextResponse.json({
        success: false,
        error: 'User does not have Challonge API credentials configured'
      }, { status: 400 });
    }

    const { challonge_username, api_key } = user;

    try {
      let result;

      if (isUpdate && oldChallongeId) {
        // Update existing tournament on Challonge using the old challonge_id
        result = await updateTournamentOnChallonge(tournament, challonge_username, api_key, oldChallongeId);
      } else if (isUpdate && tournament.challonge_id) {
        // Fallback: If no oldChallongeId but it's an update, use current challonge_id
        result = await updateTournamentOnChallonge(tournament, challonge_username, api_key, tournament.challonge_id);
      } else {
        // Creating new tournament - first check if it already exists on Challonge
        const existsResult = await checkTournamentExistsOnChallonge(tournament.challonge_id, challonge_username, api_key);
        
        if (existsResult.exists) {
          // Tournament already exists, update it instead of creating
          console.log('Tournament already exists on Challonge, updating instead of creating');
          result = await updateTournamentOnChallonge(tournament, challonge_username, api_key, tournament.challonge_id);
        } else {
          // Tournament doesn't exist, create it
          result = await createTournamentOnChallonge(tournament, challonge_username, api_key);
        }
      }

      const { response, responseData } = result;

      if (!response.ok) {
        // Handle different API error response formats
        let errorMessage = `Challonge API error: ${response.status}`;
        
        if (responseData.errors) {
          if (Array.isArray(responseData.errors)) {
            errorMessage = responseData.errors.join(', ');
          } else if (typeof responseData.errors === 'string') {
            errorMessage = responseData.errors;
          } else if (typeof responseData.errors === 'object') {
            errorMessage = JSON.stringify(responseData.errors);
          }
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.error) {
          errorMessage = responseData.error;
        }

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
