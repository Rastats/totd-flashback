import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { hourIndexToDateTime } from '@/lib/timezone-utils';

// GET - Fetch current player's availability
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Find player by Discord username
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select(`
                id,
                trackmania_name,
                discord_username,
                team_assignment,
                timezone,
                availability_slots (*)
            `)
            .ilike('discord_username', session.user.username)
            .eq('status', 'approved')
            .single();

        if (playerError || !player) {
            return NextResponse.json({ 
                error: 'Player not found',
                message: 'Your Discord account is not linked to an approved player. Contact an admin.'
            }, { status: 404 });
        }

        // Transform hour_index to date/hour for frontend display
        const availability = (player.availability_slots || []).map((s: any) => {
            const { date, hour } = hourIndexToDateTime(s.hour_index);
            return {
                hourIndex: s.hour_index,
                date,
                hour,
                preference: s.preference || 'available'
            };
        });

        return NextResponse.json({
            player: {
                id: player.id,
                name: player.trackmania_name || player.discord_username,
                discordUsername: player.discord_username,
                teamAssignment: player.team_assignment,
                timezone: player.timezone
            },
            availability
        });
    } catch (error) {
        console.error('[My Availability] GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT - Update player's availability
export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.username) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { availability } = await request.json();
        if (!Array.isArray(availability)) {
            return NextResponse.json({ error: 'Invalid availability format' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // Find player by Discord username
        const { data: player, error: playerError } = await supabaseAdmin
            .from('players')
            .select('id, discord_username, timezone')
            .ilike('discord_username', session.user.username)
            .eq('status', 'approved')
            .single();

        if (playerError || !player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        // Delete existing availability slots for this player
        await supabaseAdmin
            .from('availability_slots')
            .delete()
            .eq('player_id', player.id);

        // Insert new availability slots (hour_indices format only)
        if (availability.length > 0) {
            const slots = availability
                .filter((s: { hourIndex?: number }) => typeof s.hourIndex === 'number' && s.hourIndex >= 0 && s.hourIndex < 69)
                .map((s: { hourIndex: number; preference?: string }) => ({
                    player_id: player.id,
                    hour_index: s.hourIndex,
                    preference: s.preference || 'ok'
                }));

            if (slots.length > 0) {
                const { error: insertError } = await supabaseAdmin
                    .from('availability_slots')
                    .insert(slots);

                if (insertError) {
                    console.error('[My Availability] Insert error:', insertError);
                    return NextResponse.json({ error: 'Failed to save availability' }, { status: 500 });
                }
            }
        }

        console.log(`[My Availability] Updated ${availability.length} slots for ${player.discord_username}`);

        return NextResponse.json({ 
            success: true, 
            slotsCount: availability.length 
        });
    } catch (error) {
        console.error('[My Availability] PUT error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
