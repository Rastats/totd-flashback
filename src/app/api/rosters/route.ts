import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data: players, error } = await supabase
            .from('players')
            .select('id, trackmania_name, discord_username, team_assignment, twitch_username, can_stream, status')
            .eq('status', 'approved');

        if (error) {
            console.error('Fetch rosters error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        const transformed = players.map(p => ({
            id: p.id,
            trackmaniaName: p.trackmania_name,
            discordUsername: p.discord_username,
            teamAssignment: p.team_assignment,
            twitchUsername: p.twitch_username,
            canStream: p.can_stream,
        }));

        return NextResponse.json(transformed);
    } catch (error) {
        console.error('Rosters fetch error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
