import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET /api/team-progress
// Returns team progression (maps_completed) for all teams
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();
        
        const { data, error } = await supabase
            .from('team_status')
            .select('team_id, maps_completed, updated_at')
            .order('team_id');
        
        if (error) {
            console.error('[TeamProgress] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Also try team_progress table if team_status doesn't have maps_completed
        if (!data || data.length === 0 || data.every(d => d.maps_completed === null || d.maps_completed === undefined)) {
            const { data: progressData, error: progressError } = await supabase
                .from('team_progress')
                .select('team_id, maps_completed, updated_at')
                .order('team_id');
            
            if (!progressError && progressData && progressData.length > 0) {
                return NextResponse.json(progressData);
            }
        }
        
        return NextResponse.json(data || []);
    } catch (error) {
        console.error('[TeamProgress] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
