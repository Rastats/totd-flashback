// Simple in-memory rate limiter for API protection
// Note: In serverless (Vercel), this resets on cold starts - but still helps during high traffic

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
        if (now > entry.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}, 60000); // Cleanup every minute

export interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
}

// Default configs for different API types
export const RATE_LIMITS = {
    // Plugin sync calls (generous - plugins call every few seconds)
    plugin: { windowMs: 60000, maxRequests: 60 } as RateLimitConfig,

    // Public API calls (moderate)
    public: { windowMs: 60000, maxRequests: 30 } as RateLimitConfig,

    // Admin calls (generous for admins)
    admin: { windowMs: 60000, maxRequests: 100 } as RateLimitConfig,

    // Auth/sensitive calls (strict)
    auth: { windowMs: 60000, maxRequests: 10 } as RateLimitConfig,
};

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier for the client (IP, API key, etc.)
 * @param config - Rate limit configuration
 * @returns RateLimitResult with allowed status and remaining count
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig = RATE_LIMITS.public
): RateLimitResult {
    const now = Date.now();
    const key = identifier;

    let entry = rateLimitMap.get(key);

    // If no entry or expired, create new window
    if (!entry || now > entry.resetTime) {
        entry = {
            count: 1,
            resetTime: now + config.windowMs
        };
        rateLimitMap.set(key, entry);
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetTime: entry.resetTime
        };
    }

    // Increment count
    entry.count++;

    // Check if over limit
    if (entry.count > config.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: entry.resetTime
        };
    }

    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetTime: entry.resetTime
    };
}

/**
 * Get client identifier from request (IP or API key)
 */
export function getClientIdentifier(request: Request): string {
    // Try to get API key first (for plugin requests)
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey) {
        return `key:${apiKey.slice(0, 8)}`; // Use first 8 chars as identifier
    }

    // Fall back to IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

    return `ip:${ip}`;
}

/**
 * Apply rate limiting to a request
 * Returns null if allowed, or a Response if rate limited
 */
export function applyRateLimit(
    request: Request,
    config: RateLimitConfig = RATE_LIMITS.public
): Response | null {
    const identifier = getClientIdentifier(request);
    const result = checkRateLimit(identifier, config);

    if (!result.allowed) {
        return new Response(
            JSON.stringify({
                error: 'Too many requests',
                retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': String(Math.ceil((result.resetTime - Date.now()) / 1000)),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(result.resetTime)
                }
            }
        );
    }

    return null; // Request allowed
}
