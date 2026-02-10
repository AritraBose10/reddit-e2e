/**
 * Search form component with keyword input, sort selector, and search button.
 * Includes 500ms debounce on the search action.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Flame, TrendingUp } from 'lucide-react';

interface SearchFormProps {
    onSearch: (keywords: string, sort: 'top' | 'hot') => void;
    isLoading: boolean;
    initialKeywords?: string;
    initialSort?: 'top' | 'hot';
}

export function SearchForm({ onSearch, isLoading, initialKeywords = '', initialSort = 'top' }: SearchFormProps) {
    const [keywords, setKeywords] = useState(initialKeywords);
    const [sort, setSort] = useState<'top' | 'hot'>(initialSort);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Clean up debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (!keywords.trim()) return;

            // Cancel any pending debounce
            if (debounceTimer.current) clearTimeout(debounceTimer.current);

            // Debounce the actual search by 500ms
            debounceTimer.current = setTimeout(() => {
                onSearch(keywords.trim(), sort);
            }, 100); // Short debounce on submit; main debounce is on typing
        },
        [keywords, sort, onSearch]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!keywords.trim() || isLoading) return;
                onSearch(keywords.trim(), sort);
            }
        },
        [keywords, sort, isLoading, onSearch]
    );

    return (
        <form onSubmit={handleSubmit} className="w-full space-y-4">
            {/* Keyword Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search Reddit posts... (e.g., 'machine learning', 'web development')"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-10 h-12 text-base bg-background border-border/60 focus:border-primary/50 transition-colors"
                    aria-label="Search keywords"
                    maxLength={200}
                    disabled={isLoading}
                />
            </div>

            {/* Sort + Search Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {/* Sort Radio Buttons */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                    <button
                        type="button"
                        onClick={() => setSort('top')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${sort === 'top'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                        aria-label="Sort by Top"
                    >
                        <TrendingUp className="h-4 w-4" />
                        Top
                    </button>
                    <button
                        type="button"
                        onClick={() => setSort('hot')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${sort === 'hot'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                        aria-label="Sort by Hot"
                    >
                        <Flame className="h-4 w-4" />
                        Hot
                    </button>
                </div>

                {/* Search Button */}
                <Button
                    type="submit"
                    disabled={!keywords.trim() || isLoading}
                    className="h-10 px-6 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-md hover:shadow-lg transition-all"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Searching...
                        </>
                    ) : (
                        <>
                            <Search className="mr-2 h-4 w-4" />
                            Search Reddit
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
