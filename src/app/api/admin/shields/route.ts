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
        .select('team_id, shield_active, shield_type, shield_expires_at, shield_small_cooldown_expires_at, shield_big_cooldown_expires_at, updated_at');

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

        const smallCooldownMs = team.shield_small_cooldown_expires_at
            ? Math.max(0, new Date(team.shield_small_cooldown_expires_at).getTime() - now)
            : 0;

        const bigCooldownMs = team.shield_big_cooldown_expires_at
            ? Math.max(0, new Date(team.shield_big_cooldown_expires_at).getTime() - now)
            : 0;

        return {
            team_id: team.team_id,
            active: remainingMs > 0,
            type: team.shield_type,
            remaining_ms: remainingMs,
            expires_at: team.shield_expires_at,
            small_cooldown_ms: smallCooldownMs,
            big_cooldown_ms: bigCooldownMs
        };
    }) || [];

    return NextResponse.json({ shields });
}

// POST: Activate shield for team (starts cooldown for that type immediately)
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

        // Check if this type is on cooldown
        const { data: teamData, error: fetchError } = await supabase
            .from('team_server_state')
            .select('shield_small_cooldown_expires_at, shield_big_cooldown_expires_at')
            .eq('team_id', team_id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        const now = Date.now();
        if (type === 'small' && teamData?.shield_small_cooldown_expires_at) {
            const cooldownEnd = new Date(teamData.shield_small_cooldown_expires_at).getTime();
            if (cooldownEnd > now) {
                const remainingMin = Math.ceil((cooldownEnd - now) / 60000);
                return NextResponse.json({
                    error: `Small shield on cooldown (${remainingMin} min remaining)`
                }, { status: 400 });
            }
        }
        if (type === 'big' && teamData?.shield_big_cooldown_expires_at) {
            const cooldownEnd = new Date(teamData.shield_big_cooldown_expires_at).getTime();
            if (cooldownEnd > now) {
                const remainingMin = Math.ceil((cooldownEnd - now) / 60000);
                return NextResponse.json({
                    error: `Big shield on cooldown (${remainingMin} min remaining)`
                }, { status: 400 });
            }
        }

        // Calculate expiration time for shield
        const durationMs = type === 'big' ? 30 * 60 * 1000 : 10 * 60 * 1000; // 30 or 10 minutes
        const expiresAt = new Date(now + durationMs).toISOString();

        // Cooldown starts NOW for THIS TYPE ONLY
        const cooldownMs = type === 'big' ? COOLDOWN_BIG : COOLDOWN_SMALL;
        const cooldownExpiresAt = new Date(now + cooldownMs).toISOString();

        // Update shield columns + start cooldown for this type
        const updateData: any = {
            shield_active: true,
            shield_type: type,
            shield_expires_at: expiresAt,
            updated_at: new Date().toISOString()
        };

        if (type === 'small') {
            // Small shield: just blocks new penalties, doesn't clear existing
            updateData.shield_small_cooldown_expires_at = cooldownExpiresAt;
        } else {
            // Big shield: clears ALL existing penalties
            updateData.shield_big_cooldown_expires_at = cooldownExpiresAt;
            updateData.penalties_active = [];
            updateData.penalties_waitlist = [];
        }



        const { error } = await supabase
            .from('team_server_state')
            .update(updateData)
            .eq('team_id', team_id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Log to event_log
        await supabase.from('event_log').insert({
            event_type: 'shield_activated',
            team_id: team_id,
            message: `[Admin] Activated ${type} shield (${type === 'big' ? '30' : '10'} min) + started ${type === 'big' ? '4h' : '1h'} cooldown`,
            metadata: { shield_type: type, admin_action: true }
        });

        return NextResponse.json({ success: true, expires_at: expiresAt });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Manage shield cooldown (specify which type)
export async function PATCH(request: Request) {
    try {
        const { team_id, shield_type, action, custom_minutes } = await request.json();

        if (!team_id || !shield_type || !action) {
            return NextResponse.json({ error: 'team_id, shield_type, and action required' }, { status: 400 });
        }

        if (!['small', 'big'].includes(shield_type)) {
            return NextResponse.json({ error: 'shield_type must be small or big' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        let cooldownExpiresAt: string | null = null;
        let message = '';

        switch (action) {
            case 'reset': {
                const cooldownMs = shield_type === 'big' ? COOLDOWN_BIG : COOLDOWN_SMALL;
                cooldownExpiresAt = new Date(Date.now() + cooldownMs).toISOString();
                message = `Reset ${shield_type} cooldown to ${shield_type === 'big' ? '4h' : '1h'}`;
                break;
            }
            case 'cancel': {
                cooldownExpiresAt = null;
                message = `${shield_type} cooldown cancelled`;
                break;
            }
            case 'set': {
                const maxMin = shield_type === 'big' ? 240 : 60;
                if (typeof custom_minutes !== 'number' || custom_minutes < 0 || custom_minutes > maxMin) {
                    return NextResponse.json({ error: `custom_minutes must be 0-${maxMin}` }, { status: 400 });
                }
                if (custom_minutes === 0) {
                    cooldownExpiresAt = null;
                    message = `${shield_type} cooldown set to 0 (cancelled)`;
                } else {
                    cooldownExpiresAt = new Date(Date.now() + custom_minutes * 60 * 1000).toISOString();
                    message = `${shield_type} cooldown set to ${custom_minutes} min`;
                }
                break;
            }
            default:
                return NextResponse.json({ error: 'Invalid action (reset/cancel/set)' }, { status: 400 });
        }

        const updateData: any = { updated_at: new Date().toISOString() };
        if (shield_type === 'small') {
            updateData.shield_small_cooldown_expires_at = cooldownExpiresAt;
        } else {
            updateData.shield_big_cooldown_expires_at = cooldownExpiresAt;
        }

        const { error: updateError } = await supabase
            .from('team_server_state')
            .update(updateData)
            .eq('team_id', team_id);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Log the action
        await supabase.from('event_log').insert({
            event_type: 'shield_cooldown_modified',
            team_id: team_id,
            message: `[Admin] ${message}`,
            metadata: { shield_type, action, custom_minutes, admin_action: true }
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

// DELETE: Deactivate shield (cooldowns remain untouched)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('team_id');

        if (!teamId) {
            return NextResponse.json({ error: 'team_id required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Deactivate shield but DON'T touch cooldowns
        const { error } = await supabase
            .from('team_server_state')
            .update({
                shield_active: false,
                shield_type: null,
                shield_expires_at: null,
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
            message: `[Admin] Deactivated shield`,
            metadata: { admin_action: true }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

