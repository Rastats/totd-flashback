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
            .in('team_id', [parseInt(teamId), 0])
            .order('trackmania_name');

        if (playersError) throw playersError;

        // Transform players to match UI expectation - use new format with hourIndex
        const teamPlayers = players.map(p => ({
            id: p.id,
            name: p.trackmania_name || p.discord_username,
            teamAssignment: p.team_id,
            availability: (p.availability_slots || []).map((s: any) => ({
                hourIndex: s.hour_index,
                preference: s.preference,
            }))
        }));

        // 2. Get Planning from normalized 'team_planning_slots' table
        const { data: slotsData, error: slotsError } = await supabase
            .from('team_planning')
            .select('hour_index, main_player_id, sub_player_id, main_player_name, sub_player_name')
            .eq('team_id', teamId)
            .order('hour_index');

        if (slotsError) throw slotsError;

        // Convert to the slots object format expected by UI
        const slots: Record<number, { mainPlayerId: string | null; subPlayerId: string | null; main_player_name: string | null; sub_player_name: string | null }> = {};
        for (const slot of slotsData || []) {
            slots[slot.hour_index] = {
                mainPlayerId: slot.main_player_id,
                subPlayerId: slot.sub_player_id,
                main_player_name: slot.main_player_name || null,
                sub_player_name: slot.sub_player_name || null
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

        // FIXED: First DELETE all existing slots for this team,
        // then INSERT only the ones in the payload.
        // This ensures deleted slots are actually removed from the database.
        const { error: deleteError } = await supabase
            .from('team_planning')
            .delete()
            .eq('team_id', teamId);

        if (deleteError) {
            console.error('Error deleting old slots:', deleteError);
        }

        // Now insert only the slots that have a mainPlayerId
        const insertPromises = Object.entries(slots)
            .filter(([, slot]) => slot.mainPlayerId) // Only insert slots with a player
            .map(([hourIndex, slot]) => {
                const hourIdx = parseInt(hourIndex, 10);
                return supabase
                    .from('team_planning')
                    .insert({
                        team_id: teamId,
                        hour_index: hourIdx,
                        main_player_id: slot.mainPlayerId,
                        main_player_name: slot.mainPlayerId ? playerNames[slot.mainPlayerId] || null : null,
                        sub_player_id: slot.subPlayerId || null,
                        sub_player_name: slot.subPlayerId ? playerNames[slot.subPlayerId] || null : null,
                        updated_at: new Date().toISOString()
                    });
            });

        await Promise.all(insertPromises);

        return NextResponse.json({ success: true, teamId });
    } catch (err: any) {
        console.error('Captain API Save Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
