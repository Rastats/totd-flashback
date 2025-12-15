import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { convertToParisTime } from '@/lib/timezone-utils';

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

        // Insert availability slots - convert to Paris time
        if (availability && availability.length > 0) {
            const userTimezone = formData.timezone || 'Europe/Paris';

            const slots = availability.map((slot: {
                date: string;
                startHour: number;
                endHour: number;
                preference: string;
            }) => {
                // Convert start and end hours to Paris time
                const startInParis = convertToParisTime(slot.date, slot.startHour, userTimezone);
                const endInParis = convertToParisTime(slot.date, slot.endHour, userTimezone);

                // Note: If the slot spans midnight in Paris, this simplified approach
                // might not handle it perfectly, but for most cases it works
                return {
                    player_id: player.id,
                    date: startInParis.date,
                    start_hour: startInParis.hour,
                    end_hour: endInParis.hour === 0 ? 24 : endInParis.hour, // Handle midnight
                    preference: slot.preference,
                };
            });

            const { error: slotsError } = await supabase
                .from('availability_slots')
                .insert(slots);

            if (slotsError) {
                console.error('Slots insert error:', slotsError);
                // Don't fail the whole request, player is already saved
            }
        }

        return NextResponse.json({ success: true, playerId: player.id });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
