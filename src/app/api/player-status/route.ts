import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface StatusPayload {
    account_id: string;
    player_name: string;
    action: 'set_active' | 'set_waiting' | 'set_spectator' | 'pass_turn';
}

export async function POST(request: Request) {
    try {
        const data: StatusPayload = await request.json();

        if (!data.account_id || !data.action) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get player's team from roster
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('team_assignment, trackmania_name')
            .or(`trackmania_id.eq.${data.account_id},trackmania_name.eq.${data.player_name}`)
            .eq('status', 'approved')
            .single();

        if (playerError || !player || !player.team_assignment) {
            return NextResponse.json({
                success: false,
                reason: 'not_in_roster'
            });
        }

        const teamId = player.team_assignment;
        const playerName = player.trackmania_name;

        // Get current team status
        const { data: teamStatus } = await supabase
            .from('team_status')
            .select('active_player, waiting_player, updated_at')
            .eq('team_id', teamId)
            .single();

        const currentActive = teamStatus?.active_player || null;
        const currentWaiting = teamStatus?.waiting_player || null;

        let newActive = currentActive;
        let newWaiting = currentWaiting;
        let result = { success: false, reason: '' };

        switch (data.action) {
            case 'set_active':
                // RACE CONDITION PROTECTION: "First come, first served"
                // We use updated_at as an optimistic lock
                const currentUpdatedAt = teamStatus?.updated_at || null;

                if (!currentActive) {
                    // No one active, attempt to become active with conditional update
                    const { data: updateResult, error: updateError } = await supabase
                        .from('team_status')
                        .update({
                            active_player: playerName,
                            waiting_player: currentWaiting,
                            updated_at: new Date().toISOString()
                        })
                        .eq('team_id', teamId)
                        .or(currentUpdatedAt
                            ? `updated_at.eq.${currentUpdatedAt}`
                            : 'updated_at.is.null')
                        .select()
                        .single();

                    if (updateError || !updateResult) {
                        // Race condition lost - someone else became active first
                        // Fetch current state and put this player in waiting
                        const { data: newState } = await supabase
                            .from('team_status')
                            .select('active_player, waiting_player')
                            .eq('team_id', teamId)
                            .single();

                        newActive = newState?.active_player || null;
                        newWaiting = playerName;

                        // Update waiting player
                        await supabase
                            .from('team_status')
                            .update({
                                waiting_player: playerName,
                                updated_at: new Date().toISOString()
                            })
                            .eq('team_id', teamId);

                        result = { success: true, reason: 'race_lost_added_to_waiting' };
                    } else {
                        // Successfully became active
                        newActive = playerName;
                        result = { success: true, reason: 'became_active' };
                    }
                } else if (currentActive === playerName) {
                    // Already active
                    result = { success: true, reason: 'already_active' };
                } else {
                    // Someone else is active, go to waiting
                    newWaiting = playerName;
                    result = { success: true, reason: 'added_to_waiting' };
                }
                break;

            case 'set_waiting':
                if (currentActive === playerName) {
                    // Active player going to waiting without passing turn
                    newActive = null;
                    newWaiting = playerName;
                } else {
                    newWaiting = playerName;
                }
                result = { success: true, reason: 'set_waiting' };
                break;

            case 'set_spectator':
                // Remove from active or waiting
                if (currentActive === playerName) {
                    newActive = currentWaiting; // Waiting becomes active
                    newWaiting = null;
                } else if (currentWaiting === playerName) {
                    newWaiting = null;
                }
                result = { success: true, reason: 'set_spectator' };
                break;

            case 'pass_turn':
                if (currentActive !== playerName) {
                    result = { success: false, reason: 'not_active' };
                    break;
                }
                // Pass to waiting player
                if (currentWaiting) {
                    newActive = currentWaiting;
                    newWaiting = playerName;
                    result = { success: true, reason: 'passed_turn' };
                } else {
                    result = { success: false, reason: 'no_waiting_player' };
                }
                break;
        }

        // Update if changes were made
        if (newActive !== currentActive || newWaiting !== currentWaiting) {
            await supabase
                .from('team_status')
                .update({
                    active_player: newActive,
                    waiting_player: newWaiting,
                    updated_at: new Date().toISOString()
                })
                .eq('team_id', teamId);
        }

        return NextResponse.json({
            ...result,
            active_player: newActive,
            waiting_player: newWaiting
        });

    } catch (error) {
        console.error('[PlayerStatus] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET to check current status for a team
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('team_id');

        if (!teamId) {
            return NextResponse.json({ error: 'Missing team_id' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('team_status')
            .select('active_player, waiting_player')
            .eq('team_id', parseInt(teamId))
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            active_player: data?.active_player || null,
            waiting_player: data?.waiting_player || null
        });

    } catch (error) {
        console.error('[PlayerStatus] GET Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
