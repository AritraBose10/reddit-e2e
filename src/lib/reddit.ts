/**
 * Reddit API helper — fetches posts using Reddit's public JSON endpoints.
 * Optimized for local use with robust retry logic and header spoofing.
 */

import { RedditPost } from '@/types';

// Use standard Reddit domain
const REDDIT_API_BASE = 'https://www.reddit.com';

// Browser-like User-Agent to avoid immediate blocking
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface RedditComment {
    body: string;
    author: string;
    score: number;
    replies?: RedditComment[];
}

interface RedditApiChild {
    data: {
        id: string;
        title: string;
        score: number;
        num_comments: number;
        permalink: string;
        subreddit_name_prefixed: string;
        created_utc: number;
        author: string;
    };
}

interface RedditApiResponse {
    data: {
        children: RedditApiChild[];
        after: string | null;
    };
}

/**
 * Fetch a URL with retry logic, exponential backoff, and timeouts.
 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Create a controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
            const res = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (res.ok) return res;

            // Retry on 429 (Too Many Requests) or 5xx server errors
            if ((res.status === 429 || res.status >= 500) && attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1500; // 1.5s, 3s, 6s...
                console.warn(
                    `Reddit returned ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1
                    }/${maxRetries})`
                );
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }

            throw new Error(`Reddit API error: ${res.status} ${res.statusText}`);
        } catch (err: unknown) {
            clearTimeout(timeoutId);

            // Retry on timeout (AbortError in fetch) or network errors
            if (err instanceof DOMException && err.name === 'AbortError') {
                if (attempt < maxRetries - 1) {
                    console.warn(`Reddit request timed out, retrying (attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise((r) => setTimeout(r, 2000));
                    continue;
                }
                throw new Error('Reddit request timed out after multiple retries');
            }

            // Rethrow if it's the last attempt or a non-retryable error
            if (attempt === maxRetries - 1) throw err;

            // Wait before retry for generic network errors
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    throw new Error('Failed to fetch after retries');
}

/**
 * Fetch Reddit posts for a given query and sort type.
 * Paginates to collect up to 100 posts total.
 */
export async function fetchRedditPosts(
    keywords: string,
    sort: 'top' | 'hot',
    time?: string
): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = [];
    let after: string | null = null;

    // Map time parameter ('15d' is handled by fetching 'month' and filtering)
    let tParam = time || 'all';
    if (time === '15d') {
        tParam = 'month';
    }

    const maxPages = 4; // Fetch up to 4 pages (approx 100 results)

    for (let page = 0; page < maxPages; page++) {
        const params = new URLSearchParams({
            q: keywords,
            limit: '100', // Request max items per page
            sort,
            t: tParam,
            type: 'link',
            raw_json: '1',
        });

        if (after) {
            params.set('after', after);
        }

        const url = `${REDDIT_API_BASE}/search.json?${params.toString()}`;

        try {
            const res = await fetchWithRetry(url, {
                method: 'GET',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'application/json',
                },
                cache: 'no-store',
            });

            const json = (await res.json()) as RedditApiResponse;
            const children = json?.data?.children || [];

            if (children.length === 0) break;

            for (const child of children) {
                const postTime = child.data.created_utc * 1000;

                // Manual filtering for custom '15d' time range
                if (time === '15d') {
                    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
                    if (postTime < fifteenDaysAgo) continue;
                }

                allPosts.push({
                    id: child.data.id,
                    title: child.data.title,
                    upvotes: child.data.score,
                    comments: child.data.num_comments,
                    link: `https://www.reddit.com${child.data.permalink}`,
                    subreddit: child.data.subreddit_name_prefixed,
                    created: new Date(postTime).toISOString(),
                    author: child.data.author,
                });
            }

            after = json?.data?.after;

            // Stop if no more pages or we have enough posts
            if (!after || allPosts.length >= 100) break;

            // Important: Delay between paginated requests to respect rate limits
            if (page < maxPages - 1 && after) {
                await new Promise((r) => setTimeout(r, 1500));
            }
        } catch (error) {
            console.error('Error fetching Reddit page:', error);
            // If one page fails, we can still return what we have so far
            break;
        }
    }

    // Sort again to be sure (since we might have multiple pages)
    return allPosts.sort((a, b) => b.upvotes - a.upvotes).slice(0, 100);
}

/**
 * Fetch details (comments) for a specific Reddit post.
 */
export async function getPostDetails(permalink: string): Promise<string> {
    try {
        // Ensure clean permalink
        const cleanPermalink = permalink.endsWith('/') ? permalink.slice(0, -1) : permalink;
        const url = `${REDDIT_API_BASE}${cleanPermalink}.json?raw_json=1`;

        const res = await fetchWithRetry(
            url,
            {
                method: 'GET',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'application/json',
                },
                cache: 'no-store',
            },
            2 // Fewer retries for comments
        );

        const data = await res.json();

        // Reddit post JSON structure is an array: [postData, commentsData]
        if (!data || !Array.isArray(data) || data.length < 2) {
            return '';
        }

        const commentsData = data[1]?.data?.children;
        if (!commentsData) return '';

        const comments: string[] = [];
        for (const child of commentsData) {
            if (child.kind === 't1' && child.data) {
                const body = child.data.body;
                // Filter deleted/removed comments
                if (body && body !== '[deleted]' && body !== '[removed]') {
                    comments.push(body);
                }
            }
            // Limit to top 10 comments
            if (comments.length >= 10) break;
        }

        return comments.join('\n\n');
    } catch (error) {
        console.error(`Error fetching details for ${permalink}:`, error);
        return '';
    }
}

/**
 * Browser-side search using a CORS proxy to bypass IP blocks.
 * Usage: Client-side only ("Context Mode").
 */
export async function searchRedditBrowser(
    query: string,
    sort: 'top' | 'hot' = 'top',
    time: string = 'all'
): Promise<RedditPost[]> {
    const params = new URLSearchParams({
        q: query,
        limit: '100',
        sort,
        t: time,
        type: 'link',
        raw_json: '1',
    });

    // Use CORS Proxy to bypass Reddit's strict CORS policy on client-side
    // We target the standard JSON API
    const targetUrl = `${REDDIT_API_BASE}/search.json?${params.toString()}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
        const res = await fetch(proxyUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });

        if (!res.ok) throw new Error(`Proxy error: ${res.status}`);

        const json = await res.json() as RedditApiResponse;
        const children = json?.data?.children || [];

        return children.map(child => ({
            id: child.data.id,
            title: child.data.title,
            upvotes: child.data.score,
            comments: child.data.num_comments,
            link: `https://www.reddit.com${child.data.permalink}`,
            subreddit: child.data.subreddit_name_prefixed,
            created: new Date(child.data.created_utc * 1000).toISOString(),
            author: child.data.author,
        }));
    } catch (error) {
        console.error('Browser search failed:', error);
        return [];
    }
}
