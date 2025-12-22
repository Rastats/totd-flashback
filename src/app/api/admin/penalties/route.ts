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
        penalty_team: number;
        penalty_name: string;
        is_active: boolean;
        maps_remaining?: number;
        timer_remaining_ms?: number;
    }> = [];
    
    for (const team of (data || [])) {
        const active = team.penalties_active || [];
        const waitlist = team.penalties_waitlist || [];
        
        // Add active penalties
        for (let i = 0; i < active.length; i++) {
            const p = active[i];
            penalties.push({
                id: `${team.team_id}_active_${i}`,
                penalty_team: team.team_id,
                penalty_name: p.name || `Penalty ${p.id}`,
                is_active: true,
                maps_remaining: p.maps_remaining,
                timer_remaining_ms: p.timer_remaining_ms
            });
        }
        
        // Add waitlist penalties
        for (let i = 0; i < waitlist.length; i++) {
            const p = waitlist[i];
            penalties.push({
                id: `${team.team_id}_waitlist_${i}`,
                penalty_team: team.team_id,
                penalty_name: p.name || `Penalty ${p.id}`,
                is_active: false
            });
        }
    }
    
    return NextResponse.json({ penalties });
}

// POST: Add penalty to team (writes to team_server_state.penalties_waitlist)
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
        
        const currentActive = teamData?.penalties_active || [];
        const currentWaitlist = teamData?.penalties_waitlist || [];
        
        // Check max penalties (2 active + 2 waitlist = 4 total)
        if (currentActive.length + currentWaitlist.length >= 4) {
            return NextResponse.json({ error: 'Team already has 4 penalties (max 2 active + 2 waitlist)' }, { status: 400 });
        }
        
        // Create new penalty object with maps_remaining and timer_expires_at
        // Find penalty config by name
        const penaltyConfig = Object.values(PENALTY_CONFIG).find(p => p.name === penalty_name);
        
        const newPenalty = {
            id: Date.now(), // Use timestamp as unique ID
            penalty_id: penaltyConfig?.id || 0,
            name: penalty_name,
            maps_remaining: penaltyConfig?.maps ?? null,
            maps_total: penaltyConfig?.maps ?? null,
            timer_expires_at: penaltyConfig?.timerMinutes 
                ? new Date(Date.now() + penaltyConfig.timerMinutes * 60 * 1000).toISOString()
                : null,
            timer_minutes: penaltyConfig?.timerMinutes ?? null
        };
        
        // Add to waitlist (not active - plugin manages activation)
        const updatedWaitlist = [...currentWaitlist, newPenalty];
        
        const { error: updateError } = await supabase
            .from('team_server_state')
            .upsert({
                team_id: team_id,
                penalties_active: currentActive,
                penalties_waitlist: updatedWaitlist,
                updated_at: new Date().toISOString()
            }, { onConflict: 'team_id' });
        
        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        
        // Log to event_log
        await supabase.from('event_log').insert({
            event_type: 'penalty_applied',
            team_id: team_id,
            message: `[Admin] Added penalty to waitlist: ${penalty_name}`,
            metadata: { penalty_name, admin_action: true }
        });
        
        return NextResponse.json({ success: true, penalty: newPenalty });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE: Remove penalty from team_server_state
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const penaltyId = searchParams.get('id'); // Format: teamId_active/waitlist_index
        
        if (!penaltyId) {
            return NextResponse.json({ error: 'id required' }, { status: 400 });
        }
        
        // Parse penalty ID: format is "teamId_type_index"
        const parts = penaltyId.split('_');
        if (parts.length < 3) {
            return NextResponse.json({ error: 'Invalid penalty id format' }, { status: 400 });
        }
        
        const teamId = parseInt(parts[0]);
        const type = parts[1]; // 'active' or 'waitlist'
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
            .eq('team_id', teamId);
        
        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        
        // Log removal
        if (penaltyName) {
            await supabase.from('event_log').insert({
                event_type: 'penalty_completed',
                team_id: teamId,
                message: `[Admin] Removed penalty: ${penaltyName}`,
                metadata: { penalty_name: penaltyName, admin_action: true }
            });
        }
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Move penalty between active/waitlist
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
        
        // Can't promote to active if already have 2
        if (is_active && active.length >= 2) {
            return NextResponse.json({ error: 'Team already has 2 active penalties' }, { status: 400 });
        }
        
        let penalty: any;
        
        if (currentType === 'waitlist' && is_active) {
            // Move from waitlist to active
            if (index >= 0 && index < waitlist.length) {
                penalty = waitlist.splice(index, 1)[0];
                
                // Timer starts NOW (at activation), not when penalty was added
                // Get config by penalty_id or by name
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
            await supabase.from('event_log').insert({
                event_type: is_active ? 'penalty_activated' : 'penalty_demoted',
                team_id: teamId,
                message: `[Admin] ${is_active ? 'Promoted to active' : 'Moved to waitlist'}: ${penalty.name}`,
                metadata: { penalty_name: penalty.name, is_active, admin_action: true }
            });
        }
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
