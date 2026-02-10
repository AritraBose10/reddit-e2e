/**
 * Google OAuth initiation route.
 * GET /api/google/auth — Redirects user to Google consent screen.
 */

import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/sheets';

export async function GET() {
    try {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return NextResponse.json(
                { error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' },
                { status: 503 }
            );
        }

        const authUrl = getAuthUrl();
        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error('Google Auth error:', error);
        return NextResponse.json(
            { error: 'Failed to initiate Google authentication.' },
            { status: 500 }
        );
    }
}
