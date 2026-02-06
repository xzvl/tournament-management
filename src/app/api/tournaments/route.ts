import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import { verifyAuth } from '@/lib/auth';

// GET - List tournaments for the user's communities
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const showAll = url.searchParams.get('showAll') === 'true';

    let authCheck: any = { success: false, user: null };
    
    // Only require auth if showAll is not true
    if (!showAll) {
      authCheck = await verifyAuth(request);
      if (!authCheck.success || !authCheck.user) {
        return NextResponse.json({
          success: false,
          error: 'Authentication required'
        }, { status: 401 });
      }
    } else {
      // For public access, try to get auth but don't fail if unavailable
      authCheck = await verifyAuth(request);
    }

    const user = authCheck.user;

    let query = '';
    let params: any[] = [];

    if (showAll || user?.role === 'admin') {
      // Show all tournaments (for admin or when showAll=true)
      query = `
        SELECT ct.*,
               u.username as organizer_username,
               u.name as organizer_name,
               c.name as community_name,
               0 as participant_count
        FROM challonge_tournaments ct
        LEFT JOIN users u ON ct.to_id = u.user_id
        LEFT JOIN communities c ON ct.to_id = c.to_id
        ORDER BY ct.tournament_date DESC, ct.created_at DESC
      `;
    } else {
      // Non-admin users can only see their own tournaments by default
      query = `
        SELECT ct.*,
               u.username as organizer_username,
               u.name as organizer_name,
               c.name as community_name,
               0 as participant_count
        FROM challonge_tournaments ct
        LEFT JOIN users u ON ct.to_id = u.user_id
        LEFT JOIN communities c ON ct.to_id = c.to_id
        WHERE ct.to_id = ?
        ORDER BY ct.tournament_date DESC, ct.created_at DESC
      `;
      params = [user.user_id];
    }

    const tournaments = await executeQuery(query, params) as any[];

    // Format dates to PH timezone (Asia/Manila) with time
    const formattedTournaments = tournaments.map(tournament => ({
      ...tournament,
      tournament_date: tournament.tournament_date ? 
        new Date(tournament.tournament_date).toLocaleString('en-CA', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(', ', 'T').replace(/\//g, '-') : 
        tournament.tournament_date
    }));

    return NextResponse.json({
      success: true,
      tournaments: formattedTournaments
    });

  } catch (error) {
    console.error('Get tournaments error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Create new tournament
export async function POST(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;
    const body = await request.json();
    const { 
      challonge_id, 
      challonge_url, 
      challonge_name, 
      challonge_cover,
      description, 
      tournament_date, 
      total_stadium,
      assigned_judge_ids,
      pre_registered_players,
      to_id
    } = body;

    // Use provided to_id for admins, otherwise use current user's ID
    const organizerId = (user.role === 'admin' && to_id) ? to_id : user.user_id;

    console.log('POST request body:', { challonge_id, challonge_url, challonge_name, tournament_date });

    if (!challonge_id || !challonge_url || !challonge_name || !tournament_date) {
      return NextResponse.json({
        success: false,
        error: 'Challonge ID, URL, name, and tournament date are required'
      }, { status: 400 });
    }

    // Check if tournament with this challonge_id already exists
    const existingTournament = await executeQuery(
      'SELECT ch_id FROM challonge_tournaments WHERE challonge_id = ?',
      [challonge_id]
    ) as any[];

    if (existingTournament.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Tournament with this Challonge ID already exists'
      }, { status: 400 });
    }

    // For non-admin users, simplify for now
    let finalAssignedJudgeIds = assigned_judge_ids || [];

    // Insert new tournament
    const insertQuery = `
      INSERT INTO challonge_tournaments 
      (challonge_id, challonge_url, challonge_name, challonge_cover, description, 
       tournament_date, total_stadium, assigned_judge_ids, pre_registered_players, active, to_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await executeQuery(insertQuery, [
      challonge_id,
      challonge_url,
      challonge_name,
      challonge_cover || null,
      description || null,
      tournament_date,
      total_stadium || 1,
      JSON.stringify(finalAssignedJudgeIds),
      JSON.stringify(pre_registered_players || []),
      true,
      organizerId
    ]) as any;

    // Get the created tournament
    const newTournament = await executeQuery(
      'SELECT *, 0 as participant_count FROM challonge_tournaments WHERE ch_id = ?',
      [result.insertId]
    ) as any[];

    // Format date to PH timezone (Asia/Manila) with time
    const formattedTournament = {
      ...newTournament[0],
      tournament_date: newTournament[0].tournament_date ? 
        new Date(newTournament[0].tournament_date).toLocaleString('en-CA', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(', ', 'T').replace(/\//g, '-') : 
        newTournament[0].tournament_date
    };

    return NextResponse.json({
      success: true,
      tournament: formattedTournament,
      message: 'Tournament created successfully'
    });

  } catch (error) {
    console.error('Create tournament error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// PUT - Update tournament
export async function PUT(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;
    const body = await request.json();
    const { 
      ch_id,
      challonge_id,
      challonge_url, 
      challonge_name, 
      challonge_cover,
      description, 
      tournament_date, 
      total_stadium,
      assigned_judge_ids,
      pre_registered_players,
      active,
      to_id
    } = body;

    console.log('PUT request body:', { ch_id, challonge_id, challonge_url, challonge_name, tournament_date, active, to_id });

    if (!ch_id) {
      return NextResponse.json({
        success: false,
        error: 'Tournament ID is required'
      }, { status: 400 });
    }

    // Check if tournament exists and user has permission
    let existingQuery = '';
    let existingParams: any[] = [ch_id];

    if (user.role === 'admin') {
      existingQuery = 'SELECT * FROM challonge_tournaments WHERE ch_id = ?';
    } else {
      existingQuery = 'SELECT * FROM challonge_tournaments WHERE ch_id = ? AND to_id = ?';
      existingParams.push(user.user_id);
    }

    const existing = await executeQuery(existingQuery, existingParams) as any[];

    if (existing.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tournament not found or access denied'
      }, { status: 404 });
    }

    // For non-admin users, simplify for now
    let finalAssignedJudgeIds = assigned_judge_ids;

    // Update tournament
    const updateQuery = `
      UPDATE challonge_tournaments 
      SET challonge_id = COALESCE(?, challonge_id),
          challonge_url = COALESCE(?, challonge_url),
          challonge_name = COALESCE(?, challonge_name),
          challonge_cover = COALESCE(?, challonge_cover),
          description = COALESCE(?, description),
          tournament_date = COALESCE(?, tournament_date),
          total_stadium = COALESCE(?, total_stadium),
          assigned_judge_ids = COALESCE(?, assigned_judge_ids),
          pre_registered_players = COALESCE(?, pre_registered_players),
          active = COALESCE(?, active),
          to_id = COALESCE(?, to_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE ch_id = ?
    `;

    await executeQuery(updateQuery, [
      challonge_id,
      challonge_url,
      challonge_name,
      challonge_cover,
      description,
      tournament_date,
      total_stadium,
      finalAssignedJudgeIds ? JSON.stringify(finalAssignedJudgeIds) : null,
      pre_registered_players ? JSON.stringify(pre_registered_players) : null,
      active,
      (user.role === 'admin' && to_id) ? to_id : null,
      ch_id
    ]);

    // Get the updated tournament
    const updatedTournament = await executeQuery(
      'SELECT *, 0 as participant_count FROM challonge_tournaments WHERE ch_id = ?',
      [ch_id]
    ) as any[];

    // Format date to PH timezone (Asia/Manila) with time
    const formattedTournament = {
      ...updatedTournament[0],
      tournament_date: updatedTournament[0].tournament_date ? 
        new Date(updatedTournament[0].tournament_date).toLocaleString('en-CA', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(', ', 'T').replace(/\//g, '-') : 
        updatedTournament[0].tournament_date
    };

    return NextResponse.json({
      success: true,
      tournament: formattedTournament,
      message: 'Tournament updated successfully'
    });

  } catch (error) {
    console.error('Update tournament error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// DELETE - Delete tournament
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;
    const url = new URL(request.url);
    const ch_id = url.searchParams.get('ch_id');

    if (!ch_id) {
      return NextResponse.json({
        success: false,
        error: 'Tournament ID is required'
      }, { status: 400 });
    }

    // Check if tournament exists and user has permission
    let existingQuery = '';
    let existingParams: any[] = [ch_id];

    if (user.role === 'admin') {
      existingQuery = 'SELECT * FROM challonge_tournaments WHERE ch_id = ?';
    } else {
      existingQuery = 'SELECT * FROM challonge_tournaments WHERE ch_id = ? AND to_id = ?';
      existingParams.push(user.user_id);
    }

    const existing = await executeQuery(existingQuery, existingParams) as any[];

    if (existing.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tournament not found or access denied'
      }, { status: 404 });
    }

    // Delete tournament
    await executeQuery(
      'DELETE FROM challonge_tournaments WHERE ch_id = ?',
      [ch_id]
    );

    return NextResponse.json({
      success: true,
      message: 'Tournament deleted successfully'
    });

  } catch (error) {
    console.error('Delete tournament error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}