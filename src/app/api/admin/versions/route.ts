import { NextResponse } from 'next/server';

// Note: This endpoint reads/writes environment variables
// In production, you'd need to use Vercel API to update env vars
// For now, this returns the current value and logs the update request

// GET: Get current allowed versions
export async function GET() {
    const allowedVersions = process.env.ALLOWED_PLUGIN_VERSIONS || '';
    const versions = allowedVersions ? allowedVersions.split(',').map(v => v.trim()) : [];
    
    return NextResponse.json({
        restricted: versions.length > 0,
        versions: versions,
        raw: allowedVersions
    });
}

// PUT: Update allowed versions (logs only - manual env update required)
export async function PUT(request: Request) {
    try {
        const { versions } = await request.json();
        
        if (!Array.isArray(versions)) {
            return NextResponse.json({ error: 'versions must be an array' }, { status: 400 });
        }
        
        const versionString = versions.join(',');
        
        // Log the requested change (actual update requires Vercel dashboard or API)
        console.log(`[Admin] Version update requested: ${versionString}`);
        
        return NextResponse.json({ 
            success: true,
            message: 'Version update logged. Please update ALLOWED_PLUGIN_VERSIONS in Vercel dashboard.',
            requested_value: versionString
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
