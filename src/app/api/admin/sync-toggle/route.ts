import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SETTING_KEY = 'sync_enabled';

// GET: Check if sync is enabled
export async function GET() {
    const supabase = getSupabaseAdmin();
    
    const { data } = await supabase
        .from('event_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .single();
    
    // Default to false (sync disabled) if not set
    const enabled = data?.value === 'true';
    
    return NextResponse.json({ enabled });
}

// PUT: Toggle sync enabled/disabled
export async function PUT(request: Request) {
    try {
        const { enabled } = await request.json();
        const supabase = getSupabaseAdmin();
        
        const { error } = await supabase
            .from('event_settings')
            .upsert({
                key: SETTING_KEY,
                value: enabled ? 'true' : 'false',
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Log the change
        await supabase.from('event_log').insert({
            event_type: 'milestone',
            team_id: 0,
            message: `[Admin] Plugin sync ${enabled ? 'ENABLED' : 'DISABLED'}`,
            metadata: { admin_action: true, sync_enabled: enabled }
        });
        
        return NextResponse.json({ success: true, enabled });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
