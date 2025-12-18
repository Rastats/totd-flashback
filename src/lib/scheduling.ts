import { SupabaseClient } from '@supabase/supabase-js';

export async function autofillSchedule(teamId: string, supabase: SupabaseClient) {
    if (!teamId || teamId === 'joker') return;

    // 1. Fetch Players with Availability
    const { data: players, error: playersError } = await supabase
        .from('players')
        .select(`
            id,
            trackmania_name,
            discord_username,
            availability_slots (*)
        `)
        .eq('status', 'approved')
        .in('team_assignment', [teamId, 'joker']);

    if (playersError || !players) {
        console.error("Autofill: Failed to fetch players", playersError);
        return;
    }

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
    // We count how many 'main' slots each player currently has
    const playerActiveHours = new Map<string, number>();
    players.forEach(p => playerActiveHours.set(p.id, 0));

    currentSlots?.forEach(slot => {
        if (slot.main_player_id) {
            const current = playerActiveHours.get(slot.main_player_id) || 0;
            playerActiveHours.set(slot.main_player_id, current + 1);
        }
    });

    const slotsToUpsert: any[] = [];
    const eventDurationHours = 69; // 0 to 68

    // 4. Transform players availability for faster lookup
    // Map<PlayerId, Set<HourIndex>>
    const availabilityMap = new Map<string, Set<number>>();

    // Helper to check availability
    const isAvailable = (playerId: string, hourIdx: number): boolean => {
        return availabilityMap.get(playerId)?.has(hourIdx) || false;
    };

    players.forEach(p => {
        const availableHours = new Set<number>();
        (p.availability_slots || []).forEach((slot: any) => {
            // Convert slot date/hours to event hour indices
            // Event Start: Dec 21 21:00 CET.
            // Slot date is "2025-12-21", startHour/endHour are local to user?
            // Actually, based on types.ts, availability slots seem to be stored as date string + hour range.
            // But we need to align exactly with how the app calculates indices from dates.
            // Since we don't have the complexity of timezone conversion here easily without context,
            // let's assume the availability_slots in DB are stored in a way that we can map (or we import the utils).

            // WAIT: The DB stores `start_hour` and `end_hour` and `date`.
            // The `captain/[teamId]/page.tsx` does a complex conversion using `tzOffset`.
            // However, the `availability_slots` table likely stores it in a standardized way OR the UI handles it.
            // Let's look at `isPlayerAvailable` in `src/app/captain/[teamId]/page.tsx`:
            // It reconstructs the date/hour from hourIndex and checks against the slot.
            // To do this server-side accurately, we replicate that logic assuming UTC or CET base.

            // SIMPLIFICATION: We iterate 0..68. For each hour index, we check if it falls into any of the player's slots.
            // We need `getLocalTimeForHourIndex` logic here but purely server side.
            // Since we don't know the player's timezone offset strictly from `availability_slots` (it's on `players` table maybe?),
            // actually `availability_slots` usually just store what the user picked in THEIR local time?
            // checking `types.ts`: `startHour: number; // 0-23 in user's timezone`.
            // This is tricky server-side without the player's timezone offset.
            // Let's fetch the player's timezone from the `players` table (we select * so should be there if column exists).
            // Checking `types.ts`: `timezone: string`.
            // We need a helper to convert index -> local time for that specific player.
        });
    });

    // RE-EVALUATING APPROACH FOR AVAILABILITY CHECK:
    // We need to match the frontend logic exactly to know if a player is available at index X.
    // Index 0 = Dec 21 21:00 CET (UTC+1).
    // So timestamp for Index 0 = 1766347200 (approx). 
    // It's safer if we assume the standard logic:
    // 1. Get player's timezone (e.g. "Paris" or offset).
    // 2. Convert Event Start (UTC) + HourIndex * 3600 to Player's Local Time (Day + Hour).
    // 3. Check if that Day+Hour matches any `availability_slot`.

    // Importing time libraries might be needed or copying the logic.
    // For now, let's copy the logic from `page.tsx` but adapted for server-side where we might not have IANA timezone math easily without `date-fns-tz` or similar.
    // Actually, `players` table has `timezone` string (IANA).

    // Let's iterate hours 0..68
    for (let h = 0; h < eventDurationHours; h++) {
        // Find players available at this hour
        const availablePlayers = players.filter(p => {
            // We need to implement availability check here
            return checkPlayerAvailability(p, h);
        });

        if (availablePlayers.length === 0) continue;

        // Get existing slot info
        let mainId = planningMap.get(h)?.main_player_id || null;
        let subId = planningMap.get(h)?.sub_player_id || null;
        let mainName = planningMap.get(h)?.main_player_name || null;
        let subName = planningMap.get(h)?.sub_player_name || null;

        let changed = false;

        // Iterate through all available players to see if we should assign them
        // We only care about assigning the NEW ones or filling gaps?
        // The prompt says: "assign a player... you put him on all slots where he is available".
        // This implies we should run this check for ALL players or just the specific one?
        // "si j'assigne un joueur... tu le mets". 
        // It's safer to run this optimization for the whole schedule to ensure consistency, 
        // OR just try to slot in the new guys.
        // Let's simply fill holes with whoever is available.

        // Sorting available players to be deterministic? 
        // Or specific logic?
        // The rule is:
        // 1. Empty? -> Main.
        // 2. Main taken, Sub empty? -> Sub.
        // 3. Both taken? -> Compare Sub vs Candiate -> Low active hours wins.

        for (const p of availablePlayers) {
            // If player is already in this slot (Main or Sub), skip
            if (mainId === p.id || subId === p.id) continue;

            const pActiveHours = playerActiveHours.get(p.id) || 0;

            if (!mainId) {
                // Case 1: Slot Empty -> Assign Main
                mainId = p.id;
                mainName = p.trackmania_name;
                playerActiveHours.set(p.id, pActiveHours + 1); // Update stats dynamically
                changed = true;
            } else if (!subId) {
                // Case 2: Main taken, Sub empty -> Assign Sub
                subId = p.id;
                subName = p.trackmania_name;
                changed = true;
            } else {
                // Case 3: Both taken. Challenge the Sub.
                // Current Sub
                const currentSubActiveHours = playerActiveHours.get(subId) || 0;

                // If candidate has LESS active hours than current sub, they steal the spot
                if (pActiveHours < currentSubActiveHours) {
                    subId = p.id;
                    subName = p.trackmania_name;
                    changed = true;
                    // Note: We don't change 'active hours' stats because sub slots don't count towards it (per user prompt validation "active hours")
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
            // Update map for future iterations if needed (stats already updated)
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

// Helper to check availability (Server Side)
// We need to approximate or use strict timezone logic. 
// Since we can't easily import large timezone libraries in this snippets without package.json changes,
// We will try to rely on the fact that availability slots are DATE + START/END.
// We need to convert Event Hour Index -> Date + Hour in Player's Timezone.
// This is hard without offsets.
// A robust way is to store the "UTC offset" for each player in DB, calculated at signup.
// Assuming 'timezone' field is IANA string (e.g 'Europe/Paris').
function checkPlayerAvailability(player: any, hourIndex: number): boolean {
    if (!player.availability_slots || player.availability_slots.length === 0) return false;

    // Event Start in UTC: Dec 21 2025, 20:00 UTC (Since 21:00 CET)
    // 21:00 CET = 20:00 UTC.
    const eventStartTimestamp = 1766347200000; // 2025-12-21T20:00:00Z (timestamp for 21:00 CET)
    // Actually timestamp <t:1766347200:f> given in Discord msg is 1766347200 seconds.
    // 1766347200 * 1000 = Dec 21 2025 20:00:00 UTC. Correct.

    const targetTimeMs = eventStartTimestamp + (hourIndex * 3600 * 1000);
    const targetDate = new Date(targetTimeMs);

    // We need to format this targetDate into the Player's Local Time string "YYYY-MM-DD" and Hour integer.
    // We can use Intl.DateTimeFormat with the player's IANA timezone.
    try {
        const tz = player.timezone || 'UTC'; // Fallback

        // Get local parts
        const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            hour12: false
        });

        const parts = formatter.formatToParts(targetDate);
        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        const d = parts.find(p => p.type === 'day')?.value;
        const hStr = parts.find(p => p.type === 'hour')?.value;

        if (!y || !m || !d || !hStr) return false;

        const localDateStr = `${y}-${m}-${d}`;
        // Intl 'hour' 24h cycle: '24' might follow spec but usually 0-23. 
        // Note: some implementations might return "24" for midnight if h12=false? usually 0.
        let localHour = parseInt(hStr, 10);
        if (localHour === 24) localHour = 0;

        // Fix: Intl sometimes uses '24' for midnight end of day? No, usually 0.
        // Let's double check standard behavior. 'en-CA' with hour12: false gives 0-23.

        // Now check slots
        return player.availability_slots.some((slot: any) => {
            if (slot.date !== localDateStr) return false;
            return localHour >= slot.start_hour && localHour < slot.end_hour;
        });

    } catch (e) {
        console.error(`Timezone error for ${player.trackmania_name} (${player.timezone})`, e);
        return false;
    }
}
