import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// POST /api/penalty-status
// Called by plugin to mark penalties as applied or completed
// Body: { donation_id: string, action: 'applied' | 'completed' }
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { donation_id, action } = body;

        if (!donation_id || !action) {
            return NextResponse.json(
                { error: 'Missing donation_id or action' },
                { status: 400 }
            );
        }

        if (action !== 'applied' && action !== 'completed') {
            return NextResponse.json(
                { error: 'Invalid action. Must be "applied" or "completed"' },
                { status: 400 }
            );
        }

        // Update the donation record
        const updates: Record<string, unknown> = {};

        if (action === 'applied') {
            updates.penalty_applied = true;
        } else if (action === 'completed') {
            updates.penalty_completed = true;
            updates.penalty_completed_at = new Date().toISOString();
        }

        const { error } = await supabaseAdmin
            .from('processed_donations')
            .update(updates)
            .eq('donation_id', donation_id);

        if (error) {
            console.error('[PenaltyStatus] Update error:', error);
            return NextResponse.json(
                { error: 'Database error' },
                { status: 500 }
            );
        }

        console.log(`[PenaltyStatus] Marked donation ${donation_id} as ${action}`);

        return NextResponse.json({
            success: true,
            donation_id,
            action
        });

    } catch (error) {
        console.error('[PenaltyStatus] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET /api/penalty-status?team_id=X
// Get pending penalties for a team (not yet completed)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('team_id');

        if (!teamId) {
            return NextResponse.json(
                { error: 'Missing team_id parameter' },
                { status: 400 }
            );
        }

        // Get pending penalties (not yet completed) for this team
        const { data, error } = await supabaseAdmin
            .from('processed_donations')
            .select('donation_id, amount, donor_name, penalty_id, penalty_name, penalty_applied, penalty_completed, processed_at')
            .eq('penalty_team', parseInt(teamId))
            .eq('penalty_completed', false)
            .order('processed_at', { ascending: true });

        if (error) {
            console.error('[PenaltyStatus] Query error:', error);
            return NextResponse.json(
                { error: 'Database error' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            team_id: parseInt(teamId),
            pending_penalties: data ?? []
        });

    } catch (error) {
        console.error('[PenaltyStatus] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
