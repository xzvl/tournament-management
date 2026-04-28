import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { verifyAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const CHALLONGE_OAUTH_AUTHORIZE_URL = 'https://api.challonge.com/oauth/authorize';
const OAUTH_SCOPES = [
	'me',
	'tournaments:read',
	'tournaments:write',
	'matches:read',
	'matches:write',
	'attachments:read',
	'attachments:write',
	'participants:read',
	'participants:write',
	'communities:manage',
	'application:organizer',
	'application:player'
].join(' ');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export async function POST(request: NextRequest) {
	try {
		const authCheck = await verifyAuth(request);
		if (!authCheck.success || !authCheck.user) {
			return NextResponse.json({
				success: false,
				error: authCheck.error || 'Authentication required'
			}, { status: 401 });
		}

		const body = await request.json();
		const clientId = String(body?.challonge_client_id ?? '').trim();
		const clientSecret = String(body?.challonge_client_secret ?? '').trim();
		const redirectUri = String(body?.challonge_redirect_uri ?? '').trim();

		if (!clientId || !clientSecret || !redirectUri) {
			return NextResponse.json({
				success: false,
				error: 'Client ID, Client Secret, and Redirect URI are required'
			}, { status: 400 });
		}

		await prisma.user.update({
			where: { user_id: authCheck.user.user_id },
			data: {
				challonge_client_id: clientId,
				challonge_client_secret: clientSecret,
				challonge_redirect_uri: redirectUri
			}
		});

		const state = jwt.sign({
			userId: authCheck.user.user_id,
			type: 'challonge_oauth'
		}, JWT_SECRET, { expiresIn: '15m' });

		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: OAUTH_SCOPES,
			state
		});

		return NextResponse.json({
			success: true,
			authorizeUrl: `${CHALLONGE_OAUTH_AUTHORIZE_URL}?${params.toString()}`
		});
	} catch (error) {
		console.error('OAuth start error:', error);
		return NextResponse.json({
			success: false,
			error: 'Failed to start OAuth flow'
		}, { status: 500 });
	}
}
