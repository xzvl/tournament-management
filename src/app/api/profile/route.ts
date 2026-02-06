import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
    
    // Verify user exists
    const query = 'SELECT user_id, username, user_role FROM users WHERE user_id = ?';
    const users = await executeQuery(query, [decoded.userId]) as any[];

    if (users.length === 0) {
      return { error: 'User not found', status: 401 };
    }

    return { user: users[0] };
  } catch (error) {
    return { error: 'Invalid token', status: 401 };
  }
}

// GET - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    const query = `
      SELECT user_id, username, email, name, player_name, 
             challonge_username, api_key, user_role, created_at
      FROM users 
      WHERE user_id = ?
    `;
    
    const users = await executeQuery(query, [authCheck.user.user_id]) as any[];

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
    console.error('Get profile error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// PUT - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    const body = await request.json();
    const { 
      name, 
      player_name, 
      challonge_username, 
      api_key,
      email,
      current_password,
      new_password 
    } = body;

    // If changing password, verify current password first
    if (new_password) {
      if (!current_password) {
        return NextResponse.json({
          success: false,
          error: 'Current password is required to change password'
        }, { status: 400 });
      }

      // Get current password hash
      const passwordQuery = 'SELECT password FROM users WHERE user_id = ?';
      const passwordResult = await executeQuery(passwordQuery, [authCheck.user.user_id]) as any[];
      
      if (passwordResult.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'User not found'
        }, { status: 404 });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(current_password, passwordResult[0].password);
      
      if (!isValidPassword) {
        return NextResponse.json({
          success: false,
          error: 'Current password is incorrect'
        }, { status: 400 });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(new_password, 12);

      // Update user with new password
      const updateQuery = `
        UPDATE users 
        SET name = ?, player_name = ?, challonge_username = ?, 
            api_key = ?, email = ?, password = ?, updated_at = NOW()
        WHERE user_id = ?
      `;
      
      await executeQuery(updateQuery, [
        name || null,
        player_name || null,
        challonge_username || null,
        api_key || null,
        email || null,
        hashedNewPassword,
        authCheck.user.user_id
      ]);

    } else {
      // Update user without changing password
      const updateQuery = `
        UPDATE users 
        SET name = ?, player_name = ?, challonge_username = ?, 
            api_key = ?, email = ?, updated_at = NOW()
        WHERE user_id = ?
      `;
      
      await executeQuery(updateQuery, [
        name || null,
        player_name || null,
        challonge_username || null,
        api_key || null,
        email || null,
        authCheck.user.user_id
      ]);
    }

    // Get updated user data
    const updatedUserQuery = `
      SELECT user_id, username, email, name, player_name, 
             challonge_username, api_key, user_role, created_at
      FROM users 
      WHERE user_id = ?
    `;
    
    const updatedUsers = await executeQuery(updatedUserQuery, [authCheck.user.user_id]) as any[];

    return NextResponse.json({
      success: true,
      user: updatedUsers[0],
      message: new_password ? 'Profile and password updated successfully' : 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}