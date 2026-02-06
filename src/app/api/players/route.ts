import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const players = await prisma.player.findMany({
      select: {
        player_id: true,
        player_name: true,
        name: true
      },
      orderBy: { player_name: 'asc' }
    });

    return NextResponse.json({ success: true, players });
  } catch (error) {
    console.error('Get players error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
