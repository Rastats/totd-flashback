import { SupabaseClient } from '@supabase/supabase-js';
import { EVENT_DURATION_HOURS } from '@/lib/timezone-utils';

export async function autofillSchedule(teamId: string, supabase: SupabaseClient) {
    if (!teamId || teamId === 'joker') return;

    // 1. Fetch Players with Availability
    const { data: players, error: playersError } = await supabase
        .from('players')
        .select(`
            id,
            trackmania_name,
            discord_username,
            timezone,
            availability_slots (*)
        `)
        .eq('status', 'approved')
        .in('team_assignment', [teamId, 'joker']);

    if (playersError || !players) {
        console.error("Autofill: Failed to fetch players", playersError);
        return;
    }

    console.log(`Autofill: Found ${players.length} players for ${teamId}`);

    // 2. Fetch Existing Planning
    const { data: currentSlots, error: slotsError } = await supabase
        .from('team_planning')
        .select('*')
        .eq('team_id', teamId);

    if (slotsError) {
        console.error("Autofill: Failed to fetch planning", slotsError);
        return;
    }

    // Map existing slots by hour_index for easy lookup
    const planningMap = new Map<number, any>();
    currentSlots?.forEach(slot => planningMap.set(slot.hour_index, slot));

    // 3. Calculate Active Hours Stats for all players (to balance Sub assignments)
    const playerActiveHours = new Map<string, number>();
    players.forEach(p => playerActiveHours.set(p.id, 0));

    currentSlots?.forEach(slot => {
        if (slot.main_player_id) {
            const current = playerActiveHours.get(slot.main_player_id) || 0;
            playerActiveHours.set(slot.main_player_id, current + 1);
        }
    });

    const slotsToUpsert: any[] = [];

    // 4. Build availability lookup: Map<PlayerId, Set<HourIndex>>
    const availabilityMap = new Map<string, Set<number>>();
    
    players.forEach(p => {
        const hourSet = new Set<number>();
        (p.availability_slots || []).forEach((slot: any) => {
            if (typeof slot.hour_index === 'number') {
                hourSet.add(slot.hour_index);
            }
        });
        availabilityMap.set(p.id, hourSet);
    });

    // Helper to check availability - now just a simple Set lookup!
    const isPlayerAvailable = (playerId: string, hourIndex: number): boolean => {
        return availabilityMap.get(playerId)?.has(hourIndex) || false;
    };

    // 5. Iterate through all event hours
    for (let h = 0; h < EVENT_DURATION_HOURS; h++) {
        // Find players available at this hour
        const availablePlayers = players.filter(p => isPlayerAvailable(p.id, h));

        if (availablePlayers.length === 0) continue;

        // Get existing slot info
        let mainId = planningMap.get(h)?.main_player_id || null;
        let subId = planningMap.get(h)?.sub_player_id || null;
        let mainName = planningMap.get(h)?.main_player_name || null;
        let subName = planningMap.get(h)?.sub_player_name || null;

        let changed = false;

        for (const p of availablePlayers) {
            // If player is already in this slot (Main or Sub), skip
            if (mainId === p.id || subId === p.id) continue;

            const pActiveHours = playerActiveHours.get(p.id) || 0;
            const pName = p.trackmania_name || p.discord_username || "Unknown";

            if (!mainId) {
                // Case 1: Slot Empty -> Assign Main
                mainId = p.id;
                mainName = pName;
                playerActiveHours.set(p.id, pActiveHours + 1);
                changed = true;
            } else if (!subId) {
                // Case 2: Main taken, Sub empty -> Assign Sub
                subId = p.id;
                subName = pName;
                changed = true;
            } else {
                // Case 3: Both taken. Challenge the Sub.
                const currentSubActiveHours = playerActiveHours.get(subId) || 0;

                if (pActiveHours < currentSubActiveHours) {
                    subId = p.id;
                    subName = pName;
                    changed = true;
                }
            }
        }

        if (changed) {
            slotsToUpsert.push({
                team_id: teamId,
                hour_index: h,
                main_player_id: mainId,
                main_player_name: mainName,
                sub_player_id: subId,
                sub_player_name: subName,
                updated_at: new Date().toISOString()
            });
            planningMap.set(h, { ...planningMap.get(h), main_player_id: mainId, sub_player_id: subId });
        }
    }

    if (slotsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
            .from('team_planning')
            .upsert(slotsToUpsert, { onConflict: 'team_id,hour_index' });

        if (upsertError) console.error("Autofill: Upsert failed", upsertError);
    }
}

/**
 * Check if a player is available at a given hour index
 * Now simplified - just checks if the player has an availability_slot with that hour_index
 */
export function checkPlayerAvailability(player: any, hourIndex: number): boolean {
    if (!player.availability_slots || player.availability_slots.length === 0) return false;
    
    return player.availability_slots.some((slot: any) => slot.hour_index === hourIndex);
}

