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

        // Update Availability if provided (supports hourIndices or legacy format)
        if (body.hourIndices && Array.isArray(body.hourIndices)) {
            // NEW FORMAT: Direct hour_index array
            const { error: deleteError } = await supabaseAdmin
                .from('availability_slots')
                .delete()
                .eq('player_id', id);

            if (deleteError) {
                console.error('Error deleting slots:', deleteError);
                return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
            }

            const slots = body.hourIndices
                .filter((h: number) => h >= 0 && h < 69)
                .map((hourIndex: number) => ({
                    player_id: id,
                    hour_index: hourIndex,
                    preference: 'ok'
                }));

            if (slots.length > 0) {
                const { error: insertError } = await supabaseAdmin
                    .from('availability_slots')
                    .insert(slots);

                if (insertError) {
                    console.error('Error inserting slots:', insertError);
                    return NextResponse.json({ error: "Failed to save new slots" }, { status: 500 });
                }
            }
        } else if (body.availability && Array.isArray(body.availability)) {
            // LEGACY FORMAT: date/startHour/endHour/preference
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
                // Normalization: Flatten to avoid overlaps/duplicates
                const hourlyMap = new Map<string, string>(); // Key: "yyyy-mm-dd_h", Value: preference

                body.availability.forEach((s: any) => {
                    for (let h = s.startHour; h < s.endHour; h++) {
                        const key = `${s.date}_${h}`;
                        // If conflict, 'preferred' wins over 'ok'
                        if (hourlyMap.has(key)) {
                            if (s.preference === 'preferred') hourlyMap.set(key, 'preferred');
                        } else {
                            hourlyMap.set(key, s.preference);
                        }
                    }
                });

                // Reconstruct contiguous slots
                const normalizedSlots: any[] = [];
                // Sort keys to scan in order
                const sortedKeys = Array.from(hourlyMap.keys()).sort();

                // Group by day to make it easier
                const days = new Set(sortedKeys.map(k => k.split('_')[0]));

                days.forEach(day => {
                    const hoursForDay = sortedKeys
                        .filter(k => k.startsWith(day))
                        .map(k => parseInt(k.split('_')[1]))
                        .sort((a, b) => a - b);

                    if (hoursForDay.length === 0) return;

                    let currentStart = hoursForDay[0];
                    let currentEnd = currentStart + 1;
                    let currentpref = hourlyMap.get(`${day}_${currentStart}`);

                    for (let i = 1; i < hoursForDay.length; i++) {
                        const h = hoursForDay[i];
                        const pref = hourlyMap.get(`${day}_${h}`);

                        // Check if contiguous AND same preference
                        if (h === currentEnd && pref === currentpref) {
                            currentEnd++; // Extend
                        } else {
                            // Push current and start new
                            normalizedSlots.push({
                                player_id: id,
                                date: day,
                                start_hour: currentStart,
                                end_hour: currentEnd,
                                preference: currentpref
                            });
                            currentStart = h;
                            currentEnd = currentStart + 1;
                            currentpref = pref;
                        }
                    }
                    // Push final
                    normalizedSlots.push({
                        player_id: id,
                        date: day,
                        start_hour: currentStart,
                        end_hour: currentEnd,
                        preference: currentpref
                    });
                });

                if (normalizedSlots.length > 0) {
                    const { error: insertError } = await supabaseAdmin
                        .from('availability_slots')
                        .insert(normalizedSlots);

                    if (insertError) {
                        console.error('Error inserting slots:', insertError);
                        return NextResponse.json({ error: "Failed to save new slots" }, { status: 500 });
                    }
                }
            }
        }

        // Handle Team Change - cleanup old planning
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

            // NOTE: Autofill disabled - captains manage schedules manually
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
