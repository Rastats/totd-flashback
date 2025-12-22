import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hourIndexToDateTime } from '@/lib/timezone-utils';

export async function GET() {
    try {
        const { data: players, error } = await supabase
            .from('players')
            .select(`
                *,
                availability_slots (*)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch players error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Transform to match the expected format
        const transformed = players.map(p => ({
            id: p.id,
            discordUsername: p.discord_username,
            trackmaniaId: p.trackmania_id,
            trackmaniaName: p.trackmania_name,
            timezone: p.timezone,
            languages: p.languages || ['English'],
            fastLearnLevel: p.fast_learn_level,
            pcConfirmed: p.pc_confirmed,
            wantsCaptain: p.wants_captain,
            willingJoker: p.willing_joker,
            comingAsGroup: p.coming_as_group,
            wantedTeammates: p.wanted_teammates,
            playerNotes: p.player_notes,
            canStream: p.can_stream,
            twitchUsername: p.twitch_username,
            can720p30: p.can_720p30,
            canRelayTeammate: p.can_relay_teammate,
            teammateWillStream: p.teammate_will_stream,
            isFlexible: p.is_flexible,
            maxHoursPerDay: p.max_hours_per_day,
            status: p.status,
            teamAssignment: p.team_id,
            submittedAt: p.created_at,
            isCaptain: p.is_captain, // Added missing field mapping
            availability: (p.availability_slots || []).map((s: { hour_index: number; preference: string }) => {
                const { date, hour } = hourIndexToDateTime(s.hour_index);
                return {
                    hourIndex: s.hour_index,
                    date,
                    hour,
                    preference: s.preference,
                };
            }),
        }));

        return NextResponse.json(transformed);
    } catch (error) {
        console.error('Players fetch error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
