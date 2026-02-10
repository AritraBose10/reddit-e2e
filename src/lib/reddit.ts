/**
 * Reddit API helper — fetches posts using Reddit's public JSON endpoints.
 * No authentication required. Respects rate limits and uses proper User-Agent.
 */

import axios from 'axios';
import { RedditPost } from '@/types';

const REDDIT_SEARCH_URL = 'https://www.reddit.com/search.json';
const USER_AGENT = 'RedditSearchTool/1.0 (Web App)';

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
    sort: 'top' | 'hot'
): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = [];
    let after: string | null = null;

    // Reddit often returns ~25 results per page, so we paginate to reach 100
    const maxPages = 4;

    for (let page = 0; page < maxPages; page++) {
        const params: Record<string, string> = {
            q: keywords,
            limit: '100',
            sort,
            t: 'all',
            type: 'link',
            raw_json: '1',
        };

        if (after) {
            params.after = after;
        }

        const response = await axios.get<RedditApiResponse>(REDDIT_SEARCH_URL, {
            params,
            headers: {
                'User-Agent': USER_AGENT,
            },
            timeout: 10000,
        });

        const children = response.data?.data?.children || [];

        if (children.length === 0) break;

        const posts = children.map((child: RedditApiChild): RedditPost => ({
            id: child.data.id,
            title: child.data.title,
            upvotes: child.data.score,
            comments: child.data.num_comments,
            link: `https://www.reddit.com${child.data.permalink}`,
            subreddit: child.data.subreddit_name_prefixed,
            created: new Date(child.data.created_utc * 1000).toISOString(),
            author: child.data.author,
        }));

        allPosts.push(...posts);

        // Stop if we have enough or no more pages
        after = response.data?.data?.after;
        if (!after || allPosts.length >= 100) break;

        // Small delay between paginated requests to be polite
        if (page < maxPages - 1 && after) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    // Sort by upvotes descending and limit to 100
    return allPosts
        .sort((a, b) => b.upvotes - a.upvotes)
        .slice(0, 100);
}
