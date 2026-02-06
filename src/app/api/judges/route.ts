import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import jwt from 'jsonwebtoken';

// Middleware to verify authentication
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'No token provided', status: 401 };
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';

  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Verify user exists and get their community
    const userQuery = `
      SELECT u.user_id, u.username, u.user_role, c.community_id 
      FROM users u 
      LEFT JOIN communities c ON u.user_id = c.to_id 
      WHERE u.user_id = ?
    `;
    const users = await executeQuery(userQuery, [decoded.userId]) as any[];

    if (users.length === 0) {
      return { error: 'User not found', status: 401 };
    }

    // For admin users, we don't require a community
    if (users[0].user_role !== 'admin' && !users[0].community_id) {
      return { error: 'No community found. Please create a community first.', status: 400 };
    }

    return { 
      user: {
        user_id: users[0].user_id,
        username: users[0].username,
        role: users[0].user_role, // Map user_role to role for consistency
        user_role: users[0].user_role,
        community_id: users[0].community_id
      }
    };
  } catch (error) {
    return { error: 'Invalid token', status: 401 };
  }
}

// GET - List all judges for user's community
export async function GET(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;

    // Admin can see all judges, others see only their community's judges
    let query = '';
    let queryParams: Array<string | number> = [];
    
    if (user.role === 'admin') {
      // Admin sees ALL judges regardless of community relationships
      query = `
        SELECT 
          j.judge_id, 
          j.username, 
          j.judge_name, 
          j.community_ids,
          GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') as community_names,
          j.created_at, 
          j.updated_at
        FROM judges j
        LEFT JOIN communities c ON JSON_CONTAINS(j.community_ids, c.community_id)
        GROUP BY j.judge_id, j.username, j.judge_name, j.community_ids, j.created_at, j.updated_at
        ORDER BY j.created_at DESC
      `;
      queryParams = [];
    } else {
      // Non-admin users only see judges from their community
      query = `
        SELECT 
          j.judge_id, 
          j.username, 
          j.judge_name, 
          j.community_ids,
          GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') as community_names,
          j.created_at, 
          j.updated_at
        FROM judges j
        LEFT JOIN communities c ON JSON_CONTAINS(j.community_ids, c.community_id)
        WHERE JSON_CONTAINS(j.community_ids, ?)
        GROUP BY j.judge_id, j.username, j.judge_name, j.community_ids, j.created_at, j.updated_at
        ORDER BY j.created_at DESC
      `;
      queryParams = [user.community_id];
    }
    
    const judges = await executeQuery(query, queryParams) as any[];

    return NextResponse.json({
      success: true,
      judges: judges
    });

  } catch (error) {
    console.error('Get judges error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

// POST - Create new judge
export async function POST(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;

    const body = await request.json();
    const { username, password, judge_name, community_ids } = body;

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: 'Username and password are required'
      }, { status: 400 });
    }

    // Determine which communities to assign
    let assignedCommunities;
    if (user.role === 'admin') {
      // Admin can assign any communities
      if (community_ids && Array.isArray(community_ids) && community_ids.length > 0) {
        assignedCommunities = JSON.stringify(community_ids);
      } else if (community_ids && typeof community_ids === 'string') {
        // Handle single community ID
        assignedCommunities = JSON.stringify([parseInt(community_ids)]);
      } else {
        return NextResponse.json({
          success: false,
          error: 'Admin must select at least one community'
        }, { status: 400 });
      }
    } else {
      // Non-admin can only assign their own community
      assignedCommunities = JSON.stringify([user.community_id]);
    }

    // Check if username already exists
    const existingJudge = await executeQuery(
      'SELECT judge_id FROM judges WHERE username = ?',
      [username]
    ) as any[];
    
    if (existingJudge.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'A judge with this username already exists'
      }, { status: 400 });
    }

    // Insert new judge
    const insertQuery = `
      INSERT INTO judges (username, password, judge_name, community_ids)
      VALUES (?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      username,
      password,
      judge_name || null,
      assignedCommunities
    ]) as any;

    // Get the created judge with community names
    const newJudgeQuery = `
      SELECT 
        j.judge_id, 
        j.username, 
        j.judge_name, 
        j.community_ids,
        GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') as community_names,
        j.created_at, 
        j.updated_at
      FROM judges j
      LEFT JOIN communities c ON JSON_CONTAINS(j.community_ids, c.community_id)
      WHERE j.judge_id = ?
      GROUP BY j.judge_id, j.username, j.judge_name, j.community_ids, j.created_at, j.updated_at
    `;
    const newJudge = await executeQuery(newJudgeQuery, [result.insertId]) as any[];

    return NextResponse.json({
      success: true,
      judge: newJudge[0],
      message: 'Judge created successfully'
    });

  } catch (error) {
    console.error('Create judge error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

// PUT - Update existing judge
export async function PUT(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;

    const body = await request.json();
    const { judge_id, username, password, judge_name, community_ids } = body;

    if (!judge_id || !username) {
      return NextResponse.json({
        success: false,
        error: 'Judge ID and username are required'
      }, { status: 400 });
    }

    // Determine which communities to assign
    let assignedCommunities;
    if (user.role === 'admin' && community_ids) {
      // Admin can update any communities
      if (Array.isArray(community_ids) && community_ids.length > 0) {
        assignedCommunities = JSON.stringify(community_ids);
      } else if (typeof community_ids === 'string') {
        assignedCommunities = JSON.stringify([parseInt(community_ids)]);
      } else {
        return NextResponse.json({
          success: false,
          error: 'Invalid community selection'
        }, { status: 400 });
      }
    }

    // Check if judge exists and user has access
    let existingJudge;
    if (user.role === 'admin') {
      // Admin can access any judge
      existingJudge = await executeQuery(
        'SELECT judge_id FROM judges WHERE judge_id = ?',
        [judge_id]
      ) as any[];
    } else {
      // Non-admin users can only access judges from their community
      existingJudge = await executeQuery(
        'SELECT judge_id FROM judges WHERE judge_id = ? AND JSON_CONTAINS(community_ids, ?)',
        [judge_id, user.community_id]
      ) as any[];
    }

    if (existingJudge.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Judge not found or access denied'
      }, { status: 404 });
    }

    // Check if username already exists for other judges
    const duplicateUsername = await executeQuery(
      'SELECT judge_id FROM judges WHERE username = ? AND judge_id != ?',
      [username, judge_id]
    ) as any[];
    
    if (duplicateUsername.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'A judge with this username already exists'
      }, { status: 400 });
    }

    // Prepare update query
    let updateQuery;
    let updateParams;
    
    if (user.role === 'admin' && assignedCommunities) {
      updateQuery = 'UPDATE judges SET username = ?, judge_name = ?, community_ids = ?, updated_at = NOW() WHERE judge_id = ?';
      updateParams = [username, judge_name || null, assignedCommunities, judge_id];
    } else {
      updateQuery = 'UPDATE judges SET username = ?, judge_name = ?, updated_at = NOW() WHERE judge_id = ?';
      updateParams = [username, judge_name || null, judge_id];
    }

    // If password is provided, include in update
    if (password) {
      if (user.role === 'admin' && assignedCommunities) {
        updateQuery = 'UPDATE judges SET username = ?, judge_name = ?, community_ids = ?, password = ?, updated_at = NOW() WHERE judge_id = ?';
        updateParams = [username, judge_name || null, assignedCommunities, password, judge_id];
      } else {
        updateQuery = 'UPDATE judges SET username = ?, judge_name = ?, password = ?, updated_at = NOW() WHERE judge_id = ?';
        updateParams = [username, judge_name || null, password, judge_id];
      }
    }
    
    await executeQuery(updateQuery, updateParams);

    // Get the updated judge with community names
    const updatedJudgeQuery = `
      SELECT 
        j.judge_id, 
        j.username, 
        j.judge_name, 
        j.community_ids,
        GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') as community_names,
        j.created_at, 
        j.updated_at
      FROM judges j
      LEFT JOIN communities c ON JSON_CONTAINS(j.community_ids, c.community_id)
      WHERE j.judge_id = ?
      GROUP BY j.judge_id, j.username, j.judge_name, j.community_ids, j.created_at, j.updated_at
    `;
    const updatedJudge = await executeQuery(updatedJudgeQuery, [judge_id]) as any[];

    return NextResponse.json({
      success: true,
      judge: updatedJudge[0],
      message: 'Judge updated successfully'
    });

  } catch (error) {
    console.error('Update judge error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

// DELETE - Remove judge
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;

    const { searchParams } = new URL(request.url);
    const judge_id = searchParams.get('judge_id');

    if (!judge_id) {
      return NextResponse.json({
        success: false,
        error: 'Judge ID is required'
      }, { status: 400 });
    }

    // Check if judge exists and user has access
    let existingJudge;
    if (user.role === 'admin') {
      // Admin can delete any judge
      existingJudge = await executeQuery(
        'SELECT judge_id, community_ids FROM judges WHERE judge_id = ?',
        [judge_id]
      ) as any[];
    } else {
      // Non-admin users can only delete judges from their community
      existingJudge = await executeQuery(
        'SELECT judge_id, community_ids FROM judges WHERE judge_id = ? AND JSON_CONTAINS(community_ids, ?)',
        [judge_id, user.community_id]
      ) as any[];
    }

    if (existingJudge.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Judge not found or access denied'
      }, { status: 404 });
    }

    // Admin can delete any judge completely, non-admin may just remove from community
    const judge = existingJudge[0];
    
    if (user.role === 'admin') {
      // Admin deletes the judge completely
      await executeQuery(
        'DELETE FROM judges WHERE judge_id = ?',
        [judge_id]
      );
    } else {
      // Non-admin: handle community removal logic
      let communityIds: number[] = [];
      try {
        communityIds = JSON.parse(judge.community_ids) as number[];
      } catch (e) {
        // Fallback for comma-separated format
        communityIds = judge.community_ids
          .split(',')
          .map((id: string) => parseInt(id.trim(), 10));
      }
      
      if (communityIds.length > 1) {
        // Remove this community from the list
        const updatedCommunityIds = communityIds.filter((id) => id !== user.community_id);
        
        await executeQuery(
          'UPDATE judges SET community_ids = ? WHERE judge_id = ?',
          [JSON.stringify(updatedCommunityIds), judge_id]
        );
      } else {
        // Delete the judge completely if only belongs to this community
        await executeQuery(
          'DELETE FROM judges WHERE judge_id = ?',
          [judge_id]
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Judge removed successfully'
    });

  } catch (error) {
    console.error('Delete judge error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}