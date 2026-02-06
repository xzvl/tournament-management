import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
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
    
    // Verify user exists and get their community
    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, username: true, user_role: true }
    });

    if (!user) {
      return { error: 'User not found', status: 401 };
    }

    const community = await prisma.community.findFirst({
      where: { to_id: String(user.user_id) },
      select: { community_id: true }
    });

    // For admin users, we don't require a community
    if (user.user_role !== 'admin' && !community?.community_id) {
      return { error: 'No community found. Please create a community first.', status: 400 };
    }

    return { 
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.user_role, // Map user_role to role for consistency
        user_role: user.user_role,
        community_id: community?.community_id ?? null
      }
    };
  } catch (error) {
    return { error: 'Invalid token', status: 401 };
  }
}

// GET - List all judges for user's community
export async function GET(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;

    // Admin can see all judges, others see only their community's judges
    const judgeRows = user.role === 'admin'
      ? await prisma.judge.findMany({
          select: {
            judge_id: true,
            username: true,
            judge_name: true,
            community_ids: true,
            created_at: true,
            updated_at: true
          },
          orderBy: { created_at: 'desc' }
        })
      : await prisma.judge.findMany({
          where: {
            community_ids: {
              array_contains: [user.community_id]
            }
          },
          select: {
            judge_id: true,
            username: true,
            judge_name: true,
            community_ids: true,
            created_at: true,
            updated_at: true
          },
          orderBy: { created_at: 'desc' }
        });

    const communityNames = await prisma.community.findMany({
      select: { community_id: true, name: true }
    });
    const communityNameMap = new Map(
      communityNames.map((community) => [community.community_id, community.name])
    );

    const judges = judgeRows.map((judge) => {
      const communityIds = Array.isArray(judge.community_ids) ? judge.community_ids : [];
      const names = communityIds
        .map((id) => communityNameMap.get(id as number))
        .filter(Boolean);

      return {
        ...judge,
        community_names: names.join(', ')
      };
    });

    return NextResponse.json({
      success: true,
      judges: judges
    });

  } catch (error) {
    console.error('Get judges error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

// POST - Create new judge
export async function POST(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;

    const body = await request.json();
    const { username, password, judge_name, community_ids } = body;

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: 'Username and password are required'
      }, { status: 400 });
    }

    // Determine which communities to assign
    let assignedCommunities;
    if (user.role === 'admin') {
      // Admin can assign any communities
      if (community_ids && Array.isArray(community_ids) && community_ids.length > 0) {
        assignedCommunities = JSON.stringify(community_ids);
      } else if (community_ids && typeof community_ids === 'string') {
        // Handle single community ID
        assignedCommunities = JSON.stringify([parseInt(community_ids)]);
      } else {
        return NextResponse.json({
          success: false,
          error: 'Admin must select at least one community'
        }, { status: 400 });
      }
    } else {
      // Non-admin can only assign their own community
      assignedCommunities = JSON.stringify([user.community_id]);
    }

    // Check if username already exists
    const existingJudge = await prisma.judge.findFirst({
      where: { username },
      select: { judge_id: true }
    });

    if (existingJudge) {
      return NextResponse.json({
        success: false,
        error: 'A judge with this username already exists'
      }, { status: 400 });
    }

    const createdJudge = await prisma.judge.create({
      data: {
        username,
        password,
        judge_name: judge_name || null,
        community_ids: JSON.parse(assignedCommunities)
      },
      select: {
        judge_id: true,
        username: true,
        judge_name: true,
        community_ids: true,
        created_at: true,
        updated_at: true
      }
    });

    const names = Array.isArray(createdJudge.community_ids)
      ? createdJudge.community_ids
          .map((id) => communityNameMap.get(id as number))
          .filter(Boolean)
      : [];

    const newJudge = {
      ...createdJudge,
      community_names: names.join(', ')
    };

    return NextResponse.json({
      success: true,
      judge: newJudge,
      message: 'Judge created successfully'
    });

  } catch (error) {
    console.error('Create judge error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

// PUT - Update existing judge
export async function PUT(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;

    const body = await request.json();
    const { judge_id, username, password, judge_name, community_ids } = body;

    if (!judge_id || !username) {
      return NextResponse.json({
        success: false,
        error: 'Judge ID and username are required'
      }, { status: 400 });
    }

    // Determine which communities to assign
    let assignedCommunities;
    if (user.role === 'admin' && community_ids) {
      // Admin can update any communities
      if (Array.isArray(community_ids) && community_ids.length > 0) {
        assignedCommunities = JSON.stringify(community_ids);
      } else if (typeof community_ids === 'string') {
        assignedCommunities = JSON.stringify([parseInt(community_ids)]);
      } else {
        return NextResponse.json({
          success: false,
          error: 'Invalid community selection'
        }, { status: 400 });
      }
    }

    // Check if judge exists and user has access
    const judgeIdNumber = Number(judge_id);
    const hasAccess = user.role === 'admin'
      ? await prisma.judge.findUnique({
          where: { judge_id: judgeIdNumber },
          select: { judge_id: true }
        })
      : await prisma.judge.findFirst({
          where: {
            judge_id: judgeIdNumber,
            community_ids: {
              array_contains: [user.community_id]
            }
          },
          select: { judge_id: true }
        });

    if (!hasAccess) {
      return NextResponse.json({
        success: false,
        error: 'Judge not found or access denied'
      }, { status: 404 });
    }

    // Check if username already exists for other judges
    const duplicateUsername = await prisma.judge.findFirst({
      where: {
        username,
        judge_id: { not: judgeIdNumber }
      },
      select: { judge_id: true }
    });

    if (duplicateUsername) {
      return NextResponse.json({
        success: false,
        error: 'A judge with this username already exists'
      }, { status: 400 });
    }

    const updateData: {
      username: string;
      judge_name: string | null;
      community_ids?: number[];
      password?: string;
    } = {
      username,
      judge_name: judge_name || null
    };

    if (user.role === 'admin' && assignedCommunities) {
      updateData.community_ids = JSON.parse(assignedCommunities);
    }

    if (password) {
      updateData.password = password;
    }

    const updatedJudge = await prisma.judge.update({
      where: { judge_id: judgeIdNumber },
      data: updateData,
      select: {
        judge_id: true,
        username: true,
        judge_name: true,
        community_ids: true,
        created_at: true,
        updated_at: true
      }
    });

    const updatedNames = Array.isArray(updatedJudge.community_ids)
      ? updatedJudge.community_ids
          .map((id) => communityNameMap.get(id as number))
          .filter(Boolean)
      : [];

    return NextResponse.json({
      success: true,
      judge: {
        ...updatedJudge,
        community_names: updatedNames.join(', ')
      },
      message: 'Judge updated successfully'
    });

  } catch (error) {
    console.error('Update judge error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

// DELETE - Remove judge
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = await verifyAuth(request);
    if (authCheck.error) {
      return NextResponse.json({
        success: false,
        error: authCheck.error
      }, { status: authCheck.status });
    }

    if (!authCheck.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const user = authCheck.user;

    const { searchParams } = new URL(request.url);
    const judge_id = searchParams.get('judge_id');

    if (!judge_id) {
      return NextResponse.json({
        success: false,
        error: 'Judge ID is required'
      }, { status: 400 });
    }

    // Check if judge exists and user has access
    const judgeIdNumber = Number(judge_id);
    const existingJudge = user.role === 'admin'
      ? await prisma.judge.findUnique({
          where: { judge_id: judgeIdNumber },
          select: { judge_id: true, community_ids: true }
        })
      : await prisma.judge.findFirst({
          where: {
            judge_id: judgeIdNumber,
            community_ids: {
              array_contains: [user.community_id]
            }
          },
          select: { judge_id: true, community_ids: true }
        });

    if (!existingJudge) {
      return NextResponse.json({
        success: false,
        error: 'Judge not found or access denied'
      }, { status: 404 });
    }

    // Admin can delete any judge completely, non-admin may just remove from community
    const judge = existingJudge;
    
    if (user.role === 'admin') {
      // Admin deletes the judge completely
      await prisma.judge.delete({
        where: { judge_id: judgeIdNumber }
      });
    } else {
      // Non-admin: handle community removal logic
      let communityIds: number[] = [];
      try {
        communityIds = Array.isArray(judge.community_ids)
          ? (judge.community_ids as number[])
          : [];
      } catch (e) {
        // Fallback for comma-separated format
        communityIds = [];
      }
      
      if (communityIds.length > 1) {
        // Remove this community from the list
        const updatedCommunityIds = communityIds.filter((id) => id !== user.community_id);
        
        await prisma.judge.update({
          where: { judge_id: judgeIdNumber },
          data: { community_ids: updatedCommunityIds }
        });
      } else {
        // Delete the judge completely if only belongs to this community
        await prisma.judge.delete({
          where: { judge_id: judgeIdNumber }
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Judge removed successfully'
    });

  } catch (error) {
    console.error('Delete judge error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}