import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const players = await executeQuery(
      'SELECT player_id, player_name, name FROM players ORDER BY player_name ASC'
    ) as Array<{ player_id: number; player_name: string; name: string }>;

    return NextResponse.json({ success: true, players });
  } catch (error) {
    console.error('Get players error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
