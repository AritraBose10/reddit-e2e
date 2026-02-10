/**
 * Main Search Page
 * Contains SearchForm, ResultsTable, and ExportButtons.
 */

'use client';

import { useState, useCallback } from 'react';
import { SearchForm } from '@/components/SearchForm';
import { ResultsTable } from '@/components/ResultsTable';
import { ExportButtons } from '@/components/ExportButtons';
import { useRedditSearch } from '@/hooks/useRedditSearch';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, SearchX, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SearchPage() {
    const [searchKeywords, setSearchKeywords] = useState('');
    const [searchSort, setSearchSort] = useState<'top' | 'hot'>('top');
    const [hasSearched, setHasSearched] = useState(false);

    const { data, isLoading, isError, error, refetch } = useRedditSearch(
        searchKeywords,
        searchSort
    );

    const handleSearch = useCallback((keywords: string, sort: 'top' | 'hot') => {
        setSearchKeywords(keywords);
        setSearchSort(sort);
        setHasSearched(true);
    }, []);

    // Extract error message from axios error
    const getErrorMessage = (): string => {
        if (!error) return 'An unexpected error occurred.';
        if (typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { data?: { error?: string }; status?: number } };
            if (axiosError.response?.data?.error) return axiosError.response.data.error;
            if (axiosError.response?.status === 429)
                return 'Rate limit exceeded. Please wait a moment before searching again.';
        }
        return (error as Error).message || 'Failed to fetch results. Please try again.';
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight mb-1">Search Reddit</h1>
                <p className="text-sm text-muted-foreground">
                    Search by keywords and get up to 100 posts sorted by relevance. No Reddit account needed.
                </p>
            </div>

            {/* Search Form */}
            <Card className="border-border/60 bg-card/50 shadow-sm">
                <CardContent className="p-5">
                    <SearchForm
                        onSearch={handleSearch}
                        isLoading={isLoading}
                        initialKeywords={searchKeywords}
                        initialSort={searchSort}
                    />
                </CardContent>
            </Card>

            {/* Export Buttons (shown when results exist) */}
            {data && data.posts.length > 0 && (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <ExportButtons
                        posts={data.posts}
                        keywords={searchKeywords}
                        disabled={isLoading}
                    />
                </div>
            )}

            {/* Error State */}
            {isError && (
                <Card className="mt-6 border-destructive/30 bg-destructive/5">
                    <CardContent className="p-5 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-medium text-destructive mb-1">Search Failed</h3>
                            <p className="text-sm text-muted-foreground">{getErrorMessage()}</p>
                            <Button
                                onClick={() => refetch()}
                                variant="outline"
                                size="sm"
                                className="mt-3 gap-2"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Try Again
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* No Results State */}
            {hasSearched && !isLoading && !isError && data && data.posts.length === 0 && (
                <Card className="mt-6 border-border/40">
                    <CardContent className="p-8 text-center">
                        <SearchX className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                        <h3 className="font-medium mb-1">No results found</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Try different keywords, check your spelling, or use more general search terms.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Results Table */}
            <ResultsTable
                posts={data?.posts || []}
                isLoading={isLoading}
                totalResults={data?.totalResults || 0}
                cached={data?.cached}
                cacheAge={data?.cacheAge}
                query={data?.query}
            />

            {/* Empty state — before any search */}
            {!hasSearched && (
                <div className="mt-12 text-center">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted/50 mb-4">
                        <SearchX className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <h3 className="font-medium text-muted-foreground mb-1">Ready to search</h3>
                    <p className="text-sm text-muted-foreground/70">
                        Enter keywords above to discover Reddit posts
                    </p>
                </div>
            )}
        </div>
    );
}
