/**
 * Google OAuth callback route.
 * Exchanges authorization code for tokens and stores them in an encrypted httpOnly cookie.
 * GET /api/google/auth/callback?code=...&state=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, encryptTokens } from '@/lib/sheets';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
            // User denied access or other OAuth error
            const redirectUrl = new URL('/settings', request.url);
            redirectUrl.searchParams.set('error', 'Google authentication was cancelled.');
            return NextResponse.redirect(redirectUrl);
        }

        if (!code) {
            const redirectUrl = new URL('/settings', request.url);
            redirectUrl.searchParams.set('error', 'No authorization code received.');
            return NextResponse.redirect(redirectUrl);
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code);

        // Encrypt and store tokens in httpOnly cookie
        const encrypted = encryptTokens(tokens);

        const redirectUrl = new URL('/settings', request.url);
        redirectUrl.searchParams.set('success', 'Google account connected successfully!');

        const response = NextResponse.redirect(redirectUrl);
        response.cookies.set('google_tokens', encrypted, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Google OAuth callback error:', error);
        const redirectUrl = new URL('/settings', request.url);
        redirectUrl.searchParams.set('error', 'Failed to connect Google account. Please try again.');
        return NextResponse.redirect(redirectUrl);
    }
}
