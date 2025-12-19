import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { data: players, error } = await supabase
            .from('players')
            .select('id, trackmania_name, discord_username, team_assignment, twitch_username, can_stream, status, is_captain')
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
            isCaptain: p.is_captain,
        }));

        // Generate ETag from response data
        const jsonString = JSON.stringify(transformed);
        const etag = `"${createHash('md5').update(jsonString).digest('hex')}"`;

        // Check If-None-Match header
        const clientEtag = request.headers.get('If-None-Match');
        if (clientEtag && clientEtag === etag) {
            // Data hasn't changed - return 304 Not Modified
            return new NextResponse(null, {
                status: 304,
                headers: { 'ETag': etag }
            });
        }

        // Return data with ETag header
        return NextResponse.json(transformed, {
            headers: { 'ETag': etag }
        });
    } catch (error) {
        console.error('Rosters fetch error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
