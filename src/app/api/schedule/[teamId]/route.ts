import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TeamPlanning } from '@/lib/types';

// Public API - no auth required
export async function GET(
    request: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const { teamId: rawTeamId } = await params;

    // Handle both 'team1' and '1' formats
    const teamNumber = rawTeamId.startsWith('team')
        ? parseInt(rawTeamId.replace('team', ''))
        : parseInt(rawTeamId);

    if (isNaN(teamNumber)) {
        return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
    }

    try {
        // 1. Get Players (filtered for this team + jokers)
        const { data: players, error: playersError } = await supabase
            .from('players')
            .select('id, trackmania_name, discord_username, team_id')
            .eq('status', 'approved')
            .in('team_id', [teamNumber, 0])
            .order('trackmania_name');

        if (playersError) throw playersError;

        const teamPlayers = players.map(p => ({
            id: p.id,
            name: p.trackmania_name || p.discord_username,
            teamAssignment: p.team_id,
        }));

        // 2. Get Planning slots
        const { data: slotsData, error: slotsError } = await supabase
            .from('team_planning')
            .select('hour_index, main_player_id, sub_player_id, main_player_name, sub_player_name')
            .eq('team_id', teamNumber)
            .order('hour_index');

        if (slotsError) throw slotsError;

        const slots: Record<number, any> = {};
        for (const slot of slotsData || []) {
            slots[slot.hour_index] = {
                mainPlayerId: slot.main_player_id,
                subPlayerId: slot.sub_player_id,
                main_player_name: slot.main_player_name || null,
                sub_player_name: slot.sub_player_name || null
            };
        }

        const planning: TeamPlanning = { teamId: rawTeamId, slots };

        return NextResponse.json({
            teamId: rawTeamId,
            players: teamPlayers,
            planning
        });

    } catch (err: any) {
        console.error('Schedule API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
