import { NextRequest, NextResponse } from 'next/server';
import { generateVideoScripts } from '@/lib/ai';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { hook, concept, scriptsPrompt } = body;

        if (!hook || !concept) {
            return NextResponse.json(
                { error: 'Missing hook or concept in request body.' },
                { status: 400 }
            );
        }

        const scripts = await generateVideoScripts(hook, concept, scriptsPrompt || undefined);

        return NextResponse.json(scripts);
    } catch (error) {
        console.error('Error in generate-scripts route:', error);
        return NextResponse.json(
            { error: 'Failed to generate video scripts.' },
            { status: 500 }
        );
    }
}
