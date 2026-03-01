import { NextRequest, NextResponse } from 'next/server';
import { generateVideoScripts } from '@/lib/ai';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { hook, concept, scriptsPrompt } = body;
        const apiKeyOverride = request.headers.get('x-groq-api-key') || undefined;

        if (!hook || !concept) {
            return NextResponse.json(
                { error: 'Missing hook or concept in request body.' },
                { status: 400 }
            );
        }

        const { scripts, rateLimit } = await generateVideoScripts(hook, concept, scriptsPrompt?.trim() ? scriptsPrompt : undefined, apiKeyOverride);

        return NextResponse.json({ ...scripts, rateLimit });
    } catch (error) {
        console.error('Error in generate-scripts route:', error);
        const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        if (msg.includes('429') || msg.includes('rate limit')) {
            return NextResponse.json(
                { error: 'AI rate limit reached. Please wait and retry.' },
                { status: 429 }
            );
        }
        if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
            return NextResponse.json(
                { error: 'Script generation timed out. Please retry.' },
                { status: 504 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to generate video scripts.' },
            { status: 500 }
        );
    }
}
