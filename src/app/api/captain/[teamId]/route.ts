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

        // 2. Get Planning from normalized 'team_planning_slots' table
        const { data: slotsData, error: slotsError } = await supabase
            .from('team_planning')
            .select('hour_index, main_player_id, sub_player_id')
            .eq('team_id', teamId)
            .order('hour_index');

        if (slotsError) throw slotsError;

        // Convert to the slots object format expected by UI
        const slots: Record<number, { mainPlayerId: string | null; subPlayerId: string | null }> = {};
        for (const slot of slotsData || []) {
            slots[slot.hour_index] = {
                mainPlayerId: slot.main_player_id,
                subPlayerId: slot.sub_player_id
            };
        }

        const planning: TeamPlanning = {
            teamId,
            slots
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
        const slots = body.slots as Record<string, { mainPlayerId: string | null; subPlayerId: string | null }>;

        // Collect all player IDs to fetch names
        const playerIds = new Set<string>();
        Object.values(slots).forEach(slot => {
            if (slot.mainPlayerId) playerIds.add(slot.mainPlayerId);
            if (slot.subPlayerId) playerIds.add(slot.subPlayerId);
        });

        // Fetch player names
        const playerNames: Record<string, string> = {};
        if (playerIds.size > 0) {
            const { data: players } = await supabase
                .from('players')
                .select('id, trackmania_name')
                .in('id', Array.from(playerIds));

            players?.forEach(p => {
                playerNames[p.id] = p.trackmania_name;
            });
        }

        // Upsert each slot into the normalized table
        const upsertPromises = Object.entries(slots).map(async ([hourIndex, slot]) => {
            const hourIdx = parseInt(hourIndex, 10);

            // If both are null/empty, delete the row
            if (!slot.mainPlayerId && !slot.subPlayerId) {
                return supabase
                    .from('team_planning')
                    .delete()
                    .eq('team_id', teamId)
                    .eq('hour_index', hourIdx);
            }

            // Otherwise upsert with names
            return supabase
                .from('team_planning')
                .upsert({
                    team_id: teamId,
                    hour_index: hourIdx,
                    main_player_id: slot.mainPlayerId || null,
                    main_player_name: slot.mainPlayerId ? playerNames[slot.mainPlayerId] || null : null,
                    sub_player_id: slot.subPlayerId || null,
                    sub_player_name: slot.subPlayerId ? playerNames[slot.subPlayerId] || null : null,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'team_id,hour_index'
                });
        });

        await Promise.all(upsertPromises);

        return NextResponse.json({ success: true, teamId });
    } catch (err: any) {
        console.error('Captain API Save Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
