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
        staleTime: 5 * 60 * 1000, // 5 minutes — matches server cache TTL
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    });
}
