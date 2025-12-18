import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Team metadata
const TEAMS = {
    1: { name: 'Team 1', color: '#60a5fa' },
    2: { name: 'Team 2', color: '#fbbf24' },
    3: { name: 'Team 3', color: '#f472b6' },
    4: { name: 'Team 4', color: '#34d399' },
};

interface TeamLiveStatus {
    id: number;
    name: string;
    color: string;
    activePlayer: string | null;
    currentMapName: string | null;
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
            const teamMeta = TEAMS[teamId as keyof typeof TEAMS];

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
                currentMapName: entry?.current_map_name || null,
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

