import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { executeQuery } from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

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

    // Get user from database with community information
    const query = `
      SELECT u.user_id, u.username, u.email, u.user_role as role, c.community_id
      FROM users u
      LEFT JOIN communities c ON u.user_id = c.to_id
      WHERE u.user_id = ?
    `;
    
    const users = await executeQuery(query, [decoded.userId]) as any[];
    
    if (users.length === 0) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const user = users[0];
    
    return {
      success: true,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        community_id: user.community_id || null
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