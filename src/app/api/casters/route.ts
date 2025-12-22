import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hourIndexToDateTime } from '@/lib/timezone-utils';

export async function GET() {
    try {
        const { data: casters, error } = await supabase
            .from('casters')
            .select(`
                *,
                availability_slots (*)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch casters error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Transform to match the expected format
        const transformed = casters.map(c => ({
            id: c.id,
            discordUsername: c.discord_username,
            displayName: c.display_name,
            timezone: c.timezone,
            englishLevel: c.english_level,
            experienceLevel: c.experience_level,
            availabilityConstraints: c.availability_constraints,
            canAppearOnMainStream: c.can_appear_main_stream,
            micQualityOk: c.mic_quality_ok,
            twitchUsername: c.twitch_username,
            status: c.status,
            submittedAt: c.created_at,
            availability: (c.availability_slots || []).map((s: { hour_index: number; preference: string }) => {
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
        console.error('Casters fetch error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
