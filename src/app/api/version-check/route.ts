import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Check if a version matches a pattern
 * Patterns can be:
 * - Exact: "1.49.0"
 * - Wildcard: "1.49.*" or "1.49.X" (matches any patch version)
 * - Major wildcard: "1.*" or "1.X" (matches any minor/patch)
 */
function versionMatches(version: string, pattern: string): boolean {
    // Normalize pattern: X -> *
    const normalizedPattern = pattern.replace(/X/gi, '*');
    
    // Exact match
    if (normalizedPattern === version) return true;
    
    // Wildcard match
    if (normalizedPattern.includes('*')) {
        const regex = new RegExp('^' + normalizedPattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        return regex.test(version);
    }
    
    return false;
}

// GET /api/version-check?version=X.Y.Z
// Returns list of allowed plugin versions and whether the requested version is allowed
export async function GET(request: NextRequest) {
    const allowedVersionsEnv = process.env.ALLOWED_PLUGIN_VERSIONS;
    const requestedVersion = request.nextUrl.searchParams.get('version');
    
    if (!allowedVersionsEnv) {
        // No restriction - all versions allowed
        return NextResponse.json({
            restricted: false,
            allowed_versions: [],
            message: 'All versions allowed',
            version_allowed: true
        });
    }
    
    const allowedPatterns = allowedVersionsEnv.split(',').map(v => v.trim());
    
    // Check if the requested version matches any pattern
    let versionAllowed = false;
    if (requestedVersion) {
        versionAllowed = allowedPatterns.some(pattern => versionMatches(requestedVersion, pattern));
    }
    
    return NextResponse.json({
        restricted: true,
        allowed_versions: allowedPatterns,
        message: `Only versions matching ${allowedPatterns.join(', ')} are allowed`,
        version_allowed: versionAllowed
    });
}

