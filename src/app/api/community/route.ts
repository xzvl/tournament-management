import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
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

    const user = authCheck.user;
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Find user's community by to_id = user_id
    const community = await prisma.community.findFirst({
      where: { to_id: String(user.user_id) },
      select: {
        community_id: true,
        name: true,
        short_name: true,
        logo: true,
        cover: true,
        location: true,
        province: true,
        city: true,
        to_id: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!community) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No community found'
      });
    }

    return NextResponse.json({
      success: true,
      data: community
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

    const user = authCheck.user;
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
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
    const userCommunity = await prisma.community.findFirst({
      where: { to_id: String(authCheck.user.user_id) },
      select: { community_id: true }
    });

    if (userCommunity) {
      return NextResponse.json({
        success: false,
        error: 'You already have a community. Please update it instead.'
      }, { status: 400 });
    }

    // Check if short_name already exists
    const existingCommunity = await prisma.community.findFirst({
      where: { short_name },
      select: { community_id: true }
    });

    if (existingCommunity) {
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
    const newCommunity = await prisma.community.create({
      data: {
        name,
        short_name,
        logo: logoUrl,
        cover: coverUrl,
        location,
        province,
        city,
        to_id: String(authCheck.user.user_id)
      },
      select: {
        community_id: true,
        name: true,
        short_name: true,
        logo: true,
        cover: true,
        location: true,
        province: true,
        city: true,
        to_id: true,
        created_at: true
      }
    });

    return NextResponse.json({
      success: true,
      community: newCommunity,
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

    const user = authCheck.user;
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }
    
    // Find user's community by to_id = user_id
    const existingCommunity = await prisma.community.findFirst({
      where: { to_id: String(user.user_id) },
      select: { community_id: true, logo: true, cover: true }
    });

    if (!existingCommunity) {
      return NextResponse.json({
        success: false,
        error: 'No community found to update. Please create one first.'
      }, { status: 404 });
    }

    const communityId = existingCommunity.community_id;

    // Check if short_name exists for other communities
    const duplicateCommunity = await prisma.community.findFirst({
      where: {
        short_name,
        community_id: { not: communityId }
      },
      select: { community_id: true }
    });

    if (duplicateCommunity) {
      return NextResponse.json({
        success: false,
        error: 'Short name already exists'
      }, { status: 400 });
    }

    // Handle file uploads
    let logoUrl = existingCommunity.logo; // Keep existing logo if no new file
    let coverUrl = existingCommunity.cover; // Keep existing cover if no new file

    if (logoFile && logoFile.size > 0) {
      logoUrl = await saveUploadedFile(logoFile, 'logo', user.user_id);
    }

    if (coverFile && coverFile.size > 0) {
      coverUrl = await saveUploadedFile(coverFile, 'cover', user.user_id);
    }

    // Update community
    const updatedCommunity = await prisma.community.update({
      where: { community_id: communityId },
      data: {
        name,
        short_name,
        logo: logoUrl,
        cover: coverUrl,
        location,
        province,
        city
      },
      select: {
        community_id: true,
        name: true,
        short_name: true,
        logo: true,
        cover: true,
        location: true,
        province: true,
        city: true,
        to_id: true,
        created_at: true
      }
    });

    return NextResponse.json({
      success: true,
      community: updatedCommunity,
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