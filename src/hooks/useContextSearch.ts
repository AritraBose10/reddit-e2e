
import { useState, useCallback } from 'react';
import { RedditPost, SearchResponse } from '@/types';
import { searchRedditBrowser } from '@/lib/reddit';
import { useApiUsage } from '@/context/ApiUsageContext';
import { getStoredApiKey } from '@/components/ApiKeyManager';

interface ContextSearchState {
    isLoading: boolean;
    status: 'idle' | 'analyzing' | 'fetching' | 'filtering';
    data: SearchResponse | null;
    error: string | null;
}

export function useContextSearch() {
    const [state, setState] = useState<ContextSearchState>({
        isLoading: false,
        status: 'idle',
        data: null, // Now typed as SearchResponse | null
        error: null,
    });

    const { updateUsage } = useApiUsage();

    // Keep track of last params for refetch
    const [lastParams, setLastParams] = useState<{ query: string, sort: 'top' | 'hot', time: string } | null>(null);

    const search = useCallback(async (query: string, sort: 'top' | 'hot', time: string) => {
        setState(prev => ({ ...prev, isLoading: true, status: 'analyzing', error: null }));
        setLastParams({ query, sort, time });

        try {
            const apiKey = getStoredApiKey();
            // Cast headers to strict Record<string, string> to satisfy fetch types if needed
            const headers: Record<string, string> = apiKey ? { 'x-groq-api-key': apiKey } : {};

            // Step 1: Intent Analysis
            const intentRes = await fetch('/api/context/intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({ query }),
            });

            if (!intentRes.ok) throw new Error('Failed to analyze search intent');
            const { queries, rateLimit: rl1 } = await intentRes.json();

            // Update usage for intent analysis
            if (rl1) updateUsage({
                remaining: rl1.remaining,
                limit: rl1.limit,
                resetInSeconds: rl1.resetInSeconds
            });

            // Step 2: Distributed Fetching (Client-Side)
            setState(prev => ({ ...prev, status: 'fetching' }));

            // Run queries in parallel
            const nestedPosts = await Promise.all(
                queries.map((q: string) => searchRedditBrowser(q, sort, time))
            );

            // Flatten and deduplicate by ID
            const allPosts = nestedPosts.flat();
            const uniquePosts = Array.from(
                new Map(allPosts.map(p => [p.id, p])).values()
            );

            // Step 3: Semantic Filtering
            setState(prev => ({ ...prev, status: 'filtering' }));

            const filterRes = await fetch('/api/context/filter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({ posts: uniquePosts, query }),
            });

            if (!filterRes.ok) throw new Error('Failed to filter results');
            const { filteredPosts, rateLimit: rl2 } = await filterRes.json();

            // Update usage for semantic filtering
            if (rl2) updateUsage({
                remaining: rl2.remaining,
                limit: rl2.limit,
                resetInSeconds: rl2.resetInSeconds
            });

            setState({
                isLoading: false,
                status: 'idle',
                data: {
                    posts: filteredPosts,
                    totalResults: filteredPosts.length,
                    cached: false, // Context searches are always fresh for now
                    query: query,
                    sort: sort,
                    cacheAge: 0
                },
                error: null,
            });

        } catch (err) {
            console.error('Context search error:', err);
            setState({
                isLoading: false,
                status: 'idle',
                data: null,
                error: err instanceof Error ? err.message : 'Context search failed',
            });
        }
    }, [updateUsage]);

    const refetch = useCallback(() => {
        if (lastParams) {
            search(lastParams.query, lastParams.sort, lastParams.time);
        }
    }, [lastParams, search]);

    return { ...state, search, refetch };
}
