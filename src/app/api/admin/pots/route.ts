import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET - Fetch all team pots
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('team_pots')
            .select('*')
            .order('team_number');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('[Admin Pots] GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update a team pot
export async function PATCH(request: Request) {
    try {
        const data = await request.json();
        const { team_number, amount, adjustment, reason } = data;

        if (!team_number || team_number < 1 || team_number > 4) {
            return NextResponse.json({ error: 'Invalid team_number' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get current pot value
        const { data: current, error: fetchError } = await supabase
            .from('team_pots')
            .select('amount')
            .eq('team_number', team_number)
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
            newAmount = (current?.amount || 0) + adjustment;
        } else {
            return NextResponse.json({ error: 'Either amount or adjustment required' }, { status: 400 });
        }

        // Ensure non-negative
        newAmount = Math.max(0, newAmount);

        // Upsert the pot
        const { error: upsertError } = await supabase
            .from('team_pots')
            .upsert({
                team_number,
                amount: newAmount,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'team_number'
            });

        if (upsertError) {
            return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        console.log(`[Admin Pots] Team ${team_number} pot updated: ${current?.amount || 0} → ${newAmount} (${reason || 'manual adjustment'})`);

        return NextResponse.json({
            success: true,
            team_number,
            previous_amount: current?.amount || 0,
            new_amount: newAmount,
            reason
        });
    } catch (error) {
        console.error('[Admin Pots] PATCH error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
