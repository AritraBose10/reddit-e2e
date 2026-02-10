/**
 * In-memory cache with TTL for Reddit search results.
 * Key format: "{query}-{sort}" → cached response with timestamp.
 * Default TTL: 5 minutes.
 */

import { SearchResponse } from '@/types';

interface CacheEntry {
    data: SearchResponse;
    timestamp: number;
}

class SearchCache {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly ttlMs: number;

    constructor(ttlMs = 5 * 60 * 1000) {
        this.ttlMs = ttlMs;

        // Clean up expired entries every 60 seconds
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Generate a cache key from search params.
     */
    private key(query: string, sort: string): string {
        return `${query.toLowerCase().trim()}-${sort}`;
    }

    /**
     * Get a cached response if it exists and hasn't expired.
     * Returns the response with cache metadata, or null.
     */
    get(query: string, sort: string): SearchResponse | null {
        const k = this.key(query, sort);
        const entry = this.cache.get(k);

        if (!entry) return null;

        const age = Date.now() - entry.timestamp;
        if (age > this.ttlMs) {
            this.cache.delete(k);
            return null;
        }

        // Return cached data with cache metadata
        return {
            ...entry.data,
            cached: true,
            cacheAge: Math.floor(age / 1000),
        };
    }

    /**
     * Store a response in the cache.
     */
    set(query: string, sort: string, data: SearchResponse): void {
        const k = this.key(query, sort);
        this.cache.set(k, {
            data: { ...data, cached: false, cacheAge: 0 },
            timestamp: Date.now(),
        });
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttlMs) {
                this.cache.delete(key);
            }
        }
    }
}

// Singleton cache instance
export const searchCache = new SearchCache();
