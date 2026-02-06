import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { executeQuery } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'No token provided'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';

    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      // Verify user still exists in database and get community info
      const query = `
        SELECT u.user_id, u.username, u.name, u.user_role, c.community_id 
        FROM users u
        LEFT JOIN communities c ON u.user_id = c.to_id
        WHERE u.user_id = ?
      `;
      const users = await executeQuery(query, [decoded.userId]) as any[];

      if (users.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'User not found'
        }, { status: 401 });
      }

      const user = users[0];

      return NextResponse.json({
        success: true,
        user: {
          user_id: user.user_id,
          username: user.username,
          name: user.name,
          role: user.user_role,
          user_role: user.user_role,
          community_id: user.community_id
        }
      });

    } catch (jwtError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token'
      }, { status: 401 });
    }

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}