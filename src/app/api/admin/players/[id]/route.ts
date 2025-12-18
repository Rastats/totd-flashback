import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

import { isAdmin } from '@/lib/auth';

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

        const updateData: Record<string, unknown> = {};
        if (body.status) updateData.status = body.status;
        if (body.teamAssignment) updateData.team_assignment = body.teamAssignment;
        if (typeof body.isCaptain === 'boolean') updateData.is_captain = body.isCaptain;

        const { error } = await supabase
            .from('players')
            .update(updateData)
            .eq('id', id);

        if (error) {
            console.error('Update player error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Update Availability if provided
        if (body.availability && Array.isArray(body.availability)) {
            // Delete existing slots
            const { error: deleteError } = await supabase
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

                const { error: insertError } = await supabase
                    .from('availability_slots')
                    .insert(slotsToInsert);

                if (insertError) {
                    console.error('Error inserting slots:', insertError);
                    return NextResponse.json({ error: "Failed to save new slots" }, { status: 500 });
                }
            }
        }

        // Trigger Auto-Fill Schedule if teamAssignment changed
        if (body.teamAssignment && typeof body.teamAssignment === 'string') {
            // We need to import it dynamically or at top level to avoid cycles if any?
            // Dynamic import or separate file is fine.
            try {
                const { autofillSchedule } = await import('@/lib/scheduling');
                await autofillSchedule(body.teamAssignment, supabase);
            } catch (scheduleError) {
                console.error('Autofill error:', scheduleError);
                // Don't fail the request, just log it
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
