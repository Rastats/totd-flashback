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
    mapsCompleted: number;
    potAmount: number;
    potCurrency: string;
    lastUpdated: string | null;
    isOnline: boolean; // true if updated in last 60 seconds
}

// GET /api/live-status
// Returns live status for each team (active player, current map, etc.)
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // Get latest status for each team from team_server_state table
        const { data: statusData, error: statusError } = await supabase
            .from('team_server_state')
            .select('*')
            .order('updated_at', { ascending: false });

        if (statusError) {
            console.error('[LiveStatus] Error fetching status:', statusError);
            return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
        }

        // Cleanup stale players (active_player still set but not synced for >60s)
        const STALE_TIMEOUT_MS = 60000;
        const cutoffTime = new Date(Date.now() - STALE_TIMEOUT_MS);

        for (const entry of (statusData || [])) {
            if (entry.updated_at && new Date(entry.updated_at) < cutoffTime) {
                // Team is stale - clear active_player if set
                if (entry.active_player || entry.waiting_player) {
                    await supabase
                        .from('team_server_state')
                        .update({
                            active_player: null,
                            waiting_player: null,
                            updated_at: new Date().toISOString()
                        })
                        .eq('team_id', entry.team_id);

                    // Update local data for response
                    entry.active_player = null;
                    entry.waiting_player = null;
                    console.log(`[LiveStatus] Cleared stale player for team ${entry.team_id}`);
                }
            }
        }

        // Cleanup stale team_plugin_state (>5 min) - clear all columns except team_id
        const PLUGIN_STALE_MS = 5 * 60 * 1000; // 5 minutes
        const pluginCutoffTime = new Date(Date.now() - PLUGIN_STALE_MS);

        const { data: pluginData } = await supabase
            .from('team_plugin_state')
            .select('team_id, updated_at, player_name');

        for (const row of (pluginData || [])) {
            if (row.updated_at && new Date(row.updated_at) < pluginCutoffTime && row.player_name) {
                console.log(`[LiveStatus] Clearing stale plugin state for team ${row.team_id}`);
                await supabase
                    .from('team_plugin_state')
                    .update({
                        account_id: null,
                        player_name: null,
                        current_map_id: null,
                        current_map_index: null,
                        current_map_name: null,
                        current_map_author: null,
                        mode: null,
                        session_elapsed_ms: null,
                        plugin_version: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('team_id', row.team_id);
            }
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
                // NOTE: current_map_status removed - column doesn't exist
                mapsCompleted: entry?.maps_completed || 0,
                potAmount: entry?.pot_amount || 0,
                potCurrency: 'GBP',
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

