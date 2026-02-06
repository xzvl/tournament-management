import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET - List all users (Admin only)
export async function GET(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (!authCheck.success || !authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Only admin can view all users
    if (authCheck.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        user_id: true,
        username: true,
        email: true,
        name: true,
        player_name: true,
        challonge_username: true,
        api_key: true,
        user_role: true,
        created_at: true,
        updated_at: true
      },
      orderBy: { username: 'asc' }
    });

    return NextResponse.json({
      success: true,
      users: users
    });

  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Create new user (Admin only)
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { username, email, password, name, player_name, challonge_username, api_key, user_role } = body;

    if (!username || !email || !password || !name || !user_role) {
      return NextResponse.json({
        success: false,
        error: 'Username, email, password, name, and role are required'
      }, { status: 400 });
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }]
      },
      select: { user_id: true }
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'Username or email already exists'
      }, { status: 400 });
    }

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password,
        name,
        player_name: player_name || null,
        challonge_username: challonge_username || null,
        api_key: api_key || null,
        user_role
      },
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
      user: newUser,
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}