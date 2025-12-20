import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET: List all pending penalties by team
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');

    const supabase = getSupabaseAdmin();
    
    let query = supabase
        .from('pending_penalties')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (teamId) {
        query = query.eq('penalty_team', parseInt(teamId));
    }
    
    const { data, error } = await query;
    
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ penalties: data });
}

// POST: Add penalty to team
export async function POST(request: Request) {
    try {
        const { team_id, penalty_name, donation_id } = await request.json();
        
        if (!team_id || !penalty_name) {
            return NextResponse.json({ error: 'team_id and penalty_name required' }, { status: 400 });
        }
        
        const supabase = getSupabaseAdmin();
        
        // Count current active penalties for this team
        const { data: activePenalties } = await supabase
            .from('pending_penalties')
            .select('id')
            .eq('penalty_team', team_id)
            .eq('is_active', true);
        
        // New penalties go to waitlist by default (is_active = false)
        // Unless there's space in active (< 2)
        const activeCount = activePenalties?.length || 0;
        const shouldBeActive = activeCount < 2;
        
        const { data, error } = await supabase
            .from('pending_penalties')
            .insert({
                penalty_team: team_id,
                penalty_name: penalty_name,
                donation_id: donation_id || `admin_${Date.now()}`,
                donor_name: 'Admin',
                amount: 0,
                is_active: shouldBeActive,
                processed_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Also log to event_log
        await supabase.from('event_log').insert({
            event_type: 'penalty_applied',
            team_id: team_id,
            message: `[Admin] Added penalty: ${penalty_name}`,
            metadata: { penalty_name, admin_action: true }
        });
        
        return NextResponse.json({ success: true, penalty: data });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE: Remove pending penalty
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const penaltyId = searchParams.get('id');
        
        if (!penaltyId) {
            return NextResponse.json({ error: 'id required' }, { status: 400 });
        }
        
        const supabase = getSupabaseAdmin();
        
        // Get penalty info first for logging
        const { data: penalty } = await supabase
            .from('pending_penalties')
            .select('*')
            .eq('id', penaltyId)
            .single();
        
        const { error } = await supabase
            .from('pending_penalties')
            .delete()
            .eq('id', penaltyId);
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Log removal
        if (penalty) {
            await supabase.from('event_log').insert({
                event_type: 'penalty_completed',
                team_id: penalty.penalty_team,
                message: `[Admin] Removed penalty: ${penalty.penalty_name}`,
                metadata: { penalty_name: penalty.penalty_name, admin_action: true }
            });
        }
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Toggle penalty active/waitlist status
export async function PATCH(request: Request) {
    try {
        const { id, is_active } = await request.json();
        
        if (!id || typeof is_active !== 'boolean') {
            return NextResponse.json({ error: 'id and is_active required' }, { status: 400 });
        }
        
        const supabase = getSupabaseAdmin();
        
        // Get penalty info
        const { data: penalty } = await supabase
            .from('pending_penalties')
            .select('*')
            .eq('id', id)
            .single();
        
        if (!penalty) {
            return NextResponse.json({ error: 'Penalty not found' }, { status: 404 });
        }
        
        // If promoting to active, check max 2 active limit
        if (is_active) {
            const { data: activePenalties } = await supabase
                .from('pending_penalties')
                .select('id')
                .eq('penalty_team', penalty.penalty_team)
                .eq('is_active', true);
            
            if ((activePenalties?.length || 0) >= 2) {
                return NextResponse.json({ error: 'Team already has 2 active penalties' }, { status: 400 });
            }
        }
        
        const { error } = await supabase
            .from('pending_penalties')
            .update({ is_active })
            .eq('id', id);
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Log the change
        await supabase.from('event_log').insert({
            event_type: is_active ? 'penalty_activated' : 'penalty_demoted',
            team_id: penalty.penalty_team,
            message: `[Admin] ${is_active ? 'Promoted to active' : 'Moved to waitlist'}: ${penalty.penalty_name}`,
            metadata: { penalty_name: penalty.penalty_name, is_active, admin_action: true }
        });
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
