/**
 * Google Auth Status API Route.
 * GET  /api/google/status - Check if user is authenticated
 * DELETE /api/google/status - Disconnect Google account (clear cookie)
 */

import { NextRequest, NextResponse } from 'next/server';
import { decryptTokens } from '@/lib/sheets';

export async function GET(request: NextRequest) {
    try {
        const tokenCookie = request.cookies.get('google_tokens')?.value;

        if (!tokenCookie) {
            return NextResponse.json({ authenticated: false });
        }

        const tokens = decryptTokens(tokenCookie);
        if (!tokens) {
            return NextResponse.json({ authenticated: false });
        }

        return NextResponse.json({
            authenticated: true,
            email: tokens.email || 'Connected',
        });
    } catch {
        return NextResponse.json({ authenticated: false });
    }
}

export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('google_tokens');
    return response;
}
