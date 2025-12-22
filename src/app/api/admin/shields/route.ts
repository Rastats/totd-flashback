import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Cooldown durations in ms
const COOLDOWN_SMALL = 60 * 60 * 1000;  // 1 hour
const COOLDOWN_BIG = 4 * 60 * 60 * 1000; // 4 hours

// GET: List active shields by team
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');

    const supabase = getSupabaseAdmin();
    
    let query = supabase
        .from('team_server_state')
        .select('team_id, shield_active, shield_type, shield_expires_at, shield_cooldown_expires_at, updated_at');
    
    if (teamId) {
        query = query.eq('team_id', parseInt(teamId));
    }
    
    const { data, error } = await query;
    
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Calculate remaining time for active shields and cooldowns
    const shields = data?.map(team => {
        const now = Date.now();
        
        const remainingMs = team.shield_active && team.shield_expires_at
            ? Math.max(0, new Date(team.shield_expires_at).getTime() - now)
            : 0;
        
        const cooldownMs = team.shield_cooldown_expires_at
            ? Math.max(0, new Date(team.shield_cooldown_expires_at).getTime() - now)
            : 0;
        
        return {
            team_id: team.team_id,
            active: remainingMs > 0,
            type: team.shield_type,
            remaining_ms: remainingMs,
            expires_at: team.shield_expires_at,
            cooldown_ms: cooldownMs,
            cooldown_expires_at: team.shield_cooldown_expires_at
        };
    }) || [];
    
    return NextResponse.json({ shields });
}

// POST: Activate shield for team
export async function POST(request: Request) {
    try {
        const { team_id, type } = await request.json();
        
        if (!team_id || !type) {
            return NextResponse.json({ error: 'team_id and type required' }, { status: 400 });
        }
        
        if (!['small', 'big'].includes(type)) {
            return NextResponse.json({ error: 'type must be small or big' }, { status: 400 });
        }
        
        const supabase = getSupabaseAdmin();
        
        // Calculate expiration time
        const durationMs = type === 'big' ? 30 * 60 * 1000 : 10 * 60 * 1000; // 30 or 10 minutes
        const expiresAt = new Date(Date.now() + durationMs).toISOString();
        
        // Update only shield columns (preserves all other team data)
        const { error } = await supabase
            .from('team_server_state')
            .update({
                shield_active: true,
                shield_type: type,
                shield_expires_at: expiresAt,
                updated_at: new Date().toISOString()
            })
            .eq('team_id', team_id);
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Log to event_log
        await supabase.from('event_log').insert({
            event_type: 'shield_activated',
            team_id: team_id,
            message: `[Admin] Activated ${type} shield (${type === 'big' ? '30' : '10'} min)`,
            metadata: { shield_type: type, admin_action: true }
        });
        
        return NextResponse.json({ success: true, expires_at: expiresAt });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Manage shield cooldown
export async function PATCH(request: Request) {
    try {
        const { team_id, action, custom_minutes } = await request.json();
        
        if (!team_id || !action) {
            return NextResponse.json({ error: 'team_id and action required' }, { status: 400 });
        }
        
        const supabase = getSupabaseAdmin();
        
        // Get current team state to know shield type
        const { data: teamData, error: fetchError } = await supabase
            .from('team_server_state')
            .select('shield_type')
            .eq('team_id', team_id)
            .single();
        
        if (fetchError) {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }
        
        let cooldownExpiresAt: string | null = null;
        let message = '';
        
        switch (action) {
            case 'reset': {
                // Reset to full cooldown based on last shield type (default to small if unknown)
                const type = teamData?.shield_type || 'small';
                const cooldownMs = type === 'big' ? COOLDOWN_BIG : COOLDOWN_SMALL;
                cooldownExpiresAt = new Date(Date.now() + cooldownMs).toISOString();
                message = `Reset cooldown to ${type === 'big' ? '4h' : '1h'}`;
                break;
            }
            case 'cancel': {
                cooldownExpiresAt = null;
                message = 'Cooldown cancelled';
                break;
            }
            case 'set': {
                if (typeof custom_minutes !== 'number' || custom_minutes < 0 || custom_minutes > 240) {
                    return NextResponse.json({ error: 'custom_minutes must be 0-240' }, { status: 400 });
                }
                if (custom_minutes === 0) {
                    cooldownExpiresAt = null;
                    message = 'Cooldown set to 0 (cancelled)';
                } else {
                    cooldownExpiresAt = new Date(Date.now() + custom_minutes * 60 * 1000).toISOString();
                    message = `Cooldown set to ${custom_minutes} min`;
                }
                break;
            }
            default:
                return NextResponse.json({ error: 'Invalid action (reset/cancel/set)' }, { status: 400 });
        }
        
        const { error: updateError } = await supabase
            .from('team_server_state')
            .update({
                shield_cooldown_expires_at: cooldownExpiresAt,
                updated_at: new Date().toISOString()
            })
            .eq('team_id', team_id);
        
        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        
        // Log the action
        await supabase.from('event_log').insert({
            event_type: 'shield_cooldown_modified',
            team_id: team_id,
            message: `[Admin] ${message}`,
            metadata: { action, custom_minutes, admin_action: true }
        });
        
        return NextResponse.json({ 
            success: true, 
            cooldown_expires_at: cooldownExpiresAt,
            message 
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE: Deactivate shield (and start cooldown)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('team_id');
        const startCooldown = searchParams.get('start_cooldown') !== 'false'; // Default true
        
        if (!teamId) {
            return NextResponse.json({ error: 'team_id required' }, { status: 400 });
        }
        
        const supabase = getSupabaseAdmin();
        
        // Get current shield type to determine cooldown duration
        const { data: teamData } = await supabase
            .from('team_server_state')
            .select('shield_type')
            .eq('team_id', parseInt(teamId))
            .single();
        
        const shieldType = teamData?.shield_type || 'small';
        const cooldownMs = shieldType === 'big' ? COOLDOWN_BIG : COOLDOWN_SMALL;
        const cooldownExpiresAt = startCooldown 
            ? new Date(Date.now() + cooldownMs).toISOString()
            : null;
        
        const { error } = await supabase
            .from('team_server_state')
            .update({
                shield_active: false,
                shield_type: null,
                shield_expires_at: null,
                shield_cooldown_expires_at: cooldownExpiresAt,
                updated_at: new Date().toISOString()
            })
            .eq('team_id', parseInt(teamId));
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Log removal
        await supabase.from('event_log').insert({
            event_type: 'shield_expired',
            team_id: parseInt(teamId),
            message: `[Admin] Deactivated shield${startCooldown ? ` + started ${shieldType === 'big' ? '4h' : '1h'} cooldown` : ''}`,
            metadata: { admin_action: true, cooldown_started: startCooldown }
        });
        
        return NextResponse.json({ success: true, cooldown_expires_at: cooldownExpiresAt });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
