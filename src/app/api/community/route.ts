import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database';
import jwt from 'jsonwebtoken';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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

// Helper function to save uploaded file
async function saveUploadedFile(file: File, type: 'logo' | 'cover', userId: number): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Create filename with timestamp to avoid conflicts
  const timestamp = Date.now();
  const extension = path.extname(file.name);
  const filename = `${type}_${userId}_${timestamp}${extension}`;
  const filepath = path.join(process.cwd(), 'public', 'uploads', 'communities', filename);

  // Ensure directory exists
  await mkdir(path.dirname(filepath), { recursive: true });

  // Write file
  await writeFile(filepath, buffer);

  // Return public URL
  return `/uploads/communities/${filename}`;
}

// GET - Get user's community
export async function GET(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    // Find user's community by to_id = user_id
    const communityQuery = `
      SELECT community_id, name, short_name, logo, cover, location, province, city, to_id, created_at, updated_at
      FROM communities
      WHERE to_id = ?
      LIMIT 1
    `;
    
    const communities = await executeQuery(communityQuery, [authCheck.user.user_id.toString()]) as any[];

    if (communities.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No community found'
      });
    }

    return NextResponse.json({
      success: true,
      data: communities[0]
    });

  } catch (error) {
    console.error('Get community error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Create new community for user
export async function POST(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const short_name = formData.get('short_name') as string;
    const location = formData.get('location') as string || null;
    const province = formData.get('province') as string || null;
    const city = formData.get('city') as string || null;
    const logoFile = formData.get('logo') as File | null;
    const coverFile = formData.get('cover') as File | null;

    if (!name || !short_name) {
      return NextResponse.json({
        success: false,
        error: 'Community name and short name are required'
      }, { status: 400 });
    }

    // Check if user already has a community
    const userCommunity = await executeQuery(
      'SELECT community_id FROM communities WHERE to_id = ?',
      [authCheck.user.user_id.toString()]
    ) as any[];
    
    if (userCommunity.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'You already have a community. Please update it instead.'
      }, { status: 400 });
    }

    // Check if short_name already exists
    const existingCommunity = await executeQuery(
      'SELECT community_id FROM communities WHERE short_name = ?',
      [short_name]
    ) as any[];
    
    if (existingCommunity.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Short name already exists'
      }, { status: 400 });
    }

    // Save uploaded files
    let logoUrl = null;
    let coverUrl = null;

    if (logoFile && logoFile.size > 0) {
      logoUrl = await saveUploadedFile(logoFile, 'logo', authCheck.user.user_id);
    }

    if (coverFile && coverFile.size > 0) {
      coverUrl = await saveUploadedFile(coverFile, 'cover', authCheck.user.user_id);
    }

    // Insert new community with to_id = user_id
    const insertQuery = `
      INSERT INTO communities (name, short_name, logo, cover, location, province, city, to_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      name,
      short_name,
      logoUrl,
      coverUrl,
      location,
      province,
      city,
      authCheck.user.user_id.toString() // Automatically link to user
    ]) as any;

    // Get the created community
    const newCommunity = await executeQuery(
      'SELECT community_id, name, short_name, logo, cover, location, province, city, to_id, created_at FROM communities WHERE community_id = ?',
      [result.insertId]
    ) as any[];

    return NextResponse.json({
      success: true,
      community: newCommunity[0],
      message: 'Community created successfully'
    });

  } catch (error) {
    console.error('Create community error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

// PUT - Update user's community
export async function PUT(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const short_name = formData.get('short_name') as string;
    const location = formData.get('location') as string || null;
    const province = formData.get('province') as string || null;
    const city = formData.get('city') as string || null;
    const logoFile = formData.get('logo') as File | null;
    const coverFile = formData.get('cover') as File | null;

    if (!name || !short_name) {
      return NextResponse.json({
        success: false,
        error: 'Community name and short name are required'
      }, { status: 400 });
    }

    // Find user's community by to_id = user_id
    const communityQuery = `
      SELECT community_id, logo, cover FROM communities 
      WHERE to_id = ?
      LIMIT 1
    `;
    
    const communities = await executeQuery(communityQuery, [authCheck.user.user_id.toString()]) as any[];

    if (communities.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No community found to update. Please create one first.'
      }, { status: 404 });
    }

    const communityId = communities[0].community_id;
    const existingCommunity = communities[0];

    // Check if short_name exists for other communities
    const duplicateCommunity = await executeQuery(
      'SELECT community_id FROM communities WHERE short_name = ? AND community_id != ?',
      [short_name, communityId]
    ) as any[];
    
    if (duplicateCommunity.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Short name already exists'
      }, { status: 400 });
    }

    // Handle file uploads
    let logoUrl = existingCommunity.logo; // Keep existing logo if no new file
    let coverUrl = existingCommunity.cover; // Keep existing cover if no new file

    if (logoFile && logoFile.size > 0) {
      logoUrl = await saveUploadedFile(logoFile, 'logo', authCheck.user.user_id);
    }

    if (coverFile && coverFile.size > 0) {
      coverUrl = await saveUploadedFile(coverFile, 'cover', authCheck.user.user_id);
    }

    // Update community
    const updateQuery = `
      UPDATE communities 
      SET name = ?, short_name = ?, logo = ?, cover = ?, location = ?, province = ?, city = ?
      WHERE community_id = ?
    `;
    
    await executeQuery(updateQuery, [
      name,
      short_name,
      logoUrl,
      coverUrl,
      location,
      province,
      city,
      communityId
    ]);

    // Get the updated community
    const updatedCommunity = await executeQuery(
      'SELECT community_id, name, short_name, logo, cover, location, province, city, to_id, created_at FROM communities WHERE community_id = ?',
      [communityId]
    ) as any[];

    return NextResponse.json({
      success: true,
      community: updatedCommunity[0],
      message: 'Community updated successfully'
    });

  } catch (error) {
    console.error('Update community error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}