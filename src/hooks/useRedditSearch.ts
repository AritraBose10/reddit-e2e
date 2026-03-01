/**
 * React Query hook for Reddit search.
 * Manages search state, loading, errors, and caching.
 */

'use client';

import { SearchResponse } from '@/types';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

async function searchReddit(keywords: string, sort: string, time?: string, limit?: number): Promise<SearchResponse> {
    const { data } = await axios.get<SearchResponse>('/api/reddit', {
        params: { keywords, sort, time, limit: limit || 100 },
    });
    return data;
}

export function useRedditSearch(keywords: string, sort: 'top' | 'hot' | 'relevance', time?: string, limit: number = 100) {
    return useQuery<SearchResponse>({
        queryKey: ['reddit-search', keywords, sort, time, limit],
        queryFn: () => searchReddit(keywords, sort, time, limit),
        enabled: keywords.length > 0,
        staleTime: 0,
        gcTime: 0,
        retry: (failureCount, error) => {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status;
                // Don't amplify client/rate-limit failures with retry storms.
                if (status === 429) return false;
                if (status && status >= 400 && status < 500) return false;
            }
            return failureCount < 2;
        },
        retryDelay: (attemptIndex, error) => {
            if (axios.isAxiosError(error) && error.response?.status === 429) {
                const retryAfter = error.response.headers?.['retry-after'];
                const seconds = typeof retryAfter === 'string' ? parseInt(retryAfter, 10) : NaN;
                if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
            }
            return Math.min(1000 * 2 ** attemptIndex, 10000);
        },
    });
}

