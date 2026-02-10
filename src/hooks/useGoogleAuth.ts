/**
 * Hook for managing Google authentication status.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { GoogleAuthStatus } from '@/types';

async function fetchAuthStatus(): Promise<GoogleAuthStatus> {
    const { data } = await axios.get<GoogleAuthStatus>('/api/google/status');
    return data;
}

async function disconnectGoogle(): Promise<void> {
    await axios.delete('/api/google/status');
}

export function useGoogleAuth() {
    const queryClient = useQueryClient();

    const statusQuery = useQuery<GoogleAuthStatus>({
        queryKey: ['google-auth-status'],
        queryFn: fetchAuthStatus,
        staleTime: 60 * 1000, // 1 minute
        retry: 1,
    });

    const disconnectMutation = useMutation({
        mutationFn: disconnectGoogle,
        onSuccess: () => {
            queryClient.setQueryData(['google-auth-status'], { authenticated: false });
        },
    });

    return {
        isAuthenticated: statusQuery.data?.authenticated ?? false,
        email: statusQuery.data?.email,
        isLoading: statusQuery.isLoading,
        disconnect: disconnectMutation.mutate,
        isDisconnecting: disconnectMutation.isPending,
    };
}
