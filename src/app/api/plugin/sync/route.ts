import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const API_KEY = process.env.FLASHBACK_API_KEY || 'FLASHBACK_2024_TF_X7K9M2';

// Rate limiting
const lastRequestTime: Map<string, number> = new Map();
const MIN_REQUEST_INTERVAL = 5000; // 5s minimum between requests

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
 * Parse team_assignment which can be:
 * - Integer: 1, 2, 3, 4
 * - String: "team1", "team2", "team3", "team4" 
 * - String: "joker" (returns null, joker must set team_id)
 */
function parseTeamId(teamAssignment: any): number | null {
    if (typeof teamAssignment === 'number') {
        return teamAssignment >= 1 && teamAssignment <= 4 ? teamAssignment : null;
    }
    if (typeof teamAssignment === 'string') {
        if (teamAssignment === 'joker') return null;
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

        const data: SyncPayload = await request.json();

        // Validate required fields
        if (!data.account_id || !data.player_name) {
            return NextResponse.json({ 
                error: 'Missing required fields: account_id, player_name' 
            }, { status: 400 });
        }

        // Rate limiting per account
        const now = Date.now();
        const lastTime = lastRequestTime.get(data.account_id) || 0;
        if (now - lastTime < MIN_REQUEST_INTERVAL) {
            return NextResponse.json({ 
                error: 'Rate limited',
                retry_after_ms: MIN_REQUEST_INTERVAL - (now - lastTime)
            }, { status: 429 });
        }
        lastRequestTime.set(data.account_id, now);

        const supabase = getSupabaseAdmin();

        // ============================================
        // 1. Check if player is in roster
        // ============================================
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id, trackmania_name, team_assignment, status')
            .eq('account_id', data.account_id)
            .eq('status', 'approved')
            .single();

        if (playerError || !player) {
            return NextResponse.json({
                success: false,
                reason: 'not_in_roster'
            });
        }

        const teamId = parseTeamId(player.team_assignment);
        if (!teamId) {
            return NextResponse.json({
                success: false,
                reason: player.team_assignment === 'joker' ? 'joker_no_team_selected' : 'no_team_assigned'
            });
        }

        // ============================================
        // 2. Write plugin state to team_plugin_state
        // ============================================
        const { error: upsertError } = await supabase
            .from('team_plugin_state')
            .upsert({
                account_id: data.account_id,
                player_name: data.player_name,
                current_map_id: data.current_map_id || null,
                current_map_index: data.current_map_index || null,
                current_map_name: data.current_map_name || null,
                current_map_author: data.current_map_author || null,
                mode: data.mode || 'Normal',
                session_elapsed_ms: data.session_elapsed_ms || 0,
                plugin_version: data.plugin_version || null,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'account_id'
            });

        if (upsertError) {
            console.error('[Plugin Sync] Upsert error:', upsertError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
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
        // 4. Get donations data
        // ============================================
        // TODO: Add Tiltify donations fetch here
        const donationsData = {
            totalAmount: 0,
            currency: 'GBP',
            goal: 2000,
            teamPots: [0, 0, 0, 0],
            recentDonations: []
        };

        // ============================================
        // 5. Return comprehensive response
        // ============================================
        return NextResponse.json({
            success: true,
            team_id: teamId,
            player: player.trackmania_name,

            // Server state (authoritative)
            serverState: {
                maps_completed: serverState?.maps_completed || 0,
                completed_map_ids: serverState?.completed_map_ids || [],
                active_player: serverState?.active_player || null,
                waiting_player: serverState?.waiting_player || null,
                penalties_active: serverState?.penalties_active || [],
                penalties_waitlist: serverState?.penalties_waitlist || [],
                redo_remaining: serverState?.redo_remaining || 0,
                redo_map_ids: serverState?.redo_map_ids || [],
                shield_active: serverState?.shield_active || false,
                shield_type: serverState?.shield_type || null,
                shield_expires_at: serverState?.shield_expires_at || null,
                shield_cooldown_expires_at: serverState?.shield_cooldown_expires_at || null,
                pot_amount: serverState?.pot_amount || 0
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
