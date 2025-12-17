import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Structure expected from the plugin
interface SyncPayload {
    account_id: string;
    team_id: number;
    timestamp: number;

    players: {
        active: string;
        waiting: string;
        joker_used: boolean;
    };

    current_map: {
        id: number;
        name: string;
        author: string;
        status: string;
    };

    progress: {
        maps_completed: number;
        maps_total: number;
        speedrun_time_ms: number;
        redo_remaining: number;
    };

    penalties: {
        active: Array<{
            id: number;
            name: string;
            maps_remaining: number;
            timer_remaining_ms: number | null;
        }>;
        waitlist: Array<{
            id: number;
            name: string;
        }>;
    };

    shield: {
        active: boolean;
        type: string;
        remaining_ms: number;
        cooldown_remaining_ms: number;
    };

    mode: string;
}

export async function POST(request: Request) {
    try {
        const data: SyncPayload = await request.json();

        if (!data.account_id) {
            return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Check if account_id is in the players roster
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id, trackmania_name, team_assignment, trackmania_id')
            .or(`trackmania_id.eq.${data.account_id},trackmania_name.eq.${data.account_id}`)
            .eq('status', 'approved')
            .single();

        if (playerError || !player) {
            // Not in roster - ignore but don't error
            console.log(`[Sync] Account ${data.account_id} not in roster, ignoring`);
            return NextResponse.json({
                success: false,
                reason: 'not_in_roster'
            });
        }

        // Parse team_assignment from string "team4" to integer 4
        let teamId: number;
        const teamAssignment = player.team_assignment;

        if (teamAssignment && typeof teamAssignment === 'string' && teamAssignment.startsWith('team')) {
            teamId = parseInt(teamAssignment.replace('team', ''), 10);
        } else if (typeof teamAssignment === 'number') {
            teamId = teamAssignment;
        } else {
            // Joker or invalid - use team_id from plugin
            teamId = data.team_id;
        }

        if (!teamId || teamId < 1 || teamId > 4) {
            return NextResponse.json({
                success: false,
                reason: 'invalid_team'
            });
        }

        // Upsert into team_status table
        const { error: upsertError } = await supabase
            .from('team_status')
            .upsert({
                team_id: teamId,
                player_name: player.trackmania_name,
                account_id: data.account_id,

                // Players
                active_player: data.players?.active || null,
                waiting_player: data.players?.waiting || null,
                joker_used: data.players?.joker_used || false,

                // Current map
                current_map_id: data.current_map?.id || null,
                current_map_name: data.current_map?.name || null,
                current_map_author: data.current_map?.author || null,
                current_map_status: data.current_map?.status || null,

                // Progress
                maps_completed: data.progress?.maps_completed || 0,
                maps_total: data.progress?.maps_total || 2000,
                speedrun_time_ms: data.progress?.speedrun_time_ms || 0,
                redo_remaining: data.progress?.redo_remaining || 0,

                // Penalties (stored as JSONB)
                penalties_active: data.penalties?.active || [],
                penalties_waitlist: data.penalties?.waitlist || [],

                // Shield
                shield_active: data.shield?.active || false,
                shield_type: data.shield?.type || null,
                shield_remaining_ms: data.shield?.remaining_ms || 0,
                shield_cooldown_ms: data.shield?.cooldown_remaining_ms || 0,

                // Mode
                mode: data.mode || 'Normal',

                // Timestamp
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'team_id'
            });

        if (upsertError) {
            console.error('[Sync] Upsert error:', upsertError);
            return NextResponse.json({
                error: upsertError.message
            }, { status: 500 });
        }

        console.log(`[Sync] Team ${teamId} updated by ${player.trackmania_name}`);

        return NextResponse.json({
            success: true,
            team_id: teamId,
            player: player.trackmania_name
        });

    } catch (error) {
        console.error('[Sync] Error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// GET endpoint to retrieve current team statuses (for dashboard)
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        const { data: statuses, error } = await supabase
            .from('team_status')
            .select('*')
            .order('team_id', { ascending: true });

        if (error) {
            console.error('[Sync] GET error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(statuses || []);

    } catch (error) {
        console.error('[Sync] GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
