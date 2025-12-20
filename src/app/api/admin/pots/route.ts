import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET - Fetch all team pots from team_status
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('team_status')
            .select('team_id, pot_amount, pot_currency, updated_at')
            .order('team_id');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Transform to consistent format for frontend
        const pots = (data || []).map(p => ({
            team_number: p.team_id,
            amount: p.pot_amount || 0,
            currency: p.pot_currency || 'GBP'
        }));

        return NextResponse.json(pots);
    } catch (error) {
        console.error('[Admin Pots] GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update a team pot in team_status (direct set, no penalties triggered)
export async function PATCH(request: Request) {
    try {
        const data = await request.json();
        const { team_number, amount, adjustment, reason } = data;

        if (!team_number || team_number < 1 || team_number > 4) {
            return NextResponse.json({ error: 'Invalid team_number' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get current pot value from team_status
        const { data: current, error: fetchError } = await supabase
            .from('team_status')
            .select('pot_amount')
            .eq('team_id', team_number)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        let newAmount: number;
        if (amount !== undefined) {
            // Direct set
            newAmount = amount;
        } else if (adjustment !== undefined) {
            // Relative adjustment
            newAmount = (current?.pot_amount || 0) + adjustment;
        } else {
            return NextResponse.json({ error: 'Either amount or adjustment required' }, { status: 400 });
        }

        // Ensure non-negative
        newAmount = Math.max(0, newAmount);

        // Upsert to team_status
        const { error: upsertError } = await supabase
            .from('team_status')
            .upsert({
                team_id: team_number,
                pot_amount: newAmount,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'team_id'
            });

        if (upsertError) {
            return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        console.log(`[Admin Pots] Team ${team_number} pot updated: ${current?.pot_amount || 0} → ${newAmount} (${reason || 'manual adjustment'})`);

        return NextResponse.json({
            success: true,
            team_number,
            previous_amount: current?.pot_amount || 0,
            new_amount: newAmount,
            reason
        });
    } catch (error) {
        console.error('[Admin Pots] PATCH error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
