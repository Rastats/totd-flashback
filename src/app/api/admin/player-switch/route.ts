import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET: Get current team status (active/waiting players)
export async function GET(request: Request) {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
        .from('team_server_state')
        .select('team_id, active_player, waiting_player, updated_at')
        .order('team_id');
    
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ teams: data });
}

// POST: Force player switch
export async function POST(request: Request) {
    try {
        const { team_id, new_active_player, new_waiting_player } = await request.json();
        
        if (!team_id) {
            return NextResponse.json({ error: 'team_id required' }, { status: 400 });
        }
        
        const supabase = getSupabaseAdmin();
        
        // Get current status
        const { data: current } = await supabase
            .from('team_server_state')
            .select('active_player, waiting_player')
            .eq('team_id', team_id)
            .single();
        
        // Build update object
        const update: any = { updated_at: new Date().toISOString() };
        
        if (new_active_player !== undefined) {
            update.active_player = new_active_player || null;
        }
        if (new_waiting_player !== undefined) {
            update.waiting_player = new_waiting_player || null;
        }
        
        // If just swapping, swap current active and waiting
        if (new_active_player === undefined && new_waiting_player === undefined && current) {
            update.active_player = current.waiting_player;
            update.waiting_player = current.active_player;
        }
        
        const { error } = await supabase
            .from('team_server_state')
            .update(update)
            .eq('team_id', team_id);
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Log the switch
        const newActive = update.active_player || 'none';
        await supabase.from('event_log').insert({
            event_type: 'player_switch',
            team_id: team_id,
            message: `[Admin] Player switch: ${newActive} is now active`,
            metadata: { 
                new_active: update.active_player,
                new_waiting: update.waiting_player,
                admin_action: true 
            }
        });
        
        return NextResponse.json({ success: true, update });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
