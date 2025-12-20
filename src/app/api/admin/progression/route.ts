import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET: Get all team progression
export async function GET(request: Request) {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
        .from('team_status')
        .select('team_id, maps_completed, updated_at')
        .order('team_id');
    
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ teams: data });
}

// PUT: Update maps_completed for team
export async function PUT(request: Request) {
    try {
        const { team_id, maps_completed } = await request.json();
        
        if (!team_id || maps_completed === undefined) {
            return NextResponse.json({ error: 'team_id and maps_completed required' }, { status: 400 });
        }
        
        if (maps_completed < 0 || maps_completed > 2000) {
            return NextResponse.json({ error: 'maps_completed must be between 0 and 2000' }, { status: 400 });
        }
        
        const supabase = getSupabaseAdmin();
        
        // Get current value for logging
        const { data: current } = await supabase
            .from('team_status')
            .select('maps_completed')
            .eq('team_id', team_id)
            .single();
        
        const { error } = await supabase
            .from('team_status')
            .update({
                maps_completed: maps_completed,
                updated_at: new Date().toISOString()
            })
            .eq('team_id', team_id);
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Log the change
        await supabase.from('event_log').insert({
            event_type: 'milestone',
            team_id: team_id,
            message: `[Admin] Progression updated: ${current?.maps_completed || 0} → ${maps_completed}`,
            metadata: { 
                old_value: current?.maps_completed,
                new_value: maps_completed,
                admin_action: true 
            }
        });
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE: Reset team progression
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('team_id');
        
        if (!teamId) {
            return NextResponse.json({ error: 'team_id required' }, { status: 400 });
        }
        
        const supabase = getSupabaseAdmin();
        
        const { error } = await supabase
            .from('team_status')
            .update({
                maps_completed: 0,
                updated_at: new Date().toISOString()
            })
            .eq('team_id', parseInt(teamId));
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Log the reset
        await supabase.from('event_log').insert({
            event_type: 'milestone',
            team_id: parseInt(teamId),
            message: `[Admin] Progression RESET to 0`,
            metadata: { admin_action: true, reset: true }
        });
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
