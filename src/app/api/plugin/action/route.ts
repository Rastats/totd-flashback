import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { insertSortedDesc, calculateHighestUnfinished, sortDescending } from '@/lib/progress-utils';

const API_KEY = process.env.FLASHBACK_API_KEY || 'FLASHBACK_2024_TF_X7K9M2';

type ActionType =
    | 'map_completed'
    | 'redo_map_completed'
    | 'penalty_activated'
    | 'penalty_completed'
    | 'set_active'
    | 'set_waiting'
    | 'set_spectator'
    | 'pass_turn'
    | 'joker_change_team'
    | 'update_redo_maps';

interface ActionPayload {
    account_id: string;
    action: ActionType;
    map_index?: number;
    penalty_id?: number | string;
    team_id?: number;
    redo_map_ids?: number[];
    redo_remaining?: number;
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
 * POST /api/plugin/action
 * 
 * Plugin sends actions to modify server state
 * Actions are atomic operations that update team_server_state
 */
export async function POST(request: NextRequest) {
    try {
        // Validate API key
        const apiKey = request.headers.get('X-API-Key');
        if (apiKey !== API_KEY) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        const data: ActionPayload = await request.json();

        // Validate required fields
        if (!data.account_id || !data.action) {
            return NextResponse.json({
                error: 'Missing required fields: account_id, action'
            }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get player's team
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id, trackmania_name, team_id, status')
            .eq('trackmania_id', data.account_id)
            .eq('status', 'approved')
            .single();

        if (playerError || !player) {
            return NextResponse.json({
                success: false,
                error: 'Player not in roster'
            }, { status: 403 });
        }

        // Parse team_id (can be int or 0 for joker)
        let teamId = parseTeamId(player.team_id);
        const isJoker = player.team_id === 0;

        // Handle joker team change
        if (data.action === 'joker_change_team') {
            if (!data.team_id || data.team_id < 1 || data.team_id > 4) {
                return NextResponse.json({
                    success: false,
                    error: 'Invalid team_id for joker_change_team'
                }, { status: 400 });
            }
            teamId = data.team_id;
        } else if (isJoker && data.team_id) {
            // Joker sending action with team_id in payload
            teamId = data.team_id;
        }

        if (!teamId) {
            return NextResponse.json({
                success: false,
                error: isJoker ? 'Joker must select a team first' : 'No team assigned'
            }, { status: 400 });
        }

        // Get current server state
        const { data: state, error: stateError } = await supabase
            .from('team_server_state')
            .select('*')
            .eq('team_id', teamId)
            .single();

        if (stateError || !state) {
            return NextResponse.json({
                success: false,
                error: 'Team state not found'
            }, { status: 404 });
        }

        // Process action
        let updateData: any = { updated_at: new Date().toISOString() };
        let message = '';

        switch (data.action) {
            // ============================================
            // MAP COMPLETED
            // ============================================
            case 'map_completed': {
                if (!data.map_index || data.map_index < 1 || data.map_index > 2000) {
                    return NextResponse.json({
                        success: false,
                        error: 'Invalid map_index (must be 1-2000)'
                    }, { status: 400 });
                }

                const completedIds: number[] = state.completed_map_ids || [];
                if (!completedIds.includes(data.map_index)) {
                    // Ensure list is sorted desc, then insert at correct position
                    const sortedIds = completedIds.length > 0 && completedIds[0] < completedIds[completedIds.length - 1]
                        ? sortDescending(completedIds)
                        : completedIds;
                    updateData.completed_map_ids = insertSortedDesc(sortedIds, data.map_index);
                    updateData.maps_completed = updateData.completed_map_ids.length;
                    updateData.highest_unfinished_id = calculateHighestUnfinished(updateData.completed_map_ids);
                    message = `Map ${data.map_index} completed (highest unfinished: ${updateData.highest_unfinished_id})`;

                    // Process penalties - decrement maps_remaining and check timers
                    const activePenalties: any[] = state.penalties_active || [];
                    const now = Date.now();
                    const remainingPenalties: any[] = [];
                    const completedPenalties: any[] = [];

                    for (const penalty of activePenalties) {
                        let shouldRemove = false;

                        // Check timer expiry
                        if (penalty.timer_expires_at) {
                            const expiryTime = new Date(penalty.timer_expires_at).getTime();
                            if (now >= expiryTime) {
                                shouldRemove = true;
                            }
                        }

                        // Decrement maps_remaining if applicable
                        if (!shouldRemove && penalty.maps_remaining !== null && penalty.maps_remaining !== undefined) {
                            penalty.maps_remaining = Math.max(0, penalty.maps_remaining - 1);
                            if (penalty.maps_remaining === 0) {
                                shouldRemove = true;
                            }
                        }

                        if (shouldRemove) {
                            completedPenalties.push(penalty);
                        } else {
                            remainingPenalties.push(penalty);
                        }
                    }

                    // Always update penalties_active to persist maps_remaining changes
                    updateData.penalties_active = remainingPenalties;

                    // Log completed penalties
                    if (completedPenalties.length > 0) {
                        for (const p of completedPenalties) {
                            await supabase.from('event_log').insert({
                                event_type: 'penalty_completed',
                                team_id: teamId,
                                message: `Penalty "${p.name || p.penalty_name}" completed`,
                                metadata: { penalty_id: p.id, reason: p.maps_remaining === 0 ? 'maps_done' : 'timer_expired' }
                            });
                        }

                        message += `, ${completedPenalties.length} penalty(ies) completed`;
                    }

                    // Promote from waitlist if slots available (max 2 active)
                    // Keep duplicates in waitlist until the active one is completed
                    const waitlistPenalties: any[] = [...(state.penalties_waitlist || [])];
                    const currentActive = updateData.penalties_active || remainingPenalties;
                    const promotedIndices: number[] = [];

                    for (let i = 0; i < waitlistPenalties.length && currentActive.length < 2; i++) {
                        const nextPenalty = waitlistPenalties[i];

                        // Check if same penalty_id is already active (prevent duplicates)
                        const isDuplicate = currentActive.some((p: any) =>
                            (p.penalty_id ?? p.id) === (nextPenalty.penalty_id ?? nextPenalty.id)
                        );

                        if (isDuplicate) {
                            console.log(`[Action] Keeping ${nextPenalty.name} in waitlist - same penalty already active`);
                            continue; // Skip but keep in waitlist
                        }

                        // Promote this penalty - calculate timer if applicable
                        const promotedPenalty = {
                            ...nextPenalty,
                            activated_at: new Date().toISOString(),
                            // Calculate timer_expires_at based on timer_minutes (if penalty has timer)
                            timer_expires_at: nextPenalty.timer_minutes
                                ? new Date(Date.now() + nextPenalty.timer_minutes * 60 * 1000).toISOString()
                                : null
                        };
                        currentActive.push(promotedPenalty);
                        promotedIndices.push(i);
                        message += `, promoted ${nextPenalty.name || nextPenalty.penalty_id} to active`;
                    }

                    // Remove only promoted penalties from waitlist (in reverse order to preserve indices)
                    for (let i = promotedIndices.length - 1; i >= 0; i--) {
                        waitlistPenalties.splice(promotedIndices[i], 1);
                    }

                    updateData.penalties_waitlist = waitlistPenalties;
                    updateData.penalties_active = currentActive;

                } else {
                    message = `Map ${data.map_index} already completed`;
                }
                break;
            }

            // ============================================
            // REDO MAP COMPLETED
            // ============================================
            case 'redo_map_completed': {
                if (!data.map_index || data.map_index < 1 || data.map_index > 2000) {
                    return NextResponse.json({
                        success: false,
                        error: 'Invalid map_index (must be 1-2000)'
                    }, { status: 400 });
                }

                const redoMaps = state.redo_map_ids || [];
                const redoIdx = redoMaps.indexOf(data.map_index);
                if (redoIdx >= 0) {
                    redoMaps.splice(redoIdx, 1);
                    updateData.redo_map_ids = redoMaps;
                    updateData.redo_remaining = Math.max(0, (state.redo_remaining || 0) - 1);

                    // Also update maps_remaining on the redo penalty for website display
                    const activePenalties = [...(state.penalties_active || [])];
                    for (const penalty of activePenalties) {
                        if (penalty.penalty_id === 7 || penalty.penalty_id === 10) {
                            if (penalty.maps_remaining !== undefined && penalty.maps_remaining > 0) {
                                penalty.maps_remaining = Math.max(0, penalty.maps_remaining - 1);
                            }
                        }
                    }
                    updateData.penalties_active = activePenalties;

                    message = `Redo map ${data.map_index} completed, ${updateData.redo_remaining} remaining`;
                } else {
                    message = `Map ${data.map_index} not in redo list`;
                }
                break;
            }

            // ============================================
            // PENALTY ACTIVATED (waitlist -> active)
            // ============================================
            case 'penalty_activated': {
                if (!data.penalty_id) {
                    return NextResponse.json({
                        success: false,
                        error: 'Missing penalty_id'
                    }, { status: 400 });
                }

                const waitlist = state.penalties_waitlist || [];
                // Check both p.id and p.penalty_id for compatibility
                const penaltyIdNum = typeof data.penalty_id === 'string' ? parseInt(data.penalty_id) : data.penalty_id;
                const penaltyIdx = waitlist.findIndex((p: any) =>
                    p.id === penaltyIdNum || p.id === data.penalty_id ||
                    p.penalty_id === penaltyIdNum || p.penalty_id === data.penalty_id
                );

                if (penaltyIdx >= 0) {
                    const penalty = waitlist[penaltyIdx];
                    waitlist.splice(penaltyIdx, 1);

                    const active = state.penalties_active || [];
                    active.push({ ...penalty, activated_at: new Date().toISOString() });

                    updateData.penalties_waitlist = waitlist;
                    updateData.penalties_active = active;
                    message = `Penalty ${penalty.name || data.penalty_id} activated`;
                } else {
                    message = `Penalty ${data.penalty_id} not found in waitlist`;
                }
                break;
            }

            // ============================================
            // PENALTY COMPLETED
            // ============================================
            case 'penalty_completed': {
                if (!data.penalty_id) {
                    return NextResponse.json({
                        success: false,
                        error: 'Missing penalty_id'
                    }, { status: 400 });
                }

                const activePenalties = state.penalties_active || [];
                // Check both p.id and p.penalty_id for compatibility
                const penIdNum = typeof data.penalty_id === 'string' ? parseInt(data.penalty_id) : data.penalty_id;
                const penIdx = activePenalties.findIndex((p: any) =>
                    p.id === penIdNum || p.id === data.penalty_id ||
                    p.penalty_id === penIdNum || p.penalty_id === data.penalty_id
                );

                if (penIdx >= 0) {
                    const penalty = activePenalties[penIdx];
                    activePenalties.splice(penIdx, 1);

                    // PROMOTE FROM WAITLIST: If slot now available, activate first waitlist penalty
                    const waitlist = state.penalties_waitlist || [];
                    if (activePenalties.length < 2 && waitlist.length > 0) {
                        const promoted = waitlist.shift();
                        if (promoted) {
                            promoted.activated_at = new Date().toISOString();
                            // Timer starts at activation
                            if (promoted.timer_minutes) {
                                promoted.timer_expires_at = new Date(Date.now() + promoted.timer_minutes * 60 * 1000).toISOString();
                            }
                            activePenalties.push(promoted);
                            console.log(`[Action] Promoted ${promoted.name} from waitlist`);
                        }
                        updateData.penalties_waitlist = waitlist;
                    }

                    updateData.penalties_active = activePenalties;
                    message = `Penalty ${penalty.name || data.penalty_id} completed`;
                } else {
                    message = `Penalty ${data.penalty_id} not found in active`;
                }
                break;
            }

            // ============================================
            // SET ACTIVE
            // ============================================
            case 'set_active': {
                // SERVER-SIDE COOLDOWN CHECK
                // Check if player has a player_switch_cooldown that hasn't expired
                const { data: playerData } = await supabase
                    .from('players')
                    .select('player_switch_cooldown_until')
                    .eq('trackmania_id', data.account_id)
                    .single();

                if (playerData?.player_switch_cooldown_until) {
                    const cooldownUntil = new Date(playerData.player_switch_cooldown_until).getTime();
                    const now = Date.now();
                    if (now < cooldownUntil) {
                        const remainingMs = cooldownUntil - now;
                        const remainingSec = Math.ceil(remainingMs / 1000);
                        return NextResponse.json({
                            success: false,
                            error: `Player Switch cooldown active (${Math.ceil(remainingSec / 60)} min remaining)`
                        }, { status: 403 });
                    }
                }

                // Check if slot is available
                if (state.active_player && state.active_player !== player.trackmania_name) {
                    return NextResponse.json({
                        success: false,
                        error: 'Active slot occupied by ' + state.active_player
                    }, { status: 409 });
                }

                updateData.active_player = player.trackmania_name;
                // Track session start time for 3-hour limit
                updateData.active_since = new Date().toISOString();

                // Remove from waiting if was there
                if (state.waiting_player === player.trackmania_name) {
                    updateData.waiting_player = null;
                }
                message = `${player.trackmania_name} is now active`;
                break;
            }

            // ============================================
            // SET WAITING
            // ============================================
            case 'set_waiting': {
                // Check if slot is available (no exceptions - Active players should use set_spectator for Pass Turn)
                if (state.waiting_player &&
                    state.waiting_player !== player.trackmania_name) {
                    return NextResponse.json({
                        success: false,
                        error: 'Waiting slot occupied by ' + state.waiting_player + ' - use Pass Turn'
                    }, { status: 409 });
                }

                updateData.waiting_player = player.trackmania_name;

                // Remove from active if was there
                if (state.active_player === player.trackmania_name) {
                    updateData.active_player = null;
                }
                message = `${player.trackmania_name} is now waiting`;
                break;
            }

            // ============================================
            // SET SPECTATOR
            // ============================================
            case 'set_spectator': {
                // Remove from both active and waiting
                if (state.active_player === player.trackmania_name) {
                    updateData.active_player = null;
                }
                if (state.waiting_player === player.trackmania_name) {
                    updateData.waiting_player = null;
                }
                message = `${player.trackmania_name} is now spectator`;
                break;
            }

            // ============================================
            // PASS TURN - Active becomes Spectator, Waiting becomes Active
            // ============================================
            case 'pass_turn': {
                // Must be the active player
                if (state.active_player !== player.trackmania_name) {
                    return NextResponse.json({
                        success: false,
                        error: 'Only the active player can pass turn'
                    }, { status: 403 });
                }

                // Must have someone waiting
                if (!state.waiting_player) {
                    return NextResponse.json({
                        success: false,
                        error: 'No one is waiting to take over'
                    }, { status: 400 });
                }

                // Promote waiting to active, caller becomes spectator
                updateData.active_player = state.waiting_player;
                updateData.waiting_player = null;
                message = `${player.trackmania_name} passed turn to ${state.waiting_player}`;
                break;
            }

            // ============================================
            // JOKER CHANGE TEAM
            // ============================================
            case 'joker_change_team': {
                // Update player's team_id in database
                const { error: updatePlayerError } = await supabase
                    .from('players')
                    .update({ team_id: teamId })
                    .eq('trackmania_id', data.account_id);

                if (updatePlayerError) {
                    console.error('[Plugin Action] Failed to update joker team:', updatePlayerError);
                }

                message = `Joker ${player.trackmania_name} joined team ${teamId}`;
                break;
            }

            // ============================================
            // UPDATE REDO MAPS - Plugin sends redo list after BtF/PS
            // ============================================
            case 'update_redo_maps': {
                const redoMapIds = data.redo_map_ids || [];
                const redoRemaining = data.redo_remaining || redoMapIds.length;

                updateData.redo_map_ids = redoMapIds;
                updateData.redo_remaining = redoRemaining;

                // Also update redo_remaining in active penalties
                const activePenalties = state.penalties_active || [];
                for (const penalty of activePenalties) {
                    if (penalty.penalty_id === 7 || penalty.penalty_id === 10) {
                        penalty.redo_remaining = redoRemaining;
                    }
                }
                updateData.penalties_active = activePenalties;

                message = `Updated redo maps: ${redoMapIds.length} maps to redo`;

                // Log the redo update
                await supabase.from('event_log').insert({
                    event_type: 'redo_maps_updated',
                    team_id: teamId,
                    message: message,
                    metadata: { redo_map_ids: redoMapIds, redo_remaining: redoRemaining }
                });
                break;
            }

            default:
                return NextResponse.json({
                    success: false,
                    error: `Unknown action: ${data.action}`
                }, { status: 400 });
        }

        // NOTE: roulette_map is now calculated by the plugin and sent via sync
        // Server no longer generates random - plugin detects RR in waitlist and calculates locally

        // Apply update
        const { error: updateError } = await supabase
            .from('team_server_state')
            .update(updateData)
            .eq('team_id', teamId);

        if (updateError) {
            console.error('[Plugin Action] Update error:', updateError);
            return NextResponse.json({
                success: false,
                error: 'Database error'
            }, { status: 500 });
        }

        // Log the action
        await supabase.from('event_log').insert({
            event_type: `plugin_${data.action}`,
            team_id: teamId,
            player_name: player.trackmania_name,
            details: { ...data },
            timestamp: new Date().toISOString()
        });

        console.log(`[Plugin Action] ${data.action}: ${message}`);

        // Get updated state to return to plugin
        const { data: updatedState } = await supabase
            .from('team_server_state')
            .select('active_player, waiting_player')
            .eq('team_id', teamId)
            .single();

        return NextResponse.json({
            success: true,
            action: data.action,
            message,
            team_id: teamId,
            active_player: updatedState?.active_player || null,
            waiting_player: updatedState?.waiting_player || null
        });

    } catch (error) {
        console.error('[Plugin Action] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
