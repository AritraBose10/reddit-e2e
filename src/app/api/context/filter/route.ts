
import { NextRequest, NextResponse } from 'next/server';
import { filterPostsByContext } from '@/lib/ai';

export async function POST(req: NextRequest) {
    try {
        const { posts, query } = await req.json();

        // Use user's API key if provided
        const apiKey = req.headers.get('x-groq-api-key') || undefined;

        const { filteredPosts, rateLimit } = await filterPostsByContext(posts, query, apiKey);

        return NextResponse.json({ filteredPosts, rateLimit });
    } catch (error) {
        console.error('Semantic filtering failed:', error);
        return NextResponse.json(
            { error: 'Failed to filter posts.' },
            { status: 500 }
        );
    }
}
