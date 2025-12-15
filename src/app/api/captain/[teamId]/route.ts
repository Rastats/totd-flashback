import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TeamPlanning } from '@/lib/types';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const { teamId } = await params;

    try {
        // 1. Get Players (filtered for this team + jokers) directly from Supabase
        const { data: players, error: playersError } = await supabase
            .from('players')
            .select(`
                *,
                availability_slots (*)
            `)
            .eq('status', 'approved')
            .in('team_assignment', [teamId, 'joker'])
            .order('trackmania_name');

        if (playersError) throw playersError;

        // Transform players to match UI expectation
        const teamPlayers = players.map(p => ({
            id: p.id,
            name: p.trackmania_name || p.discord_username,
            teamAssignment: p.team_assignment,
            availability: (p.availability_slots || []).map((s: any) => ({
                date: s.date,
                startHour: s.start_hour,
                endHour: s.end_hour,
                preference: s.preference,
            }))
        }));

        // 2. Get Planning from 'team_planning' table
        const { data: planningData, error: planningError } = await supabase
            .from('team_planning')
            .select('slots')
            .eq('team_id', teamId)
            .single();

        // If error code is 'PGRST116', it means no row found (which is fine, return default)
        // Otherwise throw real error
        if (planningError && planningError.code !== 'PGRST116') {
            throw planningError;
        }

        const planning: TeamPlanning = {
            teamId,
            slots: planningData?.slots || {}
        };

        return NextResponse.json({
            teamId,
            players: teamPlayers,
            planning
        });

    } catch (err: any) {
        console.error('Captain API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const { teamId } = await params;

    try {
        const body = await request.json();
        const slots = body.slots;

        // Upsert planning into Supabase
        const { error } = await supabase
            .from('team_planning')
            .upsert({
                team_id: teamId,
                slots: slots,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        return NextResponse.json({ success: true, teamId, slots });
    } catch (err: any) {
        console.error('Captain API Save Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
