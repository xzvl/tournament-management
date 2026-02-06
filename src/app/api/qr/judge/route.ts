import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

type JudgePayload = {
  judge_id?: number;
  username?: string;
  name?: string;
};

type Body = {
  judge?: JudgePayload;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const judgeId = body.judge?.judge_id;
    const username = body.judge?.username?.trim();

    if (!judgeId || !username) {
      return NextResponse.json(
        { success: false, error: 'Judge info are required.' },
        { status: 400 }
      );
    }

    const judge = await prisma.judge.findFirst({
      where: { judge_id: judgeId, username },
      select: { judge_id: true, username: true, password: true }
    });

    if (!judge) {
      return NextResponse.json(
        { success: false, error: 'Judge not found.' },
        { status: 404 }
      );
    }
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';
    const token = jwt.sign(
      {
        type: 'judge-login',
        judge_id: judgeId,
        username
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    const payload = JSON.stringify({
      type: 'judge-login',
      token
    });

    const dataUrl = await QRCode.toDataURL(payload, {
      width: 256,
      margin: 1
    });

    return NextResponse.json({ success: true, dataUrl, token, password: judge.password });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate QR code.' },
      { status: 500 }
    );
  }
}
