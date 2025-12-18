import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET /api/live-status
// Returns live status for each team (active player, current map, etc.)
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // Get latest status for each team from team_status table
        const { data: statusData, error: statusError } = await supabase
            .from('team_status')
            .select('*')
            .order('updated_at', { ascending: false });

        if (statusError) {
            console.error('[LiveStatus] Error fetching status:', statusError);
            return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
        }

        // Group by team and get the latest entry per team
        const teamStatus: Record<number, {
            active_player: string | null;
            current_map_name: string | null;
            current_map_status: string | null;
            maps_completed: number;
            updated_at: string;
        }> = {};

        // Process all entries, keeping the latest per team
        for (const entry of statusData || []) {
            const teamId = entry.team_id;
            if (!teamStatus[teamId] || new Date(entry.updated_at) > new Date(teamStatus[teamId].updated_at)) {
                teamStatus[teamId] = {
                    active_player: entry.active_player,
                    current_map_name: entry.current_map_name,
                    current_map_status: entry.current_map_status,
                    maps_completed: entry.maps_completed,
                    updated_at: entry.updated_at
                };
            }
        }

        // Return organized by team
        return NextResponse.json({
            teams: {
                1: teamStatus[1] || null,
                2: teamStatus[2] || null,
                3: teamStatus[3] || null,
                4: teamStatus[4] || null,
            }
        });
    } catch (error) {
        console.error('[LiveStatus] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
