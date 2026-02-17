import OpenAI from 'openai';
import { ContentIdea, VideoScripts } from '@/types';
import {
    DEFAULT_IDEAS_PROMPT,
    DEFAULT_HOOKS_PROMPT,
    DEFAULT_SCRIPTS_PROMPT,
} from '@/lib/promptStore';

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

/**
 * Helper to extract JSON from AI response, handling markdown code blocks.
 */
function extractJSON(content: string): unknown | null {
    // Try direct parse first
    try {
        return JSON.parse(content);
    } catch {
        // noop — fall through to code-block extraction
    }

    // Try extracting from markdown code blocks (```json ... ``` or ``` ... ```)
    const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
        try {
            return JSON.parse(codeBlockMatch[1].trim());
        } catch {
            // noop
        }
    }

    // Try matching a JSON object { ... }
    const objMatch = content.match(/\{[\s\S]*\}/);
    if (objMatch) {
        try {
            return JSON.parse(objMatch[0]);
        } catch {
            // noop
        }
    }

    // Try matching a JSON array [ ... ]
    const arrMatch = content.match(/\[[\s\S]*\]/);
    if (arrMatch) {
        try {
            return JSON.parse(arrMatch[0]);
        } catch {
            // noop
        }
    }

    return null;
}

export async function generateContentIdeas(
    topic: string,
    discussions: string[],
    customPrompt?: string,
): Promise<ContentIdea[]> {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('Missing GROQ_API_KEY environment variable');
    }

    try {
        const template = customPrompt || DEFAULT_IDEAS_PROMPT;
        const prompt = template
            .replace('{{SUBREDDIT}}', topic)
            .replace('{{DISCUSSIONS}}', discussions.join('\n\n---\n\n').substring(0, 15000));

        const response = await openai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are a helpful content strategist assistant.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
        });

        const content = response.choices[0].message.content;
        if (!content) return [];

        const parsed = extractJSON(content);
        if (Array.isArray(parsed)) {
            return parsed as ContentIdea[];
        }
        return [];
    } catch (error) {
        console.error('Error generating content ideas:', error);
        throw new Error('Failed to generate ideas using AI.');
    }
}

export async function generateViralHooks(
    discussions: string[],
    customPrompt?: string,
): Promise<string[]> {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('Missing GROQ_API_KEY environment variable');
    }

    try {
        const template = customPrompt || DEFAULT_HOOKS_PROMPT;
        const prompt = template
            .replace('{{DISCUSSIONS}}', discussions.join('\n\n---\n\n').substring(0, 15000));

        const response = await openai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are an expert viral hook writer for short-form content.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.8,
        });

        const content = response.choices[0].message.content;
        if (!content) return [];

        const parsed = extractJSON(content);
        if (Array.isArray(parsed)) {
            return parsed.map((h: unknown) => String(h));
        }
        return [];
    } catch (error) {
        console.error('Error generating viral hooks:', error);
        throw new Error('Failed to generate viral hooks using AI.');
    }
}

export async function generateVideoScripts(
    hook: string,
    concept: string,
    customPrompt?: string,
): Promise<VideoScripts> {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('Missing GROQ_API_KEY environment variable');
    }

    try {
        const template = customPrompt || DEFAULT_SCRIPTS_PROMPT;
        const prompt = template
            .replace('{{HOOK}}', hook)
            .replace('{{CONCEPT}}', concept);

        const response = await openai.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are an expert short-form scriptwriter for viral video content.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.8,
        });

        const content = response.choices[0].message.content;
        if (!content) {
            return { variation1: '', variation2: '' };
        }

        const parsed = extractJSON(content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const obj = parsed as Record<string, string>;
            return {
                variation1: obj.variation1 || '',
                variation2: obj.variation2 || '',
            };
        }

        // Last resort: split raw text by variation headers
        const v1Match = content.match(/###?\s*Variation\s*1[^\n]*\n([\s\S]*?)(?=###?\s*Variation\s*2|$)/i);
        const v2Match = content.match(/###?\s*Variation\s*2[^\n]*\n([\s\S]*?)$/i);
        return {
            variation1: v1Match ? v1Match[1].trim() : content,
            variation2: v2Match ? v2Match[1].trim() : '',
        };
    } catch (error) {
        console.error('Error generating video scripts:', error);
        throw new Error('Failed to generate video scripts using AI.');
    }
}
