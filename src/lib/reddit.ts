import { RedditPost } from '@/types';

const REDDIT_PUBLIC_SEARCH_URLS = [
    'https://www.reddit.com/search.json',
    'https://old.reddit.com/search.json',
    'https://api.reddit.com/search',
];

const REDDIT_PUBLIC_BASE_URLS = [
    'https://www.reddit.com',
    'https://old.reddit.com',
    'https://api.reddit.com',
];

const REDDIT_OAUTH_BASE = 'https://oauth.reddit.com';
const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
];

const REDDIT_APP_USER_AGENT = process.env.REDDIT_USER_AGENT || 'web:reddit-scraper:1.0 (by /u/reddit_scraper_app)';
const MIN_REQUEST_INTERVAL_MS = 2200;

type RedditTokenCache = { accessToken: string; expiresAt: number };
let tokenCache: RedditTokenCache | null = null;

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

function hasOAuthConfig(): boolean {
    return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

async function getRedditAccessToken(): Promise<string> {
    if (!hasOAuthConfig()) throw new Error('Missing Reddit OAuth config');

    if (tokenCache && Date.now() < tokenCache.expiresAt) {
        return tokenCache.accessToken;
    }

    const clientId = process.env.REDDIT_CLIENT_ID!;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET!;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetchWithTimeout(REDDIT_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${basic}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': REDDIT_APP_USER_AGENT,
                    'Accept': 'application/json',
                },
                body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
            }, 8000 + attempt * 2000);

            if (res.status === 429 || res.status >= 500) {
                lastError = new Error(`Reddit OAuth token failed ${res.status}`);
                if (attempt < 3) {
                    await sleep(1000 * attempt);
                    continue;
                }
                throw lastError;
            }

            if (!res.ok) {
                const body = await res.text();
                throw new Error(`Reddit OAuth token failed ${res.status}: ${body}`);
            }

            const data = await res.json() as { access_token?: string; expires_in?: number };
            if (!data.access_token) throw new Error('Reddit OAuth token missing access_token');

            const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
            tokenCache = {
                accessToken: data.access_token,
                expiresAt: Date.now() + Math.max(0, (expiresIn - 60) * 1000),
            };

            return tokenCache.accessToken;
        } catch (error) {
            const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
            const transient = msg.includes('timeout') || msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('etimedout');
            if (transient && attempt < 3) {
                lastError = error instanceof Error ? error : new Error(String(error));
                await sleep(1000 * attempt);
                continue;
            }
            throw error;
        }
    }

    throw lastError || new Error('Reddit OAuth token failed');
}

function clearTokenCache() {
    tokenCache = null;
}

/**
 * Maps a UI time range to the nearest broader Reddit-native time filter + a cutoff timestamp.
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

function buildPublicHeaders(referer: string): HeadersInit {
    return {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'DNT': '1',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Referer': referer,
        'Origin': 'https://www.reddit.com',
    };
}

async function fetchJsonWithRetry(url: string, headers: HeadersInit): Promise<any> {
    let lastError: Error | null = null;
    let host = 'reddit';
    try {
        host = new URL(url).hostname;
    } catch {
        // keep default host label
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const timeout = 12000 + attempt * 2000;
            const attemptHeaders = new Headers(headers);
            if (!attemptHeaders.has('Authorization')) {
                attemptHeaders.set('User-Agent', getRandomUserAgent());
            }
            const res = await fetchWithTimeout(url, { headers: attemptHeaders }, timeout);

            if (res.status === 403) {
                lastError = new Error(`Reddit API Error: 403 (${host})`);
                if (attempt < 3) {
                    await sleep(2500 * attempt);
                    continue;
                }
                throw lastError;
            }

            if (res.status === 429) {
                const retryAfterHeader = res.headers.get('retry-after');
                const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
                const waitMs = !Number.isNaN(retryAfter) ? Math.max(1000, retryAfter * 1000) : 2000 * attempt;
                lastError = new Error('Reddit Rate Limit Exceeded (429)');
                if (attempt < 3) {
                    await sleep(waitMs);
                    continue;
                }
                throw lastError;
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
                throw new Error(`Reddit API Error: ${res.status} (${host})`);
            }

            return await res.json();
        } catch (error) {
            const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
            const transient = msg.includes('timeout') || msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('etimedout');

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

async function tryOAuthSearch(params: URLSearchParams): Promise<any> {
    let oauthError: Error | null = null;

    for (let i = 0; i < 2; i++) {
        try {
            const token = await getRedditAccessToken();
            const url = `${REDDIT_OAUTH_BASE}/search?${params.toString()}`;
            const headers: HeadersInit = {
                'Authorization': `Bearer ${token}`,
                'User-Agent': REDDIT_APP_USER_AGENT,
                'Accept': 'application/json',
            };
            return await fetchJsonWithRetry(url, headers);
        } catch (error) {
            oauthError = error instanceof Error ? error : new Error(String(error));
            const msg = oauthError.message.toLowerCase();
            if (msg.includes('401') || msg.includes('403') || msg.includes('token')) {
                clearTokenCache();
                continue;
            }
            throw oauthError;
        }
    }

    throw oauthError || new Error('Reddit OAuth search failed');
}

/**
 * Searches Reddit using OAuth when configured, with fallback to public JSON endpoints.
 */
export async function searchReddit(
    query: string,
    limit: number = 25,
    sort: 'relevance' | 'hot' | 'top' | 'new' = 'relevance',
    time: string = 'all'
): Promise<RedditPost[]> {
    const { redditTime, cutoffMs } = resolveTimeRange(time);
    const fetchLimit = cutoffMs ? Math.min(100, limit * 3) : limit;
    const oauthConfigured = hasOAuthConfig();

    const params = new URLSearchParams({
        q: query,
        limit: fetchLimit.toString(),
        sort,
        t: redditTime,
        type: 'link',
        include_over_18: 'off',
        raw_json: '1',
    });

    const finalize = (data: any): RedditPost[] => {
        const posts = mapRedditPosts(data);
        const filtered = cutoffMs
            ? posts.filter((p: RedditPost) => new Date(p.created).getTime() >= cutoffMs)
            : posts;
        return filtered.slice(0, limit);
    };

    if (oauthConfigured) {
        try {
            const data = await enqueueRedditRequest(() => tryOAuthSearch(params));
            return finalize(data);
        } catch (oauthError) {
            console.warn('Reddit OAuth search failed, falling back to public endpoint.', oauthError);
        }
    }

    let lastError: Error | null = null;

    for (const searchUrl of REDDIT_PUBLIC_SEARCH_URLS) {
        const url = `${searchUrl}?${params.toString()}`;

        try {
            const data = await enqueueRedditRequest(() => fetchJsonWithRetry(url, buildPublicHeaders('https://www.reddit.com/')));
            return finalize(data);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const msg = lastError.message.toLowerCase();

            if (msg.includes('403') || msg.includes('timeout') || msg.includes('fetch failed')) {
                continue;
            }
            throw lastError;
        }
    }

    console.error('Reddit Search Failed:', lastError);
    const message = (lastError?.message || '').toLowerCase();
    if (message.includes('403')) {
        if (!oauthConfigured) {
            throw new Error('Reddit API Error: 403. Public endpoints blocked from this host. Configure REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in production.');
        }
        throw new Error('Reddit API Error: 403. OAuth configured but request still forbidden. Verify REDDIT_USER_AGENT and Reddit app credentials.');
    }
    throw lastError || new Error('Reddit API Error: unknown');
}

/**
 * Fetches details/comments for a specific post.
 */
export async function getPostDetails(permalink: string): Promise<string> {
    let cleanLink = permalink;
    if (cleanLink.startsWith('https://www.reddit.com')) {
        cleanLink = cleanLink.replace('https://www.reddit.com', '');
    }
    if (cleanLink.endsWith('/')) {
        cleanLink = cleanLink.slice(0, -1);
    }

    const extractComments = (data: any): string => {
        if (!Array.isArray(data) || data.length < 2) return '';
        const comments = data[1]?.data?.children || [];
        return comments
            .map((c: any) => {
                const body: string = c?.data?.body || '';
                return body.length > 200 ? body.substring(0, 200) + '...' : body;
            })
            .filter((body: string) => body && body !== '[deleted]' && body !== '[removed]')
            .slice(0, 5)
            .join('\n---\n');
    };

    if (hasOAuthConfig()) {
        try {
            const token = await getRedditAccessToken();
            const url = `${REDDIT_OAUTH_BASE}${cleanLink}.json?limit=10&sort=top&raw_json=1`;
            const data = await enqueueRedditRequest(() => fetchJsonWithRetry(url, {
                'Authorization': `Bearer ${token}`,
                'User-Agent': REDDIT_APP_USER_AGENT,
                'Accept': 'application/json',
            }));
            const parsed = extractComments(data);
            if (parsed) return parsed;
        } catch {
            clearTokenCache();
        }
    }

    for (const baseUrl of REDDIT_PUBLIC_BASE_URLS) {
        try {
            const url = `${baseUrl}${cleanLink}.json?limit=10&sort=top&raw_json=1`;
            const data = await enqueueRedditRequest(() => fetchJsonWithRetry(url, buildPublicHeaders(`${baseUrl}/`)));
            const parsed = extractComments(data);
            if (parsed) return parsed;
        } catch {
            // try next endpoint
        }
    }

    return '';
}
