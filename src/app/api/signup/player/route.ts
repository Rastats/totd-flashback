import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { formData, availability } = body;

        // Insert player
        const { data: player, error: playerError } = await supabase
            .from('players')
            .insert({
                discord_username: formData.discordUsername,
                trackmania_id: formData.trackmaniaId,
                trackmania_name: formData.trackmaniaName,
                timezone: formData.timezone,
                languages: formData.languages,
                fast_learn_level: formData.fastLearnLevel,
                pc_confirmed: formData.pcConfirmed,
                wants_captain: formData.wantsCaptain,
                willing_joker: formData.willingJoker,
                coming_as_group: formData.comingAsGroup,
                wanted_teammates: formData.wantedTeammates,
                player_notes: formData.playerNotes,
                can_stream: formData.canStream,
                twitch_username: formData.twitchUsername,
                can_720p30: formData.can720p30,
                can_relay_teammate: formData.canRelayTeammate,
                teammate_will_stream: formData.teammateWillStream,
                is_flexible: formData.isFlexible,
                status: 'pending',
            })
            .select()
            .single();

        if (playerError) {
            console.error('Player insert error:', playerError);
            return NextResponse.json({ error: playerError.message }, { status: 400 });
        }

        // Insert availability slots (hour_indices format only)
        const hourIndices: number[] = body.hour_indices || [];

        if (hourIndices.length > 0) {
            const slots = hourIndices
                .filter(h => h >= 0 && h < 69)
                .map(hourIndex => ({
                    player_id: player.id,
                    hour_index: hourIndex,
                    preference: 'ok',
                }));

            if (slots.length > 0) {
                const { error: slotsError } = await supabase
                    .from('availability_slots')
                    .insert(slots);

                if (slotsError) {
                    console.error('Slots insert error:', slotsError);
                }
            }
        }

        return NextResponse.json({ success: true, playerId: player.id });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
