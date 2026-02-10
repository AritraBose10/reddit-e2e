/**
 * IP-based rate limiter for Reddit API requests.
 * Enforces 1 request per 2 seconds per IP to respect Reddit's guidelines.
 */

interface RateLimitEntry {
    lastRequest: number;
    requestCount: number;
}

class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private readonly windowMs: number;
    private readonly maxRequests: number;

    constructor(windowMs = 2000, maxRequests = 1) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;

        // Clean up old entries every 60 seconds
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Check if a request from the given IP is allowed.
     * Returns { allowed: true } or { allowed: false, retryAfter: ms }
     */
    check(ip: string): { allowed: boolean; retryAfter?: number } {
        const now = Date.now();
        const entry = this.limits.get(ip);

        if (!entry) {
            this.limits.set(ip, { lastRequest: now, requestCount: 1 });
            return { allowed: true };
        }

        const elapsed = now - entry.lastRequest;

        if (elapsed >= this.windowMs) {
            // Window has passed, reset
            entry.lastRequest = now;
            entry.requestCount = 1;
            return { allowed: true };
        }

        if (entry.requestCount < this.maxRequests) {
            entry.requestCount++;
            return { allowed: true };
        }

        // Rate limited
        const retryAfter = this.windowMs - elapsed;
        return { allowed: false, retryAfter };
    }

    private cleanup() {
        const now = Date.now();
        const cutoff = now - this.windowMs * 10; // Keep entries for 10x the window

        for (const [ip, entry] of this.limits.entries()) {
            if (entry.lastRequest < cutoff) {
                this.limits.delete(ip);
            }
        }
    }
}

// Singleton instance — 1 request per 2 seconds per IP
export const rateLimiter = new RateLimiter(2000, 1);
