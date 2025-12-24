/**
 * Shared utility for adding penalties to teams
 * Used by both Tiltify webhook processing and Admin Dashboard
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
 * Add a penalty to a team's state
 * Handles: shield blocking, duplicate prevention, 2-slot limits, immediate override
 */
export async function addPenaltyToTeamState(
    teamId: number,
    penaltyId: number,
    penaltyName: string,
    donationId?: string
): Promise<AddPenaltyResult> {
    // Get current team state
    const { data: teamData, error: fetchError } = await supabaseAdmin
        .from('team_server_state')
        .select('penalties_active, penalties_waitlist, shield_active, shield_type, shield_expires_at')
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

    let active: any[] = teamData?.penalties_active || [];
    let waitlist: any[] = teamData?.penalties_waitlist || [];

    // Get penalty config
    const config = PENALTY_CONFIG[penaltyId];
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
        // IMMEDIATE → ACTIVE (override lowest ID if full)
        if (active.length >= 2) {
            // Find and remove lowest ID
            let lowestIdx = 0;
            let lowestId = active[0]?.penalty_id ?? active[0]?.id ?? 999;
            for (let i = 1; i < active.length; i++) {
                const thisId = active[i]?.penalty_id ?? active[i]?.id ?? 999;
                if (thisId < lowestId) {
                    lowestId = thisId;
                    lowestIdx = i;
                }
            }
            removedPenalty = active.splice(lowestIdx, 1)[0];
        }

        // Activate the penalty
        newPenalty.activated_at = new Date().toISOString();
        if (config?.timerMinutes) {
            newPenalty.timer_expires_at = new Date(Date.now() + config.timerMinutes * 60 * 1000).toISOString();
        }
        active.push(newPenalty);
        destination = 'active';

        console.log(`[PenaltyUtils] Team ${teamId}: Activated ${penaltyName} (immediate)${removedPenalty ? `, removed ${removedPenalty.name}` : ''}`);
    } else {
        // NON-IMMEDIATE → WAITLIST (override lowest ID if full)
        if (waitlist.length >= 2) {
            // Find and remove lowest ID
            let lowestIdx = 0;
            let lowestId = waitlist[0]?.penalty_id ?? waitlist[0]?.id ?? 999;
            for (let i = 1; i < waitlist.length; i++) {
                const thisId = waitlist[i]?.penalty_id ?? waitlist[i]?.id ?? 999;
                if (thisId < lowestId) {
                    lowestId = thisId;
                    lowestIdx = i;
                }
            }
            removedPenalty = waitlist.splice(lowestIdx, 1)[0];
        }
        waitlist.push(newPenalty);
        destination = 'waitlist';

        console.log(`[PenaltyUtils] Team ${teamId}: ${penaltyName} added to waitlist${removedPenalty ? `, removed ${removedPenalty.name}` : ''}`);
    }

    // Update team_server_state
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
