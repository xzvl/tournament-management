import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

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
      
      const user = await prisma.user.findUnique({
        where: { user_id: decoded.userId },
        select: {
          user_id: true,
          username: true,
          name: true,
          user_role: true
        }
      });

      if (!user) {
        return NextResponse.json({
          success: false,
          error: 'User not found'
        }, { status: 401 });
      }

      const community = await prisma.community.findFirst({
        where: { to_id: String(user.user_id) },
        select: { community_id: true }
      });

      return NextResponse.json({
        success: true,
        user: {
          user_id: user.user_id,
          username: user.username,
          name: user.name,
          role: user.user_role,
          user_role: user.user_role,
          community_id: community?.community_id ?? null
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