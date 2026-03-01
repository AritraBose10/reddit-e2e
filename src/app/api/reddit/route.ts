
import { rateLimiter } from '@/lib/rate-limiter';
import { searchReddit } from '@/lib/reddit';
import { SearchResponse } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Parse query params
        const { searchParams } = new URL(request.url);
        const keywords = searchParams.get('keywords')?.trim();
        const sort = searchParams.get('sort') as 'top' | 'hot' | 'relevance' | null;
        const time = searchParams.get('time') || 'all';
        const limitParam = searchParams.get('limit') || '100';

        let limit = parseInt(limitParam, 10);
        // Validate limit is between 1 and 100
        if (isNaN(limit) || limit < 1 || limit > 100) {
            limit = 100;
        }

        // Validate inputs
        if (!keywords || keywords.length === 0) {
            return NextResponse.json(
                { error: 'Keywords parameter is required' },
                { status: 400 }
            );
        }

        if (keywords.length > 200) {
            return NextResponse.json(
                { error: 'Keywords must be less than 200 characters' },
                { status: 400 }
            );
        }

        const validTimeRanges = ['hour', 'day', 'week', 'month', 'year', 'all', '15d'];
        if (!validTimeRanges.includes(time)) {
            return NextResponse.json(
                { error: 'Invalid time parameter' },
                { status: 400 }
            );
        }

        const sortType = sort === 'hot' ? 'hot' : sort === 'relevance' ? 'relevance' : 'top'; // Default to 'top'

        // Check rate limit
        const forwardedFor = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const firstForwardedIp = forwardedFor?.split(',')[0]?.trim();
        const userAgent = request.headers.get('user-agent') || 'unknown-ua';
        const ip = firstForwardedIp || realIp || `anonymous:${userAgent}`;
        const rateCheck = rateLimiter.check(ip);

        if (!rateCheck.allowed) {
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded. Please wait before searching again.',
                    retryAfter: rateCheck.retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateCheck.retryAfter || 2000) / 1000)),
                    },
                }
            );
        }

        // Fetch from Reddit
        const posts = await searchReddit(keywords, limit, sortType, time);

        const response: SearchResponse = {
            posts,
            cached: false,
            query: keywords,
            sort: sortType,
            totalResults: posts.length,
        };        

        return NextResponse.json(response);
    } catch (error) {
        console.error('Reddit API error:', error);

        // Handle specific error types
        if (error instanceof Error) {
            const lowerMessage = error.message.toLowerCase();
            if (lowerMessage.includes('429') || lowerMessage.includes('too many')) {
                return NextResponse.json(
                    { error: 'Reddit is rate limiting us. Please try again in a few seconds.' },
                    { status: 429 }
                );
            }
            if (lowerMessage.includes('timeout') || lowerMessage.includes('econnaborted') || lowerMessage.includes('aborted')) {
                return NextResponse.json(
                    { error: 'Reddit is taking too long to respond. Please try again.' },
                    { status: 504 }
                );
            }
            if (lowerMessage.includes('server error') || lowerMessage.includes('502') || lowerMessage.includes('503')) {
                return NextResponse.json(
                    { error: 'Reddit is temporarily unavailable. Please retry shortly.' },
                    { status: 502 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Failed to fetch Reddit data. Please try again later.', detail: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
