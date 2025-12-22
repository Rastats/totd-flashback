import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET: List active shields by team
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');

    const supabase = getSupabaseAdmin();
    
    let query = supabase
        .from('team_server_state')
        .select('team_id, shield_active, shield_type, shield_expires_at, updated_at');
    
    if (teamId) {
        query = query.eq('team_id', parseInt(teamId));
    }
    
    const { data, error } = await query;
    
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Calculate remaining time for active shields
    const shields = data?.map(team => {
        const remainingMs = team.shield_active && team.shield_expires_at
            ? Math.max(0, new Date(team.shield_expires_at).getTime() - Date.now())
            : 0;
        
        return {
            team_id: team.team_id,
            active: remainingMs > 0,
            type: team.shield_type,
            remaining_ms: remainingMs,
            expires_at: team.shield_expires_at,
            cooldown_ms: 0  // Not used currently
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

// DELETE: Deactivate shield
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('team_id');
        
        if (!teamId) {
            return NextResponse.json({ error: 'team_id required' }, { status: 400 });
        }
        
        const supabase = getSupabaseAdmin();
        
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
