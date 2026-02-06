import { NextRequest, NextResponse } from 'next/server';

// This would typically connect to your Challonge API
// For now, we'll use mock data
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ challongeId: string }> }
) {
  try {
    const params = await context.params;
    const challongeId = params.challongeId;

    // Mock tournament data - replace with actual Challonge API call
    const mockTournament = {
      id: challongeId,
      name: `Tournament ${challongeId}`,
      status: 'active',
      participants: [
        { id: 1, name: 'Player A' },
        { id: 2, name: 'Player B' },
        { id: 3, name: 'Player C' },
        { id: 4, name: 'Player D' }
      ],
      matches: [
        {
          id: 1,
          round: 1,
          player1_id: 1,
          player2_id: 2,
          winner_id: null,
          scores_csv: '',
          state: 'open'
        },
        {
          id: 2,
          round: 1,
          player1_id: 3,
          player2_id: 4,
          winner_id: null,
          scores_csv: '',
          state: 'open'
        }
      ]
    };

    return NextResponse.json({ success: true, tournament: mockTournament });
  } catch (error) {
    console.error('Error fetching tournament:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch tournament data' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ challongeId: string }> }
) {
  try {
    const params = await context.params;
    const challongeId = params.challongeId;
    const body = await request.json();
    const { matchId, winnerId, scores } = body;

    // Here you would update the match in Challonge
    // For now, we'll just return success
    console.log(`Updating match ${matchId} in tournament ${challongeId}:`, {
      winnerId,
      scores
    });

    return NextResponse.json({ success: true, message: 'Match updated successfully' });
  } catch (error) {
    console.error('Error updating match:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update match' },
      { status: 500 }
    );
  }
}
