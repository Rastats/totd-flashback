import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/version-check
// Returns list of allowed plugin versions
// Plugin checks this on startup and disables sync if not allowed
export async function GET() {
    const allowedVersionsEnv = process.env.ALLOWED_PLUGIN_VERSIONS;
    
    if (!allowedVersionsEnv) {
        // No restriction - all versions allowed
        return NextResponse.json({
            restricted: false,
            allowed_versions: [],
            message: 'All versions allowed'
        });
    }
    
    const allowedVersions = allowedVersionsEnv.split(',').map(v => v.trim());
    
    return NextResponse.json({
        restricted: true,
        allowed_versions: allowedVersions,
        message: `Only versions ${allowedVersions.join(', ')} are allowed`
    });
}
