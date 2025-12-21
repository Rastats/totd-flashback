import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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

        // Transform availability slots
        const availability = (player.availability_slots || []).map((s: any) => ({
            date: s.date,
            startHour: s.start_hour,
            endHour: s.end_hour,
            preference: s.preference || 'available'
        }));

        return NextResponse.json({
            player: {
                id: player.id,
                name: player.trackmania_name || player.discord_username,
                discordUsername: player.discord_username,
                teamAssignment: player.team_assignment
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
            .select('id, discord_username')
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

        // Insert new availability slots
        if (availability.length > 0) {
            const slots = availability.map((slot: any) => ({
                player_id: player.id,
                date: slot.date,
                start_hour: slot.startHour,
                end_hour: slot.endHour,
                preference: slot.preference || 'available'
            }));

            const { error: insertError } = await supabaseAdmin
                .from('availability_slots')
                .insert(slots);

            if (insertError) {
                console.error('[My Availability] Insert error:', insertError);
                return NextResponse.json({ error: 'Failed to save availability' }, { status: 500 });
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
