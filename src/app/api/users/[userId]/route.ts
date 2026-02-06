import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import prisma from '@/lib/prisma';

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
    const admin = await prisma.user.findFirst({
      where: {
        user_id: decoded.userId,
        user_role: 'admin'
      },
      select: { user_id: true, username: true, user_role: true }
    });

    if (!admin) {
      return { error: 'Admin access required', status: 403 };
    }

    return { user: admin };
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

    const user = await prisma.user.findUnique({
      where: { user_id: parsedUserId },
      select: {
        user_id: true,
        username: true,
        name: true,
        email: true,
        api_key: true,
        challonge_username: true
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
    const userExists = await prisma.user.findUnique({
      where: { user_id: parsedUserId },
      select: { user_id: true }
    });

    if (!userExists) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Check if username or email exists for other users
    const existingUser = await prisma.user.findFirst({
      where: {
        AND: [
          { user_id: { not: parsedUserId } },
          { OR: [{ username }, { email }] }
        ]
      },
      select: { user_id: true }
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'Username or email already exists'
      }, { status: 400 });
    }

    const updateData: {
      username: string;
      email: string;
      name: string;
      player_name: string | null;
      challonge_username: string | null;
      api_key: string | null;
      user_role: UserRole;
      password?: string;
    } = {
      username,
      email,
      name,
      player_name: player_name || null,
      challonge_username: challonge_username || null,
      api_key: api_key || null,
      user_role: user_role as UserRole
    };

    if (password && password.trim() !== '') {
      updateData.password = password;
    }

    const updatedUser = await prisma.user.update({
      where: { user_id: parsedUserId },
      data: updateData,
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
    const existingUser = await prisma.user.findUnique({
      where: { user_id: parsedUserId },
      select: { user_id: true }
    });

    if (!existingUser) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Delete user
    await prisma.user.delete({ where: { user_id: parsedUserId } });

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