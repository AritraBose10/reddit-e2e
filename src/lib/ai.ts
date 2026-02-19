import { ContentIdea, VideoScripts } from '@/types';
import {
    DEFAULT_IDEAS_PROMPT,
    DEFAULT_HOOKS_PROMPT,
    DEFAULT_SCRIPTS_PROMPT,
} from '@/lib/promptStore';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface RateLimitInfo {
    remaining: number;
    limit: number;
    resetInSeconds: number;
}

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

/**
 * Parse Groq duration strings like "2m52.8s", "190ms", "58s" into seconds.
 */
function parseDuration(dur: string): number {
    let totalSeconds = 0;
    const minMatch = dur.match(/(\d+(?:\.\d+)?)m(?!s)/);
    const secMatch = dur.match(/(\d+(?:\.\d+)?)s(?!.*m)/);
    const msMatch = dur.match(/(\d+(?:\.\d+)?)ms/);
    const secWithMin = dur.match(/(\d+(?:\.\d+)?)m(\d+(?:\.\d+)?)s/);

    if (secWithMin) {
        totalSeconds = parseFloat(secWithMin[1]) * 60 + parseFloat(secWithMin[2]);
    } else {
        if (minMatch) totalSeconds += parseFloat(minMatch[1]) * 60;
        if (secMatch) totalSeconds += parseFloat(secMatch[1]);
    }
    if (msMatch && !secMatch && !minMatch && !secWithMin) {
        totalSeconds += parseFloat(msMatch[1]) / 1000;
    }

    // Fallback: if nothing matched, try plain number
    if (totalSeconds === 0 && dur) {
        const plain = parseFloat(dur);
        if (!isNaN(plain)) totalSeconds = plain;
    }
    return totalSeconds || 60;
}

/**
 * Calls Groq API directly via fetch so we can capture rate limit headers.
 */
async function callGroq(
    messages: { role: string; content: string }[],
    temperature: number = 0.7,
    apiKeyOverride?: string,
): Promise<{ content: string; rateLimit: RateLimitInfo }> {
    const apiKey = apiKeyOverride || process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('Missing GROQ_API_KEY — add one in Settings or set GROQ_API_KEY env var');

    const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature,
        }),
    });

    // Extract rate limit headers
    const resetRaw = res.headers.get('x-ratelimit-reset-requests') || '60';
    const rateLimit: RateLimitInfo = {
        remaining: parseInt(res.headers.get('x-ratelimit-remaining-requests') || '0', 10),
        limit: parseInt(res.headers.get('x-ratelimit-limit-requests') || '30', 10),
        resetInSeconds: parseDuration(resetRaw),
    };

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Groq API error ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    return { content, rateLimit };
}

export async function generateContentIdeas(
    topic: string,
    discussions: string[],
    customPrompt?: string,
    apiKeyOverride?: string,
): Promise<{ ideas: ContentIdea[]; rateLimit: RateLimitInfo }> {
    const template = customPrompt || DEFAULT_IDEAS_PROMPT;
    const prompt = template
        .replace('{{SUBREDDIT}}', topic)
        .replace('{{DISCUSSIONS}}', discussions.join('\n\n---\n\n').substring(0, 15000));

    const { content, rateLimit } = await callGroq(
        [
            { role: 'system', content: 'You are a helpful content strategist assistant.' },
            { role: 'user', content: prompt },
        ],
        0.7,
        apiKeyOverride,
    );

    const parsed = extractJSON(content);
    const ideas = Array.isArray(parsed) ? (parsed as ContentIdea[]) : [];
    return { ideas, rateLimit };
}

export async function generateViralHooks(
    discussions: string[],
    customPrompt?: string,
    apiKeyOverride?: string,
): Promise<{ hooks: string[]; rateLimit: RateLimitInfo }> {
    const template = customPrompt || DEFAULT_HOOKS_PROMPT;
    const prompt = template
        .replace('{{DISCUSSIONS}}', discussions.join('\n\n---\n\n').substring(0, 15000));

    const { content, rateLimit } = await callGroq(
        [
            { role: 'system', content: 'You are an expert viral hook writer for short-form content.' },
            { role: 'user', content: prompt },
        ],
        0.8,
        apiKeyOverride,
    );

    const parsed = extractJSON(content);
    const hooks = Array.isArray(parsed) ? parsed.map((h: unknown) => String(h)) : [];
    return { hooks, rateLimit };
}

export async function generateVideoScripts(
    hook: string,
    concept: string,
    customPrompt?: string,
    apiKeyOverride?: string,
): Promise<{ scripts: VideoScripts; rateLimit: RateLimitInfo }> {
    const template = customPrompt || DEFAULT_SCRIPTS_PROMPT;
    const prompt = template
        .replace('{{HOOK}}', hook)
        .replace('{{CONCEPT}}', concept);

    const { content, rateLimit } = await callGroq(
        [
            { role: 'system', content: 'You are an expert short-form scriptwriter for viral video content.' },
            { role: 'user', content: prompt },
        ],
        0.8,
        apiKeyOverride,
    );

    const parsed = extractJSON(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, string>;
        return {
            scripts: { variation1: obj.variation1 || '', variation2: obj.variation2 || '' },
            rateLimit,
        };
    }

    // Last resort: split raw text by variation headers
    const v1Match = content.match(/###?\s*Variation\s*1[^\n]*\n([\s\S]*?)(?=###?\s*Variation\s*2|$)/i);
    const v2Match = content.match(/###?\s*Variation\s*2[^\n]*\n([\s\S]*?)$/i);
    return {
        scripts: {
            variation1: v1Match ? v1Match[1].trim() : content,
            variation2: v2Match ? v2Match[1].trim() : '',
        },
        rateLimit,
    };
}

/**
 * Context Mode: Step 1 - Intent Analysis
 * Generates 3 boolean search queries from a user's natural language input.
 */
export async function generateSearchQueries(
    userQuery: string,
    apiKeyOverride?: string
): Promise<{ queries: string[]; rateLimit: RateLimitInfo }> {
    const prompt = `
You are a Reddit Search Expert. Your goal is to translate a user's natural language query into 3 specific boolean search queries for Reddit's search engine.

User Query: "${userQuery}"

Rules:
1. Reddit supports boolean operators: AND, OR, NOT, ( ).
2. Field targeting: title:keyword, selftext:keyword, subreddit:name.
3. Generate exactly 3 queries:
   - Query 1 (Broad): Captures the core topic with OR synonyms.
   - Query 2 (Specific): Uses field targeting (title:) to find high-signal posts.
   - Query 3 (Problem-Solving): Targets specific subreddits or "how to" intent.

Return ONLY a JSON array of strings. No markdown, no explanations.
Example: ["(laptop OR computer) AND overheat", "title:overheating subreddit:techsupport", "selftext:temperature"]
`;

    const { content, rateLimit } = await callGroq(
        [
            { role: 'system', content: 'You are a Reddit Search Expert.' },
            { role: 'user', content: prompt },
        ],
        0.5, // Lower temperature for consistent formatting
        apiKeyOverride
    );

    const parsed = extractJSON(content);
    const queries = Array.isArray(parsed) ? (parsed as string[]) : [userQuery];
    return { queries: queries.slice(0, 3), rateLimit };
}

/**
 * Context Mode: Step 3 - Semantic Filtering
 * Scores posts from 0-10 based on relevance to the user's intent.
 */
export async function filterPostsByContext(
    posts: any[],
    userQuery: string,
    apiKeyOverride?: string
): Promise<{ filteredPosts: any[]; rateLimit: RateLimitInfo }> {
    // Optimization: Only send title and snippet to save tokens
    const simplifiedPosts = posts.map((p, index) => ({
        id: index, // Use index to map back
        title: p.title,
        subreddit: p.subreddit,
        snippet: p.selftext ? p.selftext.substring(0, 200) : '',
    }));

    const prompt = `
You are a Content Curator. I will give you a list of Reddit posts and a User Query.
Your job is to rate each post from 0-10 based on **Semantic Relevance** and **Utility** to the user.

User Query: "${userQuery}"

Scoring Guide:
- 0-3: Irrelevant, spam, or completely off-topic (e.g. meme when asking for help).
- 4-6: Tangentially related but not a direct answer.
- 7-10: Highly relevant, direct answer, or valuable discussion.

Posts:
${JSON.stringify(simplifiedPosts)}

Return ONLY a JSON object where keys are the post IDs (indices) and values are the scores.
Example: { "0": 2, "1": 9, "2": 5 }
`;

    const { content, rateLimit } = await callGroq(
        [
            { role: 'system', content: 'You are an accurate relevance scoring engine.' },
            { role: 'user', content: prompt },
        ],
        0.3, // Low introversion for strict scoring
        apiKeyOverride
    );

    const scores = extractJSON(content) as Record<string, number>;

    // Filter and sort posts
    if (!scores) return { filteredPosts: posts.slice(0, 20), rateLimit }; // Fallback

    const scoredPosts = posts.map((p, index) => ({
        ...p,
        relevanceScore: scores[String(index)] || 0,
    }));

    // Keep posts with score >= 6, sort by score desc
    const filtered = scoredPosts
        .filter((p) => p.relevanceScore >= 6)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return { filteredPosts: filtered, rateLimit };
}
