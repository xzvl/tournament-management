import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

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
    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, username: true, user_role: true }
    });

    if (!user) {
      return { error: 'User not found', status: 401 };
    }

    return { user };
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

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { user_id: authCheck.user.user_id },
      select: {
        user_id: true,
        username: true,
        email: true,
        name: true,
        player_name: true,
        challonge_username: true,
        api_key: true,
        user_role: true,
        created_at: true
      }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user
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

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
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
      const passwordResult = await prisma.user.findUnique({
        where: { user_id: authCheck.user.user_id },
        select: { password: true }
      });

      if (!passwordResult) {
        return NextResponse.json({
          success: false,
          error: 'User not found'
        }, { status: 404 });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(current_password, passwordResult.password);
      
      if (!isValidPassword) {
        return NextResponse.json({
          success: false,
          error: 'Current password is incorrect'
        }, { status: 400 });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(new_password, 12);

      // Update user with new password
      await prisma.user.update({
        where: { user_id: authCheck.user.user_id },
        data: {
          name: name || null,
          player_name: player_name || null,
          challonge_username: challonge_username || null,
          api_key: api_key || null,
          email: email || null,
          password: hashedNewPassword
        }
      });

    } else {
      // Update user without changing password
      await prisma.user.update({
        where: { user_id: authCheck.user.user_id },
        data: {
          name: name || null,
          player_name: player_name || null,
          challonge_username: challonge_username || null,
          api_key: api_key || null,
          email: email || null
        }
      });
    }

    // Get updated user data
    const updatedUser = await prisma.user.findUnique({
      where: { user_id: authCheck.user.user_id },
      select: {
        user_id: true,
        username: true,
        email: true,
        name: true,
        player_name: true,
        challonge_username: true,
        api_key: true,
        user_role: true,
        created_at: true
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
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