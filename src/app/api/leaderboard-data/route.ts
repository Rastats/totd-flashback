import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { TEAMS } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Build team metadata from config
const TEAM_META = Object.fromEntries(
    TEAMS.map(t => [t.number, { name: t.name, color: t.color }])
);

// GET /api/leaderboard-data
// Combined endpoint returning all data needed for leaderboard in one call
// Replaces: /api/live-status, /api/penalty-status (x4), /api/admin/shields
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();
        const now = new Date();

        // Get all team statuses in one query
        const { data: statusData, error: statusError } = await supabase
            .from('team_server_state')
            .select('*')
            .order('updated_at', { ascending: false });

        if (statusError) {
            console.error('[LeaderboardData] Error:', statusError);
            return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
        }

        // Get plugin state for current map info (written by plugin sync)
        const { data: pluginData } = await supabase
            .from('team_plugin_state')
            .select('team_id, current_map_id, current_map_index, current_map_name, current_map_author, updated_at')
            .order('team_id');

        // Process all teams data
        const teams = [];
        for (let teamId = 1; teamId <= 4; teamId++) {
            const teamMeta = TEAM_META[teamId] as { name: string; color: string };
            const entry = statusData?.find(e => e.team_id === teamId);
            const pluginEntry = pluginData?.find(p => p.team_id === teamId);

            // Calculate online status
            let isOnline = false;
            if (entry?.updated_at) {
                const updatedAt = new Date(entry.updated_at);
                isOnline = (now.getTime() - updatedAt.getTime()) < 60000;
            }


            // Calculate shield remaining time and cooldowns
            let shieldData: any = null;

            // Active shield
            if (entry?.shield_active && entry?.shield_expires_at) {
                const remainingMs = Math.max(0, new Date(entry.shield_expires_at).getTime() - now.getTime());
                if (remainingMs > 0) {
                    shieldData = {
                        active: true,
                        type: entry.shield_type,
                        remaining_ms: remainingMs
                    };
                }
            }

            // Cooldowns (even if no active shield)
            if (!shieldData) {
                shieldData = { active: false };
            }

            // Small shield cooldown
            if (entry?.shield_small_cooldown_expires_at) {
                const smallCooldownMs = Math.max(0, new Date(entry.shield_small_cooldown_expires_at).getTime() - now.getTime());
                if (smallCooldownMs > 0) {
                    shieldData.small_cooldown_ms = smallCooldownMs;
                }
            }

            // Big shield cooldown
            if (entry?.shield_big_cooldown_expires_at) {
                const bigCooldownMs = Math.max(0, new Date(entry.shield_big_cooldown_expires_at).getTime() - now.getTime());
                if (bigCooldownMs > 0) {
                    shieldData.big_cooldown_ms = bigCooldownMs;
                }
            }

            // Process penalties (active + waitlist)
            const activePenalties = (entry?.penalties_active || []).map((p: any) => {
                // Calculate remaining time from timer_expires_at
                let timerRemainingMs = 0;
                if (p.timer_expires_at) {
                    timerRemainingMs = Math.max(0, new Date(p.timer_expires_at).getTime() - now.getTime());
                }

                return {
                    name: p.name || `Penalty ${p.id}`,
                    penalty_id: p.penalty_id,
                    is_active: true,
                    maps_remaining: p.maps_remaining ?? null,
                    maps_total: p.maps_total ?? null,
                    timer_remaining_ms: timerRemainingMs,
                    timer_expires_at: p.timer_expires_at
                };
            });

            const waitlistPenalties = (entry?.penalties_waitlist || []).map((p: any) => ({
                name: p.name || `Penalty ${p.id}`,
                is_active: false
            }));

            teams.push({
                id: teamId,
                name: teamMeta.name,
                color: teamMeta.color,
                activePlayer: entry?.active_player || null,
                waitingPlayer: entry?.waiting_player || null,
                currentMapId: pluginEntry?.current_map_id || pluginEntry?.current_map_index || null,
                currentMapName: pluginEntry?.current_map_name || null,
                currentMapAuthor: pluginEntry?.current_map_author || null,
                mapsCompleted: entry?.maps_completed || 0,
                potAmount: entry?.pot_amount || 0,
                potCurrency: entry?.pot_currency || 'GBP',
                lastUpdated: entry?.updated_at || null,
                isOnline,
                sessionElapsedMs: entry?.session_elapsed_ms || null,
                sessionRemainingMs: entry?.session_remaining_ms || null,
                shield: shieldData,
                penalties: {
                    active: activePenalties,
                    waitlist: waitlistPenalties
                }
            });
        }

        return NextResponse.json({
            teams,
            timestamp: now.toISOString(),
        });
    } catch (error) {
        console.error('[LeaderboardData] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
