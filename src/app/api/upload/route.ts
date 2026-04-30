import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

function verifyUploadToken(request: NextRequest): { success: boolean; userId?: number; error?: string } {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Authentication required' };
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';

  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId?: number | string };
    const userId = Number(decoded.userId);

    if (!Number.isFinite(userId) || userId <= 0) {
      return { success: false, error: 'Invalid token payload' };
    }

    return { success: true, userId };
  } catch {
    return { success: false, error: 'Invalid or expired token' };
  }
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = verifyUploadToken(request);
    if (!authCheck.success) {
      return NextResponse.json({
        success: false,
        error: authCheck.error || 'Authentication required'
      }, { status: 401 });
    }
    const userId = authCheck.userId as number;

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        error: 'File must be an image'
      }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'File size must be less than 5MB'
      }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = path.extname(file.name) || '.jpg';
    const filename = `tournament-${timestamp}-${random}${ext}`;

    // In production/serverless, prefer object storage over local filesystem.
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'tournaments';
      const objectPath = `uploads/tournaments/${userId}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectPath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Supabase upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      const imageUrl = publicUrlData.publicUrl;

      return NextResponse.json({
        success: true,
        imageUrl,
      });
    }

    if (process.env.VERCEL) {
      return NextResponse.json({
        success: false,
        error: 'Upload storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET in Vercel.'
      }, { status: 500 });
    }

    // Local development fallback: write to public/uploads.
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'tournaments');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, buffer);

    // Return the relative URL
    const imageUrl = `/uploads/tournaments/${filename}`;

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to upload image'
    }, { status: 500 });
  }
}
