
import { getStoredApiKey } from '@/components/ApiKeyManager';
import { useApiUsage } from '@/context/ApiUsageContext';
import { RedditPost } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ContextSearchState {
    isLoading: boolean;
    status: 'idle' | 'analyzing' | 'fetching' | 'filtering' | 'completed';
    data: {
        posts: RedditPost[];
        totalResults: number;
        query: string;
        sort: string;
        cached?: boolean;
        cacheAge?: number;
        queryContext?: string[];
        filterStats?: any;
    } | null;
    error: string | null;
}

export function useContextSearch() {
    const [state, setState] = useState<ContextSearchState>({
        isLoading: false,
        status: 'idle',
        data: null,
        error: null,
    });

    useApiUsage();
    const progressTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    const clearProgressTimers = useCallback(() => {
        progressTimersRef.current.forEach((id) => clearTimeout(id));
        progressTimersRef.current = [];
    }, []);

    useEffect(() => {
        return () => clearProgressTimers();
    }, [clearProgressTimers]);

    const search = useCallback(async (query: string, sort?: string, time?: string) => {
        clearProgressTimers();
        setState(prev => ({
            ...prev,
            isLoading: true,
            status: 'analyzing',
            error: null
        }));

        try {
            const apiKey = getStoredApiKey();
            const headers: Record<string, string> = apiKey ? { 'x-groq-api-key': apiKey } : {};

            // Simulate progress states for better UX while server does the full pipeline.
            progressTimersRef.current.push(
                setTimeout(() => setState(prev => ({ ...prev, status: 'fetching' })), 800)
            );
            progressTimersRef.current.push(
                setTimeout(() => setState(prev => ({ ...prev, status: 'filtering' })), 2000)
            );

            // Orchestration route handles everything
            const res = await fetch('/api/context/filter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({ query, sort, time }),
            });

            if (res.status === 429) {
                throw new Error('Too many requests — please wait a moment and try again');
            }

            if (res.status === 504) {
                throw new Error('Search timed out — please try again');
            }

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const msg = errorData.error || 'Search failed';
                const details = errorData.details ? ` (${errorData.details})` : '';
                throw new Error(`${msg}${details}`);
            }

            const data = await res.json();

            setState({
                isLoading: false,
                status: 'completed',
                data: {
                    posts: data.posts,
                    totalResults: data.posts.length,
                    query: query,
                    sort: 'relevance',
                    cached: data.cached,
                    cacheAge: data.cacheAge,
                    queryContext: data.queryContext,
                    filterStats: data.filterStats
                },
                error: null
            });

        } catch (err: any) {
            console.error('Context search error:', err);
            setState({
                isLoading: false,
                status: 'idle',
                data: null,
                error: err.message || 'Unknown error occurred'
            });
        } finally {
            clearProgressTimers();
        }
    }, [clearProgressTimers]);

    const reset = useCallback(() => {
        setState({ isLoading: false, status: 'idle', data: null, error: null });
    }, []);

    return { ...state, search, reset };
}
