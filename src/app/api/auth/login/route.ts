import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    console.log('Login attempt for username:', username);

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: 'Username and password are required'
      }, { status: 400 });
    }

    // Test database connection first
    try {
      await executeQuery('SELECT 1 as test');
      console.log('Database connection successful');
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Database connection failed'
      }, { status: 500 });
    }

    // Query user from database
    const query = 'SELECT user_id, username, password, name, user_role FROM users WHERE username = ? AND user_role IN ("admin", "tournament_organizer")';
    console.log('Executing query with username:', username);
    
    const users = await executeQuery(query, [username]) as any[];
    console.log('Query returned', users.length, 'users');

    if (users.length === 0) {
      console.log('No user found with username:', username);
      return NextResponse.json({
        success: false,
        error: 'Invalid credentials'
      }, { status: 401 });
    }

    const user = users[0];
    console.log('Found user:', { id: user.user_id, username: user.username, role: user.user_role });

    // Password verification
    let isValidPassword = false;
    
    // For development/demo accounts - check actual database usernames
    if ((username === 'xzvl' && password === 'admin123') || 
        (username === 'bm_joyboy' && password === 'org123') ||
        (username === 'dcb_aniel' && password === 'org123') ||
        (username === 'wlf_dm' && password === 'org123') ||
        (username === 'fb_sage' && password === 'org123')) {
      console.log('Using demo password for:', username);
      isValidPassword = true;
    } else {
      // For actual hashed passwords or plain text from database
      try {
        if (user.password && user.password.startsWith('$2')) {
          // It's a bcrypt hash
          isValidPassword = await bcrypt.compare(password, user.password);
          console.log('Bcrypt comparison result:', isValidPassword);
        } else {
          // Plain text password from database
          isValidPassword = password === user.password;
          console.log('Plain text comparison result:', isValidPassword, 'Expected:', user.password, 'Got:', password);
        }
      } catch (error) {
        console.error('Password comparison error:', error);
        return NextResponse.json({
          success: false,
          error: 'Authentication error'
        }, { status: 500 });
      }
    }

    if (!isValidPassword) {
      console.log('Invalid password for user:', username);
      return NextResponse.json({
        success: false,
        error: 'Invalid credentials'
      }, { status: 401 });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';
    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.user_role
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', username);
    return NextResponse.json({
      success: true,
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        name: user.name,
        user_role: user.user_role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}