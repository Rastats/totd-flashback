import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { PENALTY_CONFIG, getInitialMapsRemaining, calculateTimerExpiry } from '@/lib/penalty-config';

// GET: List all penalties from team_server_state for all teams
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');

    const supabase = getSupabaseAdmin();

    let query = supabase
        .from('team_server_state')
        .select('team_id, penalties_active, penalties_waitlist, shield_active, shield_type, shield_expires_at')
        .order('team_id');

    if (teamId) {
        query = query.eq('team_id', parseInt(teamId));
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to a flat list of penalties with team info
    const penalties: Array<{
        id: string;
        penalty_id: number;
        penalty_team: number;
        penalty_name: string;
        is_active: boolean;
        maps_remaining?: number;
        maps_total?: number;
        timer_expires_at?: string;
    }> = [];


    for (const team of (data || [])) {
        const active = team.penalties_active || [];
        const waitlist = team.penalties_waitlist || [];

        // Add active penalties
        for (let i = 0; i < active.length; i++) {
            const p = active[i];
            penalties.push({
                id: `${team.team_id}_active_${i}`,
                penalty_id: p.penalty_id || 0,
                penalty_team: team.team_id,
                penalty_name: p.name || `Penalty ${p.id}`,
                is_active: true,
                maps_remaining: p.maps_remaining,
                maps_total: p.maps_total,
                timer_expires_at: p.timer_expires_at
            });
        }

        // Add waitlist penalties
        for (let i = 0; i < waitlist.length; i++) {
            const p = waitlist[i];
            penalties.push({
                id: `${team.team_id}_waitlist_${i}`,
                penalty_id: p.penalty_id || 0,
                penalty_team: team.team_id,
                penalty_name: p.name || `Penalty ${p.id}`,
                is_active: false
            });
        }

    }

    return NextResponse.json({ penalties });
}

// POST: Add penalty to team (uses same logic as tiltify: immediate→active, others→waitlist)
export async function POST(request: Request) {
    try {
        const { team_id, penalty_name } = await request.json();

        if (!team_id || !penalty_name) {
            return NextResponse.json({ error: 'team_id and penalty_name required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get current team status
        const { data: teamData, error: fetchError } = await supabase
            .from('team_server_state')
            .select('penalties_active, penalties_waitlist, shield_active')
            .eq('team_id', team_id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        // Check if shield is active (blocks penalties)
        if (teamData?.shield_active) {
            return NextResponse.json({ error: 'Team has active shield - penalties blocked' }, { status: 400 });
        }

        let active = teamData?.penalties_active || [];
        let waitlist = teamData?.penalties_waitlist || [];

        // Find penalty config by name
        const penaltyConfig = Object.values(PENALTY_CONFIG).find(p => p.name === penalty_name);
        const penaltyId = penaltyConfig?.id || 0;

        // Create new penalty object
        const newPenalty: any = {
            id: Date.now(),
            penalty_id: penaltyId,
            name: penalty_name,
            maps_remaining: penaltyConfig?.maps ?? null,
            maps_total: penaltyConfig?.maps ?? null,
            timer_minutes: penaltyConfig?.timerMinutes ?? null,
            added_at: new Date().toISOString()
        };

        // Immediate penalties (7=Freeze, 9=Inverse Mouse, 10=Disco) go to ACTIVE
        const IMMEDIATE_IDS = [7, 9, 10];
        const isImmediate = IMMEDIATE_IDS.includes(penaltyId);

        // Check if this penalty is already active (duplicate prevention)
        const alreadyActive = active.some((p: any) => p.penalty_id === penaltyId);
        if (isImmediate && alreadyActive) {
            return NextResponse.json({
                error: `${penalty_name} is already active for this team`
            }, { status: 400 });
        }

        let removedPenalty: any = null;
        let destination = '';

        if (isImmediate) {

            // IMMEDIATE → ACTIVE (override lowest ID if full)
            if (active.length >= 2) {
                // Find and remove lowest ID
                let lowestIdx = 0;
                let lowestId = active[0]?.penalty_id ?? 999;
                for (let i = 1; i < active.length; i++) {
                    const thisId = active[i]?.penalty_id ?? 999;
                    if (thisId < lowestId) {
                        lowestId = thisId;
                        lowestIdx = i;
                    }
                }
                removedPenalty = active.splice(lowestIdx, 1)[0];
            }
            // Activate the penalty
            newPenalty.activated_at = new Date().toISOString();
            if (penaltyConfig?.timerMinutes) {
                newPenalty.timer_expires_at = new Date(Date.now() + penaltyConfig.timerMinutes * 60 * 1000).toISOString();
            }
            active.push(newPenalty);
            destination = 'active';
        } else {
            // NON-IMMEDIATE → WAITLIST (override lowest ID if full)
            if (waitlist.length >= 2) {
                // Find and remove lowest ID
                let lowestIdx = 0;
                let lowestId = waitlist[0]?.penalty_id ?? 999;
                for (let i = 1; i < waitlist.length; i++) {
                    const thisId = waitlist[i]?.penalty_id ?? 999;
                    if (thisId < lowestId) {
                        lowestId = thisId;
                        lowestIdx = i;
                    }
                }
                removedPenalty = waitlist.splice(lowestIdx, 1)[0];
            }
            waitlist.push(newPenalty);
            destination = 'waitlist';
        }

        const { error: updateError } = await supabase
            .from('team_server_state')
            .upsert({
                team_id: team_id,
                penalties_active: active,
                penalties_waitlist: waitlist,
                updated_at: new Date().toISOString()
            }, { onConflict: 'team_id' });

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Log to event_log
        let message = `[Admin] Added ${penalty_name} to ${destination}`;
        if (removedPenalty) {
            message += ` (removed ${removedPenalty.name})`;
        }
        await supabase.from('event_log').insert({
            event_type: 'penalty_applied',
            team_id: team_id,
            message,
            metadata: { penalty_name, destination, removed: removedPenalty?.name, admin_action: true }
        });

        return NextResponse.json({ success: true, penalty: newPenalty, destination, removed: removedPenalty?.name });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


// DELETE: Remove penalty from team_server_state
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const penaltyId = searchParams.get('id'); // Format: teamId_active/waitlist_index
        const clearAll = searchParams.get('clear_all') === 'true';
        const teamId = searchParams.get('team_id');

        const supabase = getSupabaseAdmin();

        // Clear all penalties for a team
        if (clearAll && teamId) {
            const { error: updateError } = await supabase
                .from('team_server_state')
                .update({
                    penalties_active: [],
                    penalties_waitlist: [],
                    updated_at: new Date().toISOString()
                })
                .eq('team_id', parseInt(teamId));

            if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            await supabase.from('event_log').insert({
                event_type: 'penalty_completed',
                team_id: parseInt(teamId),
                message: `[Admin] Cleared all penalties`,
                metadata: { admin_action: true, clear_all: true }
            });

            return NextResponse.json({ success: true, cleared: 'all' });
        }

        if (!penaltyId) {
            return NextResponse.json({ error: 'id or (team_id + clear_all) required' }, { status: 400 });
        }

        // Parse penalty ID: format is "teamId_type_index"
        const parts = penaltyId.split('_');
        if (parts.length < 3) {
            return NextResponse.json({ error: 'Invalid penalty id format' }, { status: 400 });
        }

        const parsedTeamId = parseInt(parts[0]);
        const type = parts[1]; // 'active' or 'waitlist'
        const index = parseInt(parts[2]);

        // Get current team status
        const { data: teamData, error: fetchError } = await supabase
            .from('team_server_state')
            .select('penalties_active, penalties_waitlist')
            .eq('team_id', parsedTeamId)
            .single();

        if (fetchError) {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        let penaltyName = '';
        const updates: any = { updated_at: new Date().toISOString() };

        if (type === 'active') {
            const active = teamData?.penalties_active || [];
            if (index >= 0 && index < active.length) {
                penaltyName = active[index]?.name || 'Unknown';
                active.splice(index, 1);
                updates.penalties_active = active;
            }
        } else if (type === 'waitlist') {
            const waitlist = teamData?.penalties_waitlist || [];
            if (index >= 0 && index < waitlist.length) {
                penaltyName = waitlist[index]?.name || 'Unknown';
                waitlist.splice(index, 1);
                updates.penalties_waitlist = waitlist;
            }
        }

        const { error: updateError } = await supabase
            .from('team_server_state')
            .update(updates)
            .eq('team_id', parsedTeamId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Log removal
        if (penaltyName) {
            await supabase.from('event_log').insert({
                event_type: 'penalty_completed',
                team_id: parsedTeamId,
                message: `[Admin] Removed penalty: ${penaltyName}`,
                metadata: { penalty_name: penaltyName, admin_action: true }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Move penalty between active/waitlist (removes lowest-ID if destination full)
export async function PATCH(request: Request) {
    try {
        const { id, is_active } = await request.json();

        if (!id || typeof is_active !== 'boolean') {
            return NextResponse.json({ error: 'id and is_active required' }, { status: 400 });
        }

        // Parse penalty ID
        const parts = id.split('_');
        if (parts.length < 3) {
            return NextResponse.json({ error: 'Invalid penalty id format' }, { status: 400 });
        }

        const teamId = parseInt(parts[0]);
        const currentType = parts[1];
        const index = parseInt(parts[2]);

        const supabase = getSupabaseAdmin();

        // Get current team status
        const { data: teamData, error: fetchError } = await supabase
            .from('team_server_state')
            .select('penalties_active, penalties_waitlist')
            .eq('team_id', teamId)
            .single();

        if (fetchError) {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        const active = teamData?.penalties_active || [];
        const waitlist = teamData?.penalties_waitlist || [];

        let penalty: any;
        let removedPenalty: any = null;

        if (currentType === 'waitlist' && is_active) {
            // Move from waitlist to active
            if (index >= 0 && index < waitlist.length) {
                const penaltyToMove = waitlist[index];

                // Check if this penalty is already active (duplicate prevention)
                const alreadyActive = active.some((p: any) => p.penalty_id === penaltyToMove.penalty_id);
                if (alreadyActive) {
                    return NextResponse.json({
                        error: `${penaltyToMove.name} is already active for this team`
                    }, { status: 400 });
                }

                penalty = waitlist.splice(index, 1)[0];


                // If active is full, remove lowest ID
                if (active.length >= 2) {
                    let lowestIdx = 0;
                    let lowestId = active[0]?.penalty_id ?? 999;
                    for (let i = 1; i < active.length; i++) {
                        const thisId = active[i]?.penalty_id ?? 999;
                        if (thisId < lowestId) {
                            lowestId = thisId;
                            lowestIdx = i;
                        }
                    }
                    removedPenalty = active.splice(lowestIdx, 1)[0];
                }

                // Timer starts NOW (at activation)
                const penaltyId = penalty.penalty_id;
                const penaltyConfig = penaltyId ? PENALTY_CONFIG[penaltyId] :
                    Object.values(PENALTY_CONFIG).find(p => p.name === penalty.name);

                if (penaltyConfig?.timerMinutes) {
                    penalty.timer_expires_at = new Date(Date.now() + penaltyConfig.timerMinutes * 60 * 1000).toISOString();
                }

                // Ensure maps_remaining is set from config if not already
                if (penalty.maps_remaining === undefined && penaltyConfig?.maps) {
                    penalty.maps_remaining = penaltyConfig.maps;
                    penalty.maps_total = penaltyConfig.maps;
                }

                penalty.activated_at = new Date().toISOString();
                active.push(penalty);
            }
        } else if (currentType === 'active' && !is_active) {
            // Move from active to waitlist
            if (index >= 0 && index < active.length) {
                penalty = active.splice(index, 1)[0];

                // If waitlist is full, remove lowest ID
                if (waitlist.length >= 2) {
                    let lowestIdx = 0;
                    let lowestId = waitlist[0]?.penalty_id ?? 999;
                    for (let i = 1; i < waitlist.length; i++) {
                        const thisId = waitlist[i]?.penalty_id ?? 999;
                        if (thisId < lowestId) {
                            lowestId = thisId;
                            lowestIdx = i;
                        }
                    }
                    removedPenalty = waitlist.splice(lowestIdx, 1)[0];
                }

                // Remove active-only fields
                delete penalty.timer_expires_at;
                delete penalty.activated_at;
                waitlist.push(penalty);
            }
        }

        const { error: updateError } = await supabase
            .from('team_server_state')
            .update({
                penalties_active: active,
                penalties_waitlist: waitlist,
                updated_at: new Date().toISOString()
            })
            .eq('team_id', teamId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Log the change
        if (penalty) {
            let message = `[Admin] ${is_active ? 'Promoted to active' : 'Moved to waitlist'}: ${penalty.name}`;
            if (removedPenalty) {
                message += ` (removed ${removedPenalty.name})`;
            }
            await supabase.from('event_log').insert({
                event_type: is_active ? 'penalty_activated' : 'penalty_demoted',
                team_id: teamId,
                message,
                metadata: { penalty_name: penalty.name, is_active, removed: removedPenalty?.name, admin_action: true }
            });
        }

        return NextResponse.json({ success: true, removed: removedPenalty?.name });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
