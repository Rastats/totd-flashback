import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { formData, availability } = body;

        // Insert caster
        const { data: caster, error: casterError } = await supabase
            .from('casters')
            .insert({
                discord_username: formData.discordUsername,
                display_name: formData.displayName,
                timezone: formData.timezone,
                english_level: formData.englishLevel,
                experience_level: formData.experienceLevel,
                availability_constraints: formData.availabilityConstraints,
                can_appear_main_stream: formData.canAppearOnMainStream,
                mic_quality_ok: formData.micQualityOk,
                twitch_username: formData.twitchUsername,
                status: 'pending',
            })
            .select()
            .single();

        if (casterError) {
            console.error('Caster insert error:', casterError);
            return NextResponse.json({ error: casterError.message }, { status: 400 });
        }

        // Insert availability slots
        if (availability && availability.length > 0) {
            const slots = availability.map((slot: {
                date: string;
                startHour: number;
                endHour: number;
                preference: string;
            }) => ({
                caster_id: caster.id,
                date: slot.date,
                start_hour: slot.startHour,
                end_hour: slot.endHour,
                preference: slot.preference,
            }));

            const { error: slotsError } = await supabase
                .from('availability_slots')
                .insert(slots);

            if (slotsError) {
                console.error('Slots insert error:', slotsError);
            }
        }

        return NextResponse.json({ success: true, casterId: caster.id });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
