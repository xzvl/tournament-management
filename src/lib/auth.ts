import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export interface AuthUser {
  user_id: number;
  username: string;
  email: string;
  role: string;
  community_id: number;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'No authorization token provided'
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }

    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: {
        user_id: true,
        username: true,
        email: true,
        user_role: true
      }
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const community = await prisma.community.findFirst({
      where: { to_id: String(user.user_id) },
      select: { community_id: true }
    });
    
    return {
      success: true,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.user_role,
        community_id: community?.community_id || 0
      }
    };

  } catch (error) {
    console.error('Auth verification error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

export function generateToken(userId: number): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = require('bcryptjs');
  return await bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(password, hashedPassword);
}