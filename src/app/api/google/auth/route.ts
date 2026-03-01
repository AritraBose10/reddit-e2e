/**
 * Google OAuth initiation route.
 * GET /api/google/auth — Redirects user to Google consent screen.
 */

import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/sheets';

export async function GET() {
    try {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.NEXTAUTH_SECRET) {
            return NextResponse.json(
                { error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and NEXTAUTH_SECRET.' },
                { status: 503 }
            );
        }

        const { url, state } = getAuthUrl();
        const response = NextResponse.redirect(url);
        response.cookies.set('google_oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 10, // 10 mins
            path: '/',
        });
        return response;
    } catch (error) {
        console.error('Google Auth error:', error);
        return NextResponse.json(
            { error: 'Failed to initiate Google authentication.' },
            { status: 500 }
        );
    }
}
