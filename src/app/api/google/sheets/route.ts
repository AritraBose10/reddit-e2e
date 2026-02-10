/**
 * Google Sheets Export API Route.
 * Creates a new Google Sheet with Reddit post data.
 * POST /api/google/sheets { posts: RedditPost[], keywords: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { decryptTokens, createSpreadsheet, refreshAccessToken, encryptTokens } from '@/lib/sheets';
import { RedditPost } from '@/types';

export async function POST(request: NextRequest) {
    try {
        // Check for Google tokens in cookie
        const tokenCookie = request.cookies.get('google_tokens')?.value;
        if (!tokenCookie) {
            return NextResponse.json(
                { error: 'Not authenticated with Google. Please connect your account in Settings.' },
                { status: 401 }
            );
        }

        // Decrypt tokens
        let tokens = decryptTokens(tokenCookie);
        if (!tokens) {
            return NextResponse.json(
                { error: 'Invalid authentication. Please reconnect your Google account.' },
                { status: 401 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { posts, keywords } = body as { posts: RedditPost[]; keywords: string };

        if (!posts || !Array.isArray(posts) || posts.length === 0) {
            return NextResponse.json(
                { error: 'No posts data provided for export.' },
                { status: 400 }
            );
        }

        if (!keywords) {
            return NextResponse.json(
                { error: 'Keywords are required for the spreadsheet title.' },
                { status: 400 }
            );
        }

        // Check if token is expired and refresh if needed
        if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
            try {
                tokens = await refreshAccessToken(tokens.refresh_token);
                // Update the cookie with refreshed tokens
            } catch {
                return NextResponse.json(
                    { error: 'Google session expired. Please reconnect your account in Settings.' },
                    { status: 401 }
                );
            }
        }

        // Create the spreadsheet
        const spreadsheetUrl = await createSpreadsheet(tokens, posts, keywords);

        // If tokens were refreshed, update the cookie
        const response = NextResponse.json({
            success: true,
            spreadsheetUrl,
        });

        // Re-encrypt and set updated tokens
        if (tokens.expiry_date && tokens.expiry_date > Date.now()) {
            const encrypted = encryptTokens(tokens);
            response.cookies.set('google_tokens', encrypted, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 30,
                path: '/',
            });
        }

        return response;
    } catch (error) {
        console.error('Google Sheets export error:', error);

        if (error instanceof Error && error.message.includes('quota')) {
            return NextResponse.json(
                { error: 'Google Sheets API quota exceeded. Try downloading as Excel instead.' },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create Google Sheet. Please try again or download as Excel.' },
            { status: 500 }
        );
    }
}
