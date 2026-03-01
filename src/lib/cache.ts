
/**
 * Cache utility for storing search results and AI responses.
 * Uses Upstash Redis if configured, otherwise falls back to a simple in-memory Map.
 */

const memoryCache = new Map<string, { value: any; expiresAt: number }>();

export const TTL = {
    SEARCH_RESULTS: 1800, // 30 mins
    QUERY_EXPANSION: 3600, // 1 hour
    INTENT_ANALYSIS: 3600, // 1 hour
};

// Simple cleanup for memory cache to prevent unlimited growth
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
        if (entry.expiresAt < now) {
            memoryCache.delete(key);
        }
    }
}, 60000 * 5); // Run every 5 mins

async function redisCommand<T>(command: Array<string | number>): Promise<T | null> {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) return null;

    try {
        const res = await fetch(`${url}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(command),
        });

        if (!res.ok) return null;

        const data = await res.json() as { result?: T; error?: string };
        if (data.error) return null;
        if (data.result === undefined) return null;
        return data.result;
    } catch (e) {
        console.warn('Redis Command Failed:', e);
        return null;
    }
}

async function redisGet(key: string): Promise<any | null> {
    const result = await redisCommand<string>(['GET', key]);
    if (!result) return null;

    try {
        return JSON.parse(result);
    } catch {
        return null;
    }
}

async function redisSet(key: string, value: any, ttlSeconds: number): Promise<void> {
    await redisCommand(['SETEX', key, ttlSeconds, JSON.stringify(value)]);
}

export async function cacheGet(key: string): Promise<any | null> {
    // Try Redis first
    const redisVal = await redisGet(key);
    if (redisVal !== null) return redisVal;

    // Fallback to Memory
    const entry = memoryCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
        return entry.value;
    }
    if (entry) {
        memoryCache.delete(key);
    }
    return null;
}

export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
    // Write to Redis (Fire & Forget)
    redisSet(key, value, ttlSeconds).catch(() => { });

    // Write to Memory
    memoryCache.set(key, {
        value,
        expiresAt: Date.now() + (ttlSeconds * 1000)
    });
}


// Common English stop words to strip from query cache keys
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'for', 'of', 'to', 'in',
    'is', 'it', 'on', 'at', 'by', 'as', 'with', 'how', 'what', 'why',
    'when', 'who', 'which', 'that', 'this', 'are', 'was', 'be', 'do',
    'tips', 'help', 'best', 'good', 'ways', 'get',
]);

/**
 * Normalises a query string for use as a cache key.
 * - Lowercases
 * - Strips punctuation & stop words
 * - Sorts remaining tokens so word-order doesn't matter
 * - Produces a stable, compact key
 *
 * "tips for content marketing" → "content:marketing"
 * "content marketing tips"     → "content:marketing"  (same key → cache hit!)
 */
function normaliseQuery(query: string): string {
    return query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')          // strip punctuation
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP_WORDS.has(w))
        .sort()                                // order-independent
        .join(':')
        .slice(0, 120);
}

export function makeCacheKey(namespace: string, ...parts: string[]): string {
    const normalisedParts = parts.map(p => normaliseQuery(p));
    return [namespace, ...normalisedParts]
        .filter(Boolean)
        .join(':')
        .slice(0, 200);
}

