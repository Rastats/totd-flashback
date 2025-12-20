import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { TEAMS } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Build team metadata from config
const TEAM_META = Object.fromEntries(
    TEAMS.map(t => [t.number, { name: t.name, color: t.color }])
);

interface TeamLiveStatus {
    id: number;
    name: string;
    color: string;
    activePlayer: string | null;
    currentMapId: number | null;
    currentMapName: string | null;
    currentMapAuthor: string | null;
    currentMapStatus: string | null;
    mapsCompleted: number;
    lastUpdated: string | null;
    isOnline: boolean; // true if updated in last 60 seconds
}

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

        const now = new Date();
        const teams: TeamLiveStatus[] = [];

        // Process each team
        for (let teamId = 1; teamId <= 4; teamId++) {
            const teamMeta = TEAM_META[teamId];

            // Find latest entry for this team
            const entry = statusData?.find(e => e.team_id === teamId);

            let isOnline = false;
            if (entry?.updated_at) {
                const updatedAt = new Date(entry.updated_at);
                isOnline = (now.getTime() - updatedAt.getTime()) < 60000; // 60 seconds
            }

            teams.push({
                id: teamId,
                name: teamMeta.name,
                color: teamMeta.color,
                activePlayer: entry?.active_player || null,
                currentMapId: entry?.current_map_id || null,
                currentMapName: entry?.current_map_name || null,
                currentMapAuthor: entry?.current_map_author || null,
                currentMapStatus: entry?.current_map_status || null,
                mapsCompleted: entry?.maps_completed || 0,
                lastUpdated: entry?.updated_at || null,
                isOnline,
            });
        }

        return NextResponse.json({
            teams,
            timestamp: now.toISOString(),
        });
    } catch (error) {
        console.error('[LiveStatus] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

