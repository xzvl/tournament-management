import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ communityId: string }> }
) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    if (authCheck.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 });
    }

    const params = await context.params;
    const communityId = Number(params.communityId);

    if (!Number.isFinite(communityId)) {
      return NextResponse.json({
        success: false,
        error: 'Community ID must be a number'
      }, { status: 400 });
    }

    const community = await prisma.community.findUnique({
      where: { community_id: communityId },
      // Cast select to `any` because generated Prisma Client types may differ
      // across environments; we want to safely include new fields when present.
      select: ({
        community_id: true,
        name: true,
        short_name: true,
        location: true,
        city: true,
        province: true,
        logo: true,
        cover: true,
        to_id: true,
        main_color: true,
        secondary_color: true,
        socmed_urls: true,
        created_at: true,
        updated_at: true
      } as any)
    });

    if (!community) {
      return NextResponse.json({
        success: false,
        error: 'Community not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      community
    });
  } catch (error) {
    console.error('Get community error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch community'
    }, { status: 500 });
  }
}
