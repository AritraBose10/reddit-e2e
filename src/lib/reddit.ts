/**
 * Reddit API helper — fetches posts using Reddit's public JSON endpoints.
 * No authentication required. Respects rate limits and uses proper User-Agent.
 */

import axios from 'axios';
import { RedditPost } from '@/types';

const REDDIT_API_BASE = 'https://www.reddit.com';
const USER_AGENT = 'RedditSearchTool/1.0 (Web App)';

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
 * Fetch Reddit posts for a given query and sort type.
 * Uses two paginated requests (limit=100 per request, but Reddit often caps at ~25 per page)
 * to collect up to 100 posts total.
 */
export async function fetchRedditPosts(
    keywords: string,
    sort: 'top' | 'hot',
    time?: string
): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = [];
    let after: string | null = null;

    // Determine the 't' parameter for Reddit API
    // If '15d' (custom) is selected, we fetch 'month' and filter manually.
    let tParam = time || 'all';
    if (time === '15d') {
        tParam = 'month';
    }

    // Reddit often returns ~25 results per page, so we paginate to reach 100
    const maxPages = 4;

    for (let page = 0; page < maxPages; page++) {
        const params: Record<string, string> = {
            q: keywords,
            limit: '100',
            sort,
            t: tParam,
            type: 'link',
            raw_json: '1',
        };

        if (after) {
            params.after = after;
        }

        // Retry with exponential backoff on rate limits / transient errors
        let response;
        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                response = await axios.get<RedditApiResponse>(`${REDDIT_API_BASE}/search.json`, {
                    params,
                    headers: {
                        'User-Agent': USER_AGENT,
                    },
                    timeout: 10000,
                });
                break; // Success — exit retry loop
            } catch (err: unknown) {
                const status = axios.isAxiosError(err) ? err.response?.status : undefined;
                const isRetryable = status === 429 || status === 500 || status === 503;

                if (isRetryable && attempt < maxRetries - 1) {
                    const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                    console.warn(`Reddit returned ${status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                } else {
                    throw err; // Non-retryable or exhausted retries
                }
            }
        }

        if (!response) break;

        const children = response.data?.data?.children || [];

        if (children.length === 0) break;

        for (const child of children) {
            const postTime = child.data.created_utc * 1000;

            // Custom filtering for 15 days
            if (time === '15d') {
                const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
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

        // Stop if we have enough or no more pages
        after = response.data?.data?.after;
        if (!after || allPosts.length >= 100) break;

        // Delay between paginated requests to avoid Reddit rate limiting
        if (page < maxPages - 1 && after) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
        }
    }

    // Sort by upvotes descending and limit to 100
    return allPosts
        .sort((a, b) => b.upvotes - a.upvotes)
        .slice(0, 100);
}

/**
 * Fetch details (comments) for a specific Reddit post.
 */
export async function getPostDetails(permalink: string): Promise<string> {
    try {
        // Remove trailing slash to avoid redirect issues sometimes
        const cleanPermalink = permalink.endsWith('/') ? permalink.slice(0, -1) : permalink;
        // Reddit API requires .json extension
        const url = `${REDDIT_API_BASE}${cleanPermalink}.json`;

        console.log(`Fetching comments from: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENT,
            },
        });

        if (!response.data || !Array.isArray(response.data) || response.data.length < 2) {
            return '';
        }

        // Response[0] is the post listing, Response[1] is the comments listing
        // We are interested in response.data[1].data.children
        const commentsData = response.data[1]?.data?.children;

        if (!commentsData) return '';

        const comments: string[] = [];

        for (const child of commentsData) {
            if (child.kind === 't1' && child.data) {
                const body = child.data.body;
                // Filter out deleted/removed comments
                if (body && body !== '[deleted]' && body !== '[removed]') {
                    comments.push(body);
                }
            }
            // Limit to top 10 root comments to save tokens
            if (comments.length >= 10) break;
        }

        return comments.join('\n\n');
    } catch (error) {
        // Log basic error but don't fail the whole process
        console.error(`Error fetching details for ${permalink}:`, error instanceof Error ? error.message : String(error));
        return '';
    }
}
