/**
 * Shared utility for adding penalties to teams
 * Used by both Tiltify webhook processing and Admin Dashboard
 * 
 * Lists are always sorted by penalty_id DESCENDING (highest first, lowest at end)
 * This means the penalty to override is always the LAST one in the array
 */

import { supabaseAdmin } from './supabase-admin';
import { PENALTY_CONFIG } from './penalty-config';

// Immediate-effect penalties (must activate immediately, can override others)
const IMMEDIATE_PENALTY_IDS = [7, 9, 10]; // Player Switch, AT or Bust, Back to the Future

export interface AddPenaltyResult {
    success: boolean;
    error?: string;
    destination?: 'active' | 'waitlist';
    removed?: string; // Name of removed penalty if override occurred
    blocked?: boolean; // True if blocked by shield
}

/**
 * Sort penalties by penalty_id DESCENDING (highest first, lowest at end)
 * This ensures the penalty to remove on override is always the last one
 */
function sortPenaltiesDesc(penalties: any[]): any[] {
    return penalties.sort((a, b) => {
        const idA = a.penalty_id ?? a.id ?? 0;
        const idB = b.penalty_id ?? b.id ?? 0;
        return idB - idA; // Descending: highest first
    });
}

/**
 * Add a penalty to a team's state
 * Handles: shield blocking, duplicate prevention, 2-slot limits, immediate override
 */
export async function addPenaltyToTeamState(
    teamId: number,
    penaltyId: number,
    penaltyName: string,
    donationId?: string
): Promise<AddPenaltyResult> {
    // Validate penalty ID exists in config
    const config = PENALTY_CONFIG[penaltyId];
    if (!config) {
        console.error(`[PenaltyUtils] Unknown penalty ID: ${penaltyId}`);
        return { success: false, error: `Unknown penalty ID: ${penaltyId}` };
    }

    // Get current team state
    const { data: teamData, error: fetchError } = await supabaseAdmin
        .from('team_server_state')
        .select('penalties_active, penalties_waitlist, shield_active, shield_type, shield_expires_at, completed_map_ids')
        .eq('team_id', teamId)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error(`[PenaltyUtils] Failed to fetch team ${teamId} state:`, fetchError);
        return { success: false, error: 'Failed to fetch team state' };
    }

    // Check if shield is active (blocks ALL penalties)
    if (teamData?.shield_active) {
        if (teamData.shield_expires_at && new Date(teamData.shield_expires_at) > new Date()) {
            console.log(`[PenaltyUtils] Shield active for Team ${teamId}, blocking penalty: ${penaltyName}`);
            return { success: false, blocked: true, error: 'Team has active shield - penalties blocked' };
        }
    }

    // Get and sort existing lists (highest ID first, lowest at end)
    let active: any[] = sortPenaltiesDesc(teamData?.penalties_active || []);
    let waitlist: any[] = sortPenaltiesDesc(teamData?.penalties_waitlist || []);

    // Get penalty config for immediate check (config already validated at start)
    const isImmediate = IMMEDIATE_PENALTY_IDS.includes(penaltyId);

    // Check if this penalty is already active (duplicate prevention)
    const alreadyActive = active.some((p: any) => (p.penalty_id ?? p.id) === penaltyId);
    if (isImmediate && alreadyActive) {
        return {
            success: false,
            error: `${penaltyName} is already active for this team`
        };
    }

    // Create penalty object
    const newPenalty: any = {
        id: Date.now(),
        penalty_id: penaltyId,
        name: penaltyName,
        donation_id: donationId || null,
        maps_remaining: config?.maps ?? null,
        maps_total: config?.maps ?? null,
        timer_minutes: config?.timerMinutes ?? null,
        added_at: new Date().toISOString(),
        activated_at: null as string | null
    };

    let removedPenalty: any = null;
    let destination: 'active' | 'waitlist';

    if (isImmediate) {
        // IMMEDIATE → ACTIVE (remove last element = lowest ID if full)
        if (active.length >= 2) {
            removedPenalty = active.pop(); // Last = lowest ID (list is sorted desc)
        }

        // Activate the penalty
        newPenalty.activated_at = new Date().toISOString();
        if (config?.timerMinutes) {
            newPenalty.timer_expires_at = new Date(Date.now() + config.timerMinutes * 60 * 1000).toISOString();
        }
        active.push(newPenalty);
        active = sortPenaltiesDesc(active); // Re-sort after adding
        destination = 'active';

        console.log(`[PenaltyUtils] Team ${teamId}: Activated ${penaltyName} (immediate)${removedPenalty ? `, removed ${removedPenalty.name}` : ''}`);
    } else {
        // NON-IMMEDIATE → WAITLIST (remove last element = lowest ID if full)
        if (waitlist.length >= 2) {
            removedPenalty = waitlist.pop(); // Last = lowest ID (list is sorted desc)
        }
        waitlist.push(newPenalty);
        waitlist = sortPenaltiesDesc(waitlist); // Re-sort after adding
        destination = 'waitlist';

        console.log(`[PenaltyUtils] Team ${teamId}: ${penaltyName} added to waitlist${removedPenalty ? `, removed ${removedPenalty.name}` : ''}`);
    }

    // NOTE: roulette_map is now calculated by the plugin and sent via sync
    // Server no longer generates random - plugin detects RR in waitlist and calculates locally

    // Update team_server_state (lists are now sorted)
    const { error: updateError } = await supabaseAdmin
        .from('team_server_state')
        .upsert({
            team_id: teamId,
            penalties_active: active,
            penalties_waitlist: waitlist,
            updated_at: new Date().toISOString()
        }, { onConflict: 'team_id' });

    if (updateError) {
        console.error(`[PenaltyUtils] Failed to update team ${teamId}:`, updateError);
        return { success: false, error: 'Failed to update team state' };
    }

    // Log to event_log
    let message = `Team ${teamId}: ${penaltyName} added to ${destination}`;
    if (removedPenalty) {
        message += ` (removed ${removedPenalty.name})`;
    }
    if (donationId) {
        message += ` [donation]`;
    } else {
        message += ` [admin]`;
    }

    await supabaseAdmin.from('event_log').insert({
        event_type: 'penalty_applied',
        team_id: teamId,
        message,
        metadata: {
            penalty_id: penaltyId,
            penalty_name: penaltyName,
            destination,
            donation_id: donationId,
            removed: removedPenalty?.name
        }
    });

    return {
        success: true,
        destination,
        removed: removedPenalty?.name
    };
}
