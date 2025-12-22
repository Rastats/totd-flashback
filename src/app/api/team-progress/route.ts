import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET /api/team-progress
// Returns team progression (maps_completed) for all teams from team_server_state
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();
        
        const { data, error } = await supabase
            .from('team_server_state')
            .select('team_id, maps_completed, updated_at')
            .order('team_id');
        
        if (error) {
            console.error('[TeamProgress] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Transform to ensure consistent format
        const teams = (data || []).map(d => ({
            team_id: d.team_id,
            maps_completed: d.maps_completed || 0,
            updated_at: d.updated_at
        }));
        
        return NextResponse.json(teams);
    } catch (error) {
        console.error('[TeamProgress] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
