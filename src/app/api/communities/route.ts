import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get all communities
    const query = `
      SELECT 
        c.community_id, 
        c.name, 
        c.short_name, 
        c.location, 
        c.city, 
        c.province, 
        c.logo,
        c.cover,
        c.to_id,
        c.created_at
      FROM communities c
      ORDER BY c.name ASC
    `;
    
    const communities = await executeQuery(query, []) as any[];

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
    const existingCommunity = await executeQuery(
      'SELECT community_id FROM communities WHERE short_name = ?',
      [short_name]
    ) as any[];

    if (existingCommunity.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Short name already exists'
      }, { status: 400 });
    }

    // Insert new community
    const insertQuery = `
      INSERT INTO communities (name, short_name, location, city, province, to_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      name,
      short_name,
      location || null,
      city || null,
      province || null,
      to_id || null
    ]) as any;

    // Get the created community
    const newCommunity = await executeQuery(
      'SELECT community_id, name, short_name, location, city, province, to_id, created_at, updated_at FROM communities WHERE community_id = ?',
      [result.insertId]
    ) as any[];

    return NextResponse.json({
      success: true,
      community: newCommunity[0],
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
    const existingCommunity = await executeQuery(
      'SELECT community_id FROM communities WHERE community_id = ?',
      [community_id]
    ) as any[];

    if (existingCommunity.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Community not found'
      }, { status: 404 });
    }

    // Check if short_name already exists for other communities
    const duplicateCheck = await executeQuery(
      'SELECT community_id FROM communities WHERE short_name = ? AND community_id != ?',
      [short_name, community_id]
    ) as any[];

    if (duplicateCheck.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Short name already exists'
      }, { status: 400 });
    }

    // Update community
    const updateQuery = `
      UPDATE communities 
      SET name = ?, short_name = ?, location = ?, city = ?, province = ?, to_id = ?, updated_at = NOW()
      WHERE community_id = ?
    `;
    
    await executeQuery(updateQuery, [
      name,
      short_name,
      location || null,
      city || null,
      province || null,
      to_id || null,
      community_id
    ]);

    // Get the updated community
    const updatedCommunity = await executeQuery(
      'SELECT community_id, name, short_name, location, city, province, to_id, created_at, updated_at FROM communities WHERE community_id = ?',
      [community_id]
    ) as any[];

    return NextResponse.json({
      success: true,
      community: updatedCommunity[0],
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
    const community_id = searchParams.get('community_id');

    if (!community_id) {
      return NextResponse.json({
        success: false,
        error: 'Community ID is required'
      }, { status: 400 });
    }

    // Check if community exists
    const existingCommunity = await executeQuery(
      'SELECT community_id FROM communities WHERE community_id = ?',
      [community_id]
    ) as any[];

    if (existingCommunity.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Community not found'
      }, { status: 404 });
    }

    // Check if community has associated judges
    const associatedJudges = await executeQuery(
      'SELECT judge_id FROM judges WHERE JSON_CONTAINS(community_ids, ?)',
      [community_id]
    ) as any[];

    if (associatedJudges.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete community. ${associatedJudges.length} judge(s) are associated with this community. Please reassign or remove these judges first.`
      }, { status: 400 });
    }

    // Delete the community
    await executeQuery(
      'DELETE FROM communities WHERE community_id = ?',
      [community_id]
    );

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