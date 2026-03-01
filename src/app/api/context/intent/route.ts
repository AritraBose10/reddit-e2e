
import { NextRequest, NextResponse } from 'next/server';
import { generateSearchQueries } from '@/lib/ai';
import { cacheGet, cacheSet, makeCacheKey, TTL } from '@/lib/cache';

export async function POST(req: NextRequest) {
    try {
        const { query } = await req.json();

        // 1. Validate Input
        let cleanQuery = (query || '').trim().slice(0, 200);
        cleanQuery = cleanQuery.replace(/[<>"]/g, ''); // Basic XSS prevention

        if (cleanQuery.length < 2) {
            return NextResponse.json({ error: 'Query too short' }, { status: 400 });
        }

        // 2. Check Cache
        const cacheKey = makeCacheKey('intent', cleanQuery);
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        // 3. Generate
        const apiKey = req.headers.get('x-groq-api-key') || undefined;
        const result = await generateSearchQueries(cleanQuery, apiKey);

        // 4. Cache Result
        await cacheSet(cacheKey, result, TTL.INTENT_ANALYSIS);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Intent API Error:', error);

        const msg = (error.message || '').toLowerCase();
        if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('aborted')) {
            return NextResponse.json(
                { error: 'Intent analysis timed out. Please try again.' },
                { status: 504 }
            );
        }
        if (msg.includes('429') || msg.includes('rate limit')) {
            return NextResponse.json(
                { error: 'AI rate limit reached. Please wait and retry.' },
                { status: 429 }
            );
        }
        if (msg.includes('upstream 5') || msg.includes('server error') || msg.includes('502') || msg.includes('503')) {
            return NextResponse.json(
                { error: 'Intent provider is temporarily unavailable. Please retry shortly.' },
                { status: 502 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to analyze intent', details: error.message || '' },
            { status: 500 }
        );
    }
}
