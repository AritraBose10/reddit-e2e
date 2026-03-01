import { RedditPost } from '@/types';

const REDDIT_SEARCH_URLS = [
    'https://www.reddit.com/search.json',
    'https://old.reddit.com/search.json',
];

const REDDIT_BASE_URLS = [
    'https://www.reddit.com',
    'https://old.reddit.com',
];

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
];

const MIN_REQUEST_INTERVAL_MS = 2200;

let queueTail: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enqueueRedditRequest<T>(fn: () => Promise<T>): Promise<T> {
    const runner = async () => {
        const elapsed = Date.now() - lastRequestAt;
        const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - elapsed);
        if (waitMs > 0) await sleep(waitMs);
        lastRequestAt = Date.now();
        return fn();
    };

    const next = queueTail.then(runner, runner);
    queueTail = next.then(() => undefined, () => undefined);
    return next;
}

function buildHeaders(referer: string): HeadersInit {
    return {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'DNT': '1',
        'Referer': referer,
        'Origin': 'https://www.reddit.com',
    };
}

/**
 * Maps a UI time range to the nearest broader Reddit-native time filter + a cutoff timestamp.
 * Reddit only supports: hour, day, week, month, year, all.
 * Custom ranges like '15d' need to fetch a broader set and then filter locally.
 */
function resolveTimeRange(time: string): { redditTime: string; cutoffMs: number | null } {
    const now = Date.now();
    switch (time) {
        case '15d':
            return { redditTime: 'month', cutoffMs: now - 15 * 24 * 60 * 60 * 1000 };
        case 'hour':
        case 'day':
        case 'week':
        case 'month':
        case 'year':
        case 'all':
            return { redditTime: time, cutoffMs: null };
        default:
            return { redditTime: 'all', cutoffMs: null };
    }
}

/**
 * Wraps fetch with a timeout to prevent hanging requests.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 12000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Reddit request timeout');
        }
        throw error;
    } finally {
        clearTimeout(id);
    }
}

async function fetchRedditJson(url: string, referer: string): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const timeout = 12000 + attempt * 2000;
            const res = await fetchWithTimeout(url, {
                headers: buildHeaders(referer),
            }, timeout);

            if (res.status === 429) {
                const retryAfterHeader = res.headers.get('retry-after');
                const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
                const waitMs = !Number.isNaN(retryAfter) ? Math.max(1000, retryAfter * 1000) : 2000 * attempt;
                lastError = new Error(`Reddit Rate Limit Exceeded (429)`);
                if (attempt < 3) {
                    await sleep(waitMs);
                    continue;
                }
                throw lastError;
            }

            if (res.status === 403) {
                throw new Error('Reddit API Error: 403');
            }

            if (res.status >= 500) {
                lastError = new Error(`Reddit API Error: ${res.status}`);
                if (attempt < 3) {
                    await sleep(1000 * attempt);
                    continue;
                }
                throw lastError;
            }

            if (!res.ok) {
                throw new Error(`Reddit API Error: ${res.status}`);
            }

            return await res.json();
        } catch (error) {
            const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
            const transient = msg.includes('timeout') || msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('fetch failed');

            if (transient && attempt < 3) {
                await sleep(1000 * attempt);
                lastError = error instanceof Error ? error : new Error(String(error));
                continue;
            }

            throw error;
        }
    }

    throw lastError || new Error('Reddit API Error: unknown');
}

function mapRedditPosts(data: any): RedditPost[] {
    const children = data?.data?.children || [];

    return children.map((child: any) => {
        const p = child?.data || {};
        return {
            id: p.name || `t3_${Math.random().toString(36).slice(2, 11)}`,
            title: p.title || 'Untitled Post',
            subreddit: p.subreddit || 'u/unknown',
            author: p.author || 'deleted',
            link: p.url || `https://reddit.com${p.permalink}`,
            permalink: p.permalink || '',
            snippet: (p.selftext || '').substring(0, 500),
            upvotes: p.ups || 0,
            comments: p.num_comments || 0,
            created: new Date((p.created_utc || Date.now() / 1000) * 1000).toISOString(),
            thumbnail: p.thumbnail && p.thumbnail.startsWith('http') ? p.thumbnail : null,
        } as RedditPost;
    });
}

/**
 * Searches Reddit using public JSON endpoints (No OAuth).
 */
export async function searchReddit(
    query: string,
    limit: number = 25,
    sort: 'relevance' | 'hot' | 'top' | 'new' = 'relevance',
    time: string = 'all'
): Promise<RedditPost[]> {
    const { redditTime, cutoffMs } = resolveTimeRange(time);
    const fetchLimit = cutoffMs ? Math.min(100, limit * 3) : limit;

    const params = new URLSearchParams({
        q: query,
        limit: fetchLimit.toString(),
        sort,
        t: redditTime,
        type: 'link',
        include_over_18: 'off',
        raw_json: '1',
    });

    let lastError: Error | null = null;

    for (const searchUrl of REDDIT_SEARCH_URLS) {
        const url = `${searchUrl}?${params.toString()}`;

        try {
            const data = await enqueueRedditRequest(() => fetchRedditJson(url, 'https://www.reddit.com/'));
            const posts = mapRedditPosts(data);

            let filtered = posts;
            if (cutoffMs) {
                filtered = posts.filter((p: RedditPost) => new Date(p.created).getTime() >= cutoffMs);
            }

            return filtered.slice(0, limit);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const msg = lastError.message.toLowerCase();

            // Try alternate endpoint on 403 or timeout-like failures.
            if (msg.includes('403') || msg.includes('timeout') || msg.includes('fetch failed')) {
                continue;
            }

            throw lastError;
        }
    }

    console.error('Reddit Search Failed:', lastError);
    throw lastError || new Error('Reddit API Error: unknown');
}

/**
 * Fetches the details (comments) of a specific post.
 */
export async function getPostDetails(permalink: string): Promise<string> {
    let cleanLink = permalink;
    if (cleanLink.startsWith('https://www.reddit.com')) {
        cleanLink = cleanLink.replace('https://www.reddit.com', '');
    }

    if (cleanLink.endsWith('/')) {
        cleanLink = cleanLink.slice(0, -1);
    }

    let lastError: Error | null = null;

    for (const baseUrl of REDDIT_BASE_URLS) {
        const url = `${baseUrl}${cleanLink}.json?limit=10&sort=top&raw_json=1`;

        try {
            const data = await enqueueRedditRequest(() => fetchRedditJson(url, `${baseUrl}/`));

            if (!Array.isArray(data) || data.length < 2) {
                return '';
            }

            const commentsListing = data[1];
            const comments = commentsListing?.data?.children || [];

            return comments
                .map((c: any) => {
                    const body: string = c?.data?.body || '';
                    return body.length > 200 ? body.substring(0, 200) + '...' : body;
                })
                .filter((body: string) => body && body !== '[deleted]' && body !== '[removed]')
                .slice(0, 5)
                .join('\n---\n');
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            continue;
        }
    }

    console.error('Error fetching post details:', lastError);
    return '';
}
