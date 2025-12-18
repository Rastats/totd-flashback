// Validate API key from plugin requests
export function validateApiKey(request: Request): boolean {
    const apiKey = request.headers.get('X-API-Key');
    const expectedKey = process.env.PLUGIN_API_KEY;

    if (!expectedKey) {
        console.warn('[Auth] PLUGIN_API_KEY not set in environment');
        return true; // Allow if not configured (for dev)
    }

    return apiKey === expectedKey;
}
