import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
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

    const query = `
      SELECT user_id, username, email, name, player_name, challonge_username, 
             api_key, user_role, created_at, updated_at 
      FROM users 
      ORDER BY username ASC
    `;
    
    const users = await executeQuery(query, []) as any[];

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
    const existingUser = await executeQuery(
      'SELECT user_id FROM users WHERE username = ? OR email = ?', 
      [username, email]
    ) as any[];
    
    if (existingUser.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Username or email already exists'
      }, { status: 400 });
    }

    // Insert new user (storing plain text password for demo - use bcrypt in production)
    const insertQuery = `
      INSERT INTO users (username, email, password, name, player_name, challonge_username, api_key, user_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      username,
      email,
      password, // In production, use: await bcrypt.hash(password, 10)
      name,
      player_name || null,
      challonge_username || null,
      api_key || null,
      user_role
    ]) as any;

    // Get the created user
    const newUser = await executeQuery(
      'SELECT user_id, username, email, name, player_name, challonge_username, api_key, user_role, created_at FROM users WHERE user_id = ?',
      [result.insertId]
    ) as any[];

    return NextResponse.json({
      success: true,
      user: newUser[0],
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