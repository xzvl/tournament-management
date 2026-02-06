import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import jwt from 'jsonwebtoken';

// Middleware to verify admin access
async function verifyAdminAccess(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'No token provided', status: 401 };
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';

  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    // Verify user is admin
    const query = 'SELECT user_id, username, user_role FROM users WHERE user_id = ? AND user_role = "admin"';
    const users = await executeQuery(query, [decoded.userId]) as any[];

    if (users.length === 0) {
      return { error: 'Admin access required', status: 403 };
    }

    return { user: users[0] };
  } catch (error) {
    return { error: 'Invalid token', status: 401 };
  }
}

// GET - Get user by ID (Public - for tournament organizer lookup)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    const parsedUserId = parseInt(userId);
    if (isNaN(parsedUserId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid user ID'
      }, { status: 400 });
    }

    const query = 'SELECT user_id, username, name, email, api_key, challonge_username FROM users WHERE user_id = ?';
    const users = await executeQuery(query, [parsedUserId]) as any[];

    if (users.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// PUT - Update user (Admin only)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const authCheck = await verifyAdminAccess(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    const { userId } = await context.params;
    const parsedUserId = parseInt(userId);
    if (isNaN(parsedUserId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid user ID'
      }, { status: 400 });
    }

    const body = await request.json();
    const { username, email, password, name, player_name, challonge_username, api_key, user_role } = body;

    if (!username || !email || !name || !user_role) {
      return NextResponse.json({
        success: false,
        error: 'Username, email, name, and role are required'
      }, { status: 400 });
    }

    // Check if user exists
    const userExists = await executeQuery(
      'SELECT user_id FROM users WHERE user_id = ?',
      [parsedUserId]
    ) as any[];
    
    if (userExists.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Check if username or email exists for other users
    const existingUser = await executeQuery(
      'SELECT user_id FROM users WHERE (username = ? OR email = ?) AND user_id != ?',
      [username, email, parsedUserId]
    ) as any[];
    
    if (existingUser.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Username or email already exists'
      }, { status: 400 });
    }

    // Build update query
    let updateQuery = `
      UPDATE users 
      SET username = ?, email = ?, name = ?, player_name = ?, challonge_username = ?, api_key = ?, user_role = ?
    `;
    let updateParams = [
      username, 
      email,
      name, 
      player_name || null, 
      challonge_username || null, 
      api_key || null, 
      user_role
    ];

    // Add password to update if provided
    if (password && password.trim() !== '') {
      updateQuery += ', password = ?';
      updateParams.push(password); // In production, use: await bcrypt.hash(password, 10)
    }

    updateQuery += ' WHERE user_id = ?';
    updateParams.push(parsedUserId);

    await executeQuery(updateQuery, updateParams);

    // Get the updated user
    const updatedUser = await executeQuery(
      'SELECT user_id, username, email, name, player_name, challonge_username, api_key, user_role, created_at FROM users WHERE user_id = ?',
      [parsedUserId]
    ) as any[];

    return NextResponse.json({
      success: true,
      user: updatedUser[0],
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

// DELETE - Delete user (Admin only)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const authCheck = await verifyAdminAccess(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    const { userId } = await context.params;
    const parsedUserId = parseInt(userId);
    if (isNaN(parsedUserId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid user ID'
      }, { status: 400 });
    }

    // Prevent admin from deleting themselves
    if (parsedUserId === authCheck.user.user_id) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete your own account'
      }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await executeQuery('SELECT user_id FROM users WHERE user_id = ?', [parsedUserId]) as any[];
    
    if (existingUser.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Delete user
    await executeQuery('DELETE FROM users WHERE user_id = ?', [parsedUserId]);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}