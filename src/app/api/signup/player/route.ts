import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { userSlotToHourIndices } from '@/lib/timezone-utils';

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
                max_hours_per_day: formData.maxHoursPerDay,
                status: 'pending',
            })
            .select()
            .single();

        if (playerError) {
            console.error('Player insert error:', playerError);
            return NextResponse.json({ error: playerError.message }, { status: 400 });
        }

        // Insert availability slots - convert to hour_index
        if (availability && availability.length > 0) {
            const userTimezone = formData.timezone || 'Europe/Paris';
            const slots: { player_id: string; hour_index: number; preference: string }[] = [];

            for (const slot of availability as { date: string; startHour: number; endHour: number; preference: string }[]) {
                // Convert user's slot range to individual hour indices
                const hourIndices = userSlotToHourIndices(
                    slot.date,
                    slot.startHour,
                    slot.endHour,
                    userTimezone
                );

                // Create a row for each hour index
                for (const hourIndex of hourIndices) {
                    slots.push({
                        player_id: player.id,
                        hour_index: hourIndex,
                        preference: slot.preference,
                    });
                }
            }

            if (slots.length > 0) {
                const { error: slotsError } = await supabase
                    .from('availability_slots')
                    .insert(slots);

                if (slotsError) {
                    console.error('Slots insert error:', slotsError);
                    // Don't fail the whole request, player is already saved
                }
            }
        }

        return NextResponse.json({ success: true, playerId: player.id });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
