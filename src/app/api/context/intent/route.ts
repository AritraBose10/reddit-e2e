
import { NextRequest, NextResponse } from 'next/server';
import { generateSearchQueries } from '@/lib/ai';

export async function POST(req: NextRequest) {
    try {
        const { query } = await req.json();

        // Use user's API key if provided in headers (via ApiKeyManager)
        const apiKey = req.headers.get('x-groq-api-key') || undefined;

        const { queries, rateLimit } = await generateSearchQueries(query, apiKey);

        return NextResponse.json({ queries, rateLimit });
    } catch (error) {
        console.error('Intent analysis failed:', error);
        return NextResponse.json(
            { error: 'Failed to analyze search intent.' },
            { status: 500 }
        );
    }
}
