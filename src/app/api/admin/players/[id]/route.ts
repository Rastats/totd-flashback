import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin'; // Use Service Role client
import { isAdmin } from '@/lib/auth';

import { autofillSchedule } from '@/lib/scheduling';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const isUserAdmin = await isAdmin();
        if (!isUserAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        // Get current player state (using Admin client to ensure access)
        const { data: currentPlayer } = await supabaseAdmin
            .from('players')
            .select('team_assignment')
            .eq('id', id)
            .single();

        const oldTeam = currentPlayer?.team_assignment;

        const updateData: Record<string, unknown> = {};
        if (body.status) updateData.status = body.status;
        if (body.teamAssignment) updateData.team_assignment = body.teamAssignment;
        if (typeof body.isCaptain === 'boolean') updateData.is_captain = body.isCaptain;

        const { error } = await supabaseAdmin
            .from('players')
            .update(updateData)
            .eq('id', id);

        if (error) {
            console.error('Update player error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Update Availability if provided
        if (body.availability && Array.isArray(body.availability)) {
            // Delete existing slots (Admin client ensures we can delete anyone's slots)
            const { error: deleteError } = await supabaseAdmin
                .from('availability_slots')
                .delete()
                .eq('player_id', id);

            if (deleteError) {
                console.error('Error deleting slots:', deleteError);
                return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
            }

            // Insert new slots
            if (body.availability.length > 0) {
                const slotsToInsert = body.availability.map((s: any) => ({
                    player_id: id,
                    date: s.date,
                    start_hour: s.startHour,
                    end_hour: s.endHour,
                    preference: s.preference
                }));

                const { error: insertError } = await supabaseAdmin
                    .from('availability_slots')
                    .insert(slotsToInsert);

                if (insertError) {
                    console.error('Error inserting slots:', insertError);
                    return NextResponse.json({ error: "Failed to save new slots" }, { status: 500 });
                }
            }
        }

        // Handle Team Change / Autofill
        const newTeam = body.teamAssignment;

        // If team changed, we MUST clean up the player from old planning to avoid "Unknown" ghosts
        if (newTeam && newTeam !== oldTeam) {
            console.log(`Player ${id} moved from ${oldTeam} to ${newTeam}. Cleaning up old slots.`);

            // Remove player from ALL planning slots (globally safe, as you can only be in one team)
            // Set main_player_id to null where it matches
            await supabaseAdmin.from('team_planning')
                .update({ main_player_id: null, main_player_name: null })
                .eq('main_player_id', id);

            // Set sub_player_id to null where it matches
            await supabaseAdmin.from('team_planning')
                .update({ sub_player_id: null, sub_player_name: null })
                .eq('sub_player_id', id);

            // Trigger Autofill for NEW team
            if (newTeam !== 'joker') {
                await autofillSchedule(newTeam, supabaseAdmin);
            }

            // Trigger Autofill for OLD team (to fill the gap)
            if (oldTeam && oldTeam !== 'joker') {
                await autofillSchedule(oldTeam, supabaseAdmin);
            }
        }
        // If team didn't change (just availability update?), maybe re-run autofill for current team?
        else if (body.availability || (newTeam && newTeam === oldTeam)) {
            // If availability changed, we might want to re-run autofill for their current team
            const targetTeam = newTeam || oldTeam;
            if (targetTeam && targetTeam !== 'joker') {
                await autofillSchedule(targetTeam, supabaseAdmin);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
