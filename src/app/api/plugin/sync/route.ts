import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const API_KEY = process.env.FLASHBACK_API_KEY || 'FLASHBACK_2024_TF_X7K9M2';


// Stale player cleanup - remove active/waiting players after 60s of no sync
const STALE_TIMEOUT_MS = 60000; // 60 seconds
let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 30000; // Only run cleanup every 30s max

// Stale plugin state cleanup - clear after 15 minutes of inactivity
const PLUGIN_STATE_STALE_MS = 15 * 60 * 1000; // 15 minutes
let lastPluginCleanupTime = 0;

interface SyncPayload {
    account_id: string;
    player_name: string;
    current_map_id?: string;
    current_map_index?: number;
    current_map_name?: string;
    current_map_author?: string;
    mode?: string;
    session_elapsed_ms?: number;
    plugin_version?: string;
}

/**
 * Parse team_id which can be:
 * - Integer: 1, 2, 3, 4
 * - String: "team1", "team2", "team3", "team4" 
 * - String: "Team Speedrun" (=1), "Team B2" (=2), "Team BITM" (=3), "Team 4" (=4)
 * - String: "joker" (returns null, joker must set team_id)
 */
function parseTeamId(teamAssignment: any): number | null {
    if (typeof teamAssignment === 'number') {
        return teamAssignment >= 1 && teamAssignment <= 4 ? teamAssignment : null;
    }
    if (typeof teamAssignment === 'string') {
        if (teamAssignment === 'joker') return null;

        // Map team names to IDs
        const teamNameMap: Record<string, number> = {
            'team speedrun': 1,
            'team b2': 2,
            'team bitm': 3,
            'team 4': 4
        };
        const lowerName = teamAssignment.toLowerCase();
        if (teamNameMap[lowerName]) return teamNameMap[lowerName];

        // Try "teamN" format
        const match = teamAssignment.match(/team(\d+)/i);
        if (match) {
            const num = parseInt(match[1]);
            return num >= 1 && num <= 4 ? num : null;
        }
        // Try direct number string
        const num = parseInt(teamAssignment);
        return !isNaN(num) && num >= 1 && num <= 4 ? num : null;
    }
    return null;
}

/**
 * Cleanup stale active/waiting players
 * Removes players from active_player and waiting_player columns
 * if their updated_at is older than STALE_TIMEOUT_MS (60s)
 */
async function cleanupStalePlayers(supabase: any) {
    const now = Date.now();

    // Only run cleanup every 30s to avoid excessive DB calls
    if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
        return;
    }
    lastCleanupTime = now;

    const cutoffTime = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString();

    // Get teams with stale active/waiting players
    const { data: staleTeams, error } = await supabase
        .from('team_server_state')
        .select('team_id, active_player, waiting_player, updated_at')
        .or(`active_player.neq.,waiting_player.neq.`)
        .lt('updated_at', cutoffTime);

    if (error || !staleTeams || staleTeams.length === 0) {
        return;
    }

    // Clear stale players
    for (const team of staleTeams) {
        const updates: any = { updated_at: new Date().toISOString() };
        if (team.active_player) {
            updates.active_player = null;
            console.log(`[Cleanup] Removing stale active player from team ${team.team_id}: ${team.active_player}`);
        }
        if (team.waiting_player) {
            updates.waiting_player = null;
            console.log(`[Cleanup] Removing stale waiting player from team ${team.team_id}: ${team.waiting_player}`);
        }

        await supabase
            .from('team_server_state')
            .update(updates)
            .eq('team_id', team.team_id);
    }
}

/**
 * Cleanup stale plugin state for teams inactive > 15 minutes
 * Clears all columns except team_id and updated_at
 */
async function cleanupStalePluginState(supabase: any) {
    const now = Date.now();

    // Only run cleanup every 30s to avoid excessive DB calls
    if (now - lastPluginCleanupTime < CLEANUP_INTERVAL_MS) {
        return;
    }
    lastPluginCleanupTime = now;

    const cutoffTime = new Date(now - PLUGIN_STATE_STALE_MS).toISOString();

    // Find stale team_plugin_state entries
    const { data: staleRows, error } = await supabase
        .from('team_plugin_state')
        .select('team_id, updated_at')
        .lt('updated_at', cutoffTime);

    if (error || !staleRows || staleRows.length === 0) {
        return;
    }

    // Clear stale plugin state (keep only team_id and updated_at)
    for (const row of staleRows) {
        console.log(`[Cleanup] Clearing stale plugin state for team ${row.team_id} (inactive > 15 min)`);

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
                plugin_version: null
                // Keep: team_id (key), updated_at (stays as-is from query)
            })
            .eq('team_id', row.team_id);
    }
}

/**
 * POST /api/plugin/sync
 * 
 * Plugin sends its state, receives server state + donations
 * This is the main sync endpoint called every 10 seconds
 */
export async function POST(request: NextRequest) {
    try {
        // Validate API key
        const apiKey = request.headers.get('X-API-Key');
        if (apiKey !== API_KEY) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const data = await request.json();

        // Handle public_only requests (no auth needed, just returns team data)
        if (data.public_only === true) {
            const supabase = getSupabaseAdmin();

            // Get all teams progress for leaderboard
            const allTeamsProgress = await getAllTeamsProgress(supabase);

            // Get team pots
            const { data: teamStates } = await supabase
                .from('team_server_state')
                .select('team_id, pot_amount')
                .order('team_id');

            const teamPots = teamStates?.map((t: any) => ({
                team_id: t.team_id,
                pot_amount: t.pot_amount || 0
            })) || [];

            return NextResponse.json({
                success: true,
                donations: {
                    totalAmount: teamPots.reduce((sum: number, t: any) => sum + t.pot_amount, 0),
                    currency: 'GBP',
                    teamPots: teamPots
                },
                allTeamsProgress
            });
        }

        // From here on, require full authentication
        const syncData: SyncPayload = data;

        // Validate required fields
        // Lightweight polls only need account_id, full syncs need player_name too
        if (!syncData.account_id) {
            return NextResponse.json({
                error: 'Missing required field: account_id'
            }, { status: 400 });
        }

        // For non-lightweight requests, player_name is required
        if (!data.lightweight && !syncData.player_name) {
            return NextResponse.json({
                error: 'Missing required field: player_name'
            }, { status: 400 });
        }
        // NOTE: Rate limiting removed - doesn't work with serverless (each instance has its own Map)
        // The plugin enforces its own rate limiting (10s minimum between syncs)


        const supabase = getSupabaseAdmin();

        // Cleanup stale active/waiting players (runs max once per 30s)
        await cleanupStalePlayers(supabase);

        // Cleanup stale plugin state > 15 min (runs max once per 30s)
        await cleanupStalePluginState(supabase);

        // ============================================
        // 1. Check if player is in roster
        // ============================================
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id, trackmania_name, team_id, status')
            .eq('trackmania_id', syncData.account_id)
            .eq('status', 'approved')
            .single();

        if (playerError || !player) {
            return NextResponse.json({
                success: false,
                reason: 'not_in_roster'
            });
        }

        const teamId = parseTeamId(player.team_id);
        if (!teamId) {
            return NextResponse.json({
                success: false,
                reason: player.team_id === 0 ? 'joker_no_team_selected' : 'no_team_assigned'
            });
        }

        // ============================================
        // 2. Write plugin state to team_plugin_state (skip for lightweight polls)
        // ============================================
        if (!data.lightweight && syncData.player_name) {
            const { error: upsertError } = await supabase
                .from('team_plugin_state')
                .upsert({
                    team_id: teamId, // Use team_id as primary key
                    account_id: syncData.account_id,
                    player_name: syncData.player_name,
                    current_map_id: syncData.current_map_id || null,
                    current_map_index: syncData.current_map_index || null,
                    current_map_name: syncData.current_map_name || null,
                    current_map_author: syncData.current_map_author || null,
                    mode: syncData.mode || 'Normal',
                    session_elapsed_ms: syncData.session_elapsed_ms || 0,
                    plugin_version: syncData.plugin_version || null,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'team_id' // Key on team_id, not account_id
                });

            if (upsertError) {
                console.error('[Plugin Sync] Upsert error:', upsertError);
                return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }

            // CRITICAL: Also update team_server_state.updated_at to prevent cleanup from clearing active_player
            // The cleanup checks team_server_state.updated_at, not team_plugin_state.updated_at
            await supabase
                .from('team_server_state')
                .update({ updated_at: new Date().toISOString() })
                .eq('team_id', teamId);
        }

        // ============================================
        // 3. Read server state for this team
        // ============================================
        const { data: serverState, error: serverError } = await supabase
            .from('team_server_state')
            .select('*')
            .eq('team_id', teamId)
            .single();

        if (serverError) {
            console.error('[Plugin Sync] Server state error:', serverError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        // ============================================
        // 3b. Auto-promote Waiting → Active if Active slot is empty
        // ============================================
        let updatedServerState = serverState;
        if (!serverState?.active_player && serverState?.waiting_player) {
            console.log(`[Plugin Sync] Auto-promoting ${serverState.waiting_player} from Waiting to Active`);
            const { data: promoted, error: promoteError } = await supabase
                .from('team_server_state')
                .update({
                    active_player: serverState.waiting_player,
                    waiting_player: null,
                    updated_at: new Date().toISOString()
                })
                .eq('team_id', teamId)
                .select('*')
                .single();

            if (!promoteError && promoted) {
                updatedServerState = promoted;
            }
        }

        // ============================================
        // 4. Get donations data from database
        // ============================================
        // Fetch team pots from team_server_state
        const { data: allTeamPots } = await supabase
            .from('team_server_state')
            .select('team_id, pot_amount')
            .order('team_id');

        const teamPots = allTeamPots?.map((t: any) => ({
            team_id: t.team_id,
            pot_amount: t.pot_amount || 0
        })) || [
                { team_id: 1, pot_amount: 0 },
                { team_id: 2, pot_amount: 0 },
                { team_id: 3, pot_amount: 0 },
                { team_id: 4, pot_amount: 0 }
            ];

        const totalAmount = teamPots.reduce((sum: number, t: any) => sum + t.pot_amount, 0);

        const donationsData = {
            totalAmount: totalAmount,
            currency: 'GBP',
            goal: 2000,
            teamPots: teamPots,
            recentDonations: []
        };

        // ============================================
        // 5. Process penalties and return response
        // ============================================
        const now = new Date();
        const processedActive = (serverState?.penalties_active || []).map((p: any) => {
            let timer_remaining_ms = 0;
            if (p.timer_expires_at) {
                timer_remaining_ms = Math.max(0, new Date(p.timer_expires_at).getTime() - now.getTime());
            }
            return { ...p, timer_remaining_ms };
        });

        return NextResponse.json({
            success: true,
            team_id: teamId,
            player: player.trackmania_name,

            // Server state (authoritative) - use updatedServerState for status after auto-promotion
            serverState: {
                maps_completed: updatedServerState?.maps_completed || 0,
                completed_map_ids: updatedServerState?.completed_map_ids || [],
                active_player: updatedServerState?.active_player || null,
                waiting_player: updatedServerState?.waiting_player || null,
                penalties_active: processedActive,
                penalties_waitlist: updatedServerState?.penalties_waitlist || [],
                redo_remaining: updatedServerState?.redo_remaining || 0,
                redo_map_ids: updatedServerState?.redo_map_ids || [],
                shield_active: updatedServerState?.shield_active || false,
                shield_type: updatedServerState?.shield_type || null,
                shield_expires_at: updatedServerState?.shield_expires_at || null,
                shield_small_cooldown_expires_at: updatedServerState?.shield_small_cooldown_expires_at || null,
                shield_big_cooldown_expires_at: updatedServerState?.shield_big_cooldown_expires_at || null,
                pot_amount: updatedServerState?.pot_amount || 0
            },

            // Donations
            donations: donationsData,

            // All teams progress (for leaderboard)
            allTeamsProgress: await getAllTeamsProgress(supabase)
        });

    } catch (error) {
        console.error('[Plugin Sync] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Helper to get all teams progress
async function getAllTeamsProgress(supabase: any) {
    const { data: teams } = await supabase
        .from('team_server_state')
        .select('team_id, maps_completed, active_player, updated_at')
        .order('team_id');

    if (!teams) return [];

    const now = Date.now();
    return teams.map((t: any) => {
        const updatedAt = new Date(t.updated_at).getTime();
        const isOffline = (now - updatedAt) > 45000; // 45s timeout

        return {
            team_id: t.team_id,
            maps_completed: t.maps_completed || 0,
            active_player: isOffline ? null : (t.active_player || null)
        };
    });
}
