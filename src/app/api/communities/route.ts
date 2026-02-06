import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get all communities
    const communities = await prisma.community.findMany({
      select: {
        community_id: true,
        name: true,
        short_name: true,
        location: true,
        city: true,
        province: true,
        logo: true,
        cover: true,
        to_id: true,
        created_at: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({
      success: true,
      communities
    });

  } catch (error) {
    console.error('Communities API Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch communities'
    }, { status: 500 });
  }
}

// POST - Create new community
export async function POST(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Only admin can create communities
    if (authCheck.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 });
    }

    const body = await request.json();
    const { name, short_name, location, city, province, to_id } = body;

    if (!name || !short_name) {
      return NextResponse.json({
        success: false,
        error: 'Community name and short name are required'
      }, { status: 400 });
    }

    // Check if short_name already exists
    const existingCommunity = await prisma.community.findFirst({
      where: { short_name },
      select: { community_id: true }
    });

    if (existingCommunity) {
      return NextResponse.json({
        success: false,
        error: 'Short name already exists'
      }, { status: 400 });
    }

    const newCommunity = await prisma.community.create({
      data: {
        name,
        short_name,
        location: location || null,
        city: city || null,
        province: province || null,
        to_id: to_id || null
      },
      select: {
        community_id: true,
        name: true,
        short_name: true,
        location: true,
        city: true,
        province: true,
        to_id: true,
        created_at: true,
        updated_at: true
      }
    });

    return NextResponse.json({
      success: true,
      community: newCommunity,
      message: 'Community created successfully'
    });

  } catch (error) {
    console.error('Create community error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create community'
    }, { status: 500 });
  }
}

// PUT - Update community
export async function PUT(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Only admin can update communities
    if (authCheck.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 });
    }

    const body = await request.json();
    const { community_id, name, short_name, location, city, province, to_id } = body;

    if (!community_id || !name || !short_name) {
      return NextResponse.json({
        success: false,
        error: 'Community ID, name and short name are required'
      }, { status: 400 });
    }

    // Check if community exists
    const existingCommunity = await prisma.community.findUnique({
      where: { community_id },
      select: { community_id: true }
    });

    if (!existingCommunity) {
      return NextResponse.json({
        success: false,
        error: 'Community not found'
      }, { status: 404 });
    }

    // Check if short_name already exists for other communities
    const duplicateCheck = await prisma.community.findFirst({
      where: {
        short_name,
        community_id: { not: community_id }
      },
      select: { community_id: true }
    });

    if (duplicateCheck) {
      return NextResponse.json({
        success: false,
        error: 'Short name already exists'
      }, { status: 400 });
    }

    // Update community
    const updatedCommunity = await prisma.community.update({
      where: { community_id },
      data: {
        name,
        short_name,
        location: location || null,
        city: city || null,
        province: province || null,
        to_id: to_id || null
      },
      select: {
        community_id: true,
        name: true,
        short_name: true,
        location: true,
        city: true,
        province: true,
        to_id: true,
        created_at: true,
        updated_at: true
      }
    });

    return NextResponse.json({
      success: true,
      community: updatedCommunity,
      message: 'Community updated successfully'
    });

  } catch (error) {
    console.error('Update community error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update community'
    }, { status: 500 });
  }
}

// DELETE - Remove community
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Only admin can delete communities
    if (authCheck.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const communityIdParam = searchParams.get('community_id');

    if (!communityIdParam) {
      return NextResponse.json({
        success: false,
        error: 'Community ID is required'
      }, { status: 400 });
    }

    const community_id = Number(communityIdParam);

    if (!Number.isFinite(community_id)) {
      return NextResponse.json({
        success: false,
        error: 'Community ID must be a number'
      }, { status: 400 });
    }

    // Check if community exists
    const existingCommunity = await prisma.community.findUnique({
      where: { community_id },
      select: { community_id: true }
    });

    if (!existingCommunity) {
      return NextResponse.json({
        success: false,
        error: 'Community not found'
      }, { status: 404 });
    }

    // Check if community has associated judges
    const associatedJudges = await prisma.$queryRaw<
      Array<{ judge_id: number }>
    >`SELECT judge_id FROM judges WHERE community_ids @> ${JSON.stringify([community_id])}::jsonb`;

    if (associatedJudges.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete community. ${associatedJudges.length} judge(s) are associated with this community. Please reassign or remove these judges first.`
      }, { status: 400 });
    }

    // Delete the community
    await prisma.community.delete({
      where: { community_id }
    });

    return NextResponse.json({
      success: true,
      message: 'Community deleted successfully'
    });

  } catch (error) {
    console.error('Delete community error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete community'
    }, { status: 500 });
  }
}