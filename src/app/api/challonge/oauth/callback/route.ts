import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

const CHALLONGE_OAUTH_TOKEN_URL = 'https://api.challonge.com/oauth/token';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

function redirectToSettings(request: NextRequest, query: string) {
	return NextResponse.redirect(new URL(`/backend/settings?${query}`, request.url));
}

export async function GET(request: NextRequest) {
	try {
		const url = new URL(request.url);
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		const oauthError = url.searchParams.get('error');

		if (oauthError) {
			return redirectToSettings(request, `oauth=error&message=${encodeURIComponent(oauthError)}`);
		}

		if (!code || !state) {
			return redirectToSettings(request, 'oauth=error&message=Missing code or state');
		}

		let decoded: any;
		try {
			decoded = jwt.verify(state, JWT_SECRET);
		} catch {
			return redirectToSettings(request, 'oauth=error&message=Invalid or expired OAuth state');
		}

		const userId = Number(decoded?.userId);
		if (!Number.isFinite(userId)) {
			return redirectToSettings(request, 'oauth=error&message=Invalid OAuth state payload');
		}

		const user = await prisma.user.findUnique({
			where: { user_id: userId },
			select: {
				user_id: true,
				challonge_client_id: true,
				challonge_client_secret: true,
				challonge_redirect_uri: true
			}
		});

		if (!user?.challonge_client_id || !user?.challonge_client_secret || !user?.challonge_redirect_uri) {
			return redirectToSettings(request, 'oauth=error&message=Missing Challonge OAuth credentials');
		}

		const tokenParams = new URLSearchParams({
			client_id: user.challonge_client_id,
			client_secret: user.challonge_client_secret,
			grant_type: 'authorization_code',
			code,
			redirect_uri: user.challonge_redirect_uri
		});

		const tokenResponse = await fetch(CHALLONGE_OAUTH_TOKEN_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json'
			},
			body: tokenParams.toString()
		});

		const tokenText = await tokenResponse.text();
		let tokenData: any;
		try {
			tokenData = JSON.parse(tokenText);
		} catch {
			tokenData = null;
		}

		if (!tokenResponse.ok || !tokenData?.access_token) {
			const errorMessage = tokenData?.error_description
				|| tokenData?.error
				|| `Token exchange failed (${tokenResponse.status})`;
			return redirectToSettings(request, `oauth=error&message=${encodeURIComponent(errorMessage)}`);
		}

		await prisma.user.update({
			where: { user_id: user.user_id },
			data: {
				challonge_access_token: tokenData.access_token
			}
		});

		return redirectToSettings(request, 'oauth=success');
	} catch (error) {
		console.error('OAuth callback error:', error);
		return redirectToSettings(request, 'oauth=error&message=OAuth callback failed');
	}
}
