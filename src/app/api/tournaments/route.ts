import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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

    const tournaments = await prisma.challongeTournament.findMany({
      where: showAll || user?.role === 'admin'
        ? undefined
        : { to_id: user?.user_id },
      include: {
        organizer: {
          select: { username: true, name: true }
        }
      },
      orderBy: [
        { tournament_date: 'desc' },
        { created_at: 'desc' }
      ]
    });

    const communityRows = await prisma.community.findMany({
      select: { community_id: true, name: true, to_id: true }
    });
    const communityByToId = new Map(
      communityRows.map((community) => [community.to_id, community.name])
    );

    // Format dates to PH timezone (Asia/Manila) with time
    const formattedTournaments = tournaments.map(tournament => ({
      ...tournament,
      organizer_username: tournament.organizer?.username ?? null,
      organizer_name: tournament.organizer?.name ?? null,
      community_name: communityByToId.get(String(tournament.to_id ?? '')) ?? null,
      participant_count: 0,
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
    const existingTournament = await prisma.challongeTournament.findUnique({
      where: { challonge_id },
      select: { ch_id: true }
    });

    if (existingTournament) {
      return NextResponse.json({
        success: false,
        error: 'Tournament with this Challonge ID already exists'
      }, { status: 400 });
    }

    // For non-admin users, simplify for now
    let finalAssignedJudgeIds = assigned_judge_ids || [];

    const newTournament = await prisma.challongeTournament.create({
      data: {
        challonge_id,
        challonge_url,
        challonge_name,
        challonge_cover: challonge_cover || null,
        description: description || null,
        tournament_date: new Date(tournament_date),
        total_stadium: total_stadium || 1,
        assigned_judge_ids: finalAssignedJudgeIds,
        pre_registered_players: pre_registered_players || [],
        active: true,
        to_id: organizerId
      }
    });

    // Format date to PH timezone (Asia/Manila) with time
    const formattedTournament = {
      ...newTournament,
      participant_count: 0,
      tournament_date: newTournament.tournament_date ?
        new Date(newTournament.tournament_date).toLocaleString('en-CA', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(', ', 'T').replace(/\//g, '-') :
        newTournament.tournament_date
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
    const existing = await prisma.challongeTournament.findFirst({
      where: user.role === 'admin'
        ? { ch_id }
        : { ch_id, to_id: user.user_id }
    });

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Tournament not found or access denied'
      }, { status: 404 });
    }

    // For non-admin users, simplify for now
    let finalAssignedJudgeIds = assigned_judge_ids;

    // Update tournament
    const updatedTournament = await prisma.challongeTournament.update({
      where: { ch_id },
      data: {
        challonge_id: challonge_id ?? undefined,
        challonge_url: challonge_url ?? undefined,
        challonge_name: challonge_name ?? undefined,
        challonge_cover: challonge_cover ?? undefined,
        description: description ?? undefined,
        tournament_date: tournament_date ? new Date(tournament_date) : undefined,
        total_stadium: total_stadium ?? undefined,
        assigned_judge_ids: finalAssignedJudgeIds ?? undefined,
        pre_registered_players: pre_registered_players ?? undefined,
        active: active ?? undefined,
        to_id: user.role === 'admin' && to_id ? to_id : undefined
      }
    });

    // Format date to PH timezone (Asia/Manila) with time
    const formattedTournament = {
      ...updatedTournament,
      participant_count: 0,
      tournament_date: updatedTournament.tournament_date ?
        new Date(updatedTournament.tournament_date).toLocaleString('en-CA', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(', ', 'T').replace(/\//g, '-') :
        updatedTournament.tournament_date
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
    const existing = await prisma.challongeTournament.findFirst({
      where: user.role === 'admin'
        ? { ch_id }
        : { ch_id, to_id: user.user_id }
    });

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Tournament not found or access denied'
      }, { status: 404 });
    }

    // Delete tournament
    await prisma.challongeTournament.delete({
      where: { ch_id }
    });

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