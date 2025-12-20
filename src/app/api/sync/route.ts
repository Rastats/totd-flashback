import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateApiKey } from '@/lib/api-auth';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { syncDonations, getCampaignData, getTeamPots, getRecentDonations } from '@/lib/tiltify';

export const dynamic = 'force-dynamic';

// Structure expected from the plugin
interface SyncPayload {
    account_id: string;
    team_id: number;
    timestamp: number;

    players: {
        active: string;
        waiting: string;
        joker_used: boolean;
    };

    current_map: {
        id: number;
        name: string;
        author: string;
        status: string;
    };

    progress: {
        maps_completed: number;
        maps_total: number;
        redo_remaining: number;
        completed_ids?: number[];  // Array of completed map indices
    };

    penalties: {
        active: Array<{
            id: number;
            name: string;
            maps_remaining: number;
            timer_remaining_ms: number | null;
        }>;
        waitlist: Array<{
            id: number;
            name: string;
        }>;
        applied_donation_ids?: string[];   // Donation IDs just applied
        completed_donation_ids?: string[]; // Donation IDs just completed
    };

    shield: {
        active: boolean;
        type: string;
        remaining_ms: number;
        cooldown_remaining_ms: number;
    };

    mode: string;
}

export async function POST(request: Request) {
    try {
        // Rate limiting
        const rateLimited = applyRateLimit(request, RATE_LIMITS.plugin);
        if (rateLimited) return rateLimited;

        // Validate API key
        if (!validateApiKey(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data: SyncPayload = await request.json();

        // ============================================
        // VERSION VALIDATION: Block old/unauthorized plugin versions
        // SKIP for public_only requests (non-roster players just viewing data)
        // Set ALLOWED_PLUGIN_VERSIONS env var as comma-separated list
        // e.g., "1.43.6,1.43.7" or "1.43.6" for single version
        // If not set, all versions are allowed (backward compatibility)
        // ============================================
        const isPublicOnly = (data as any).public_only === true;
        const allowedVersionsEnv = process.env.ALLOWED_PLUGIN_VERSIONS;
        
        if (allowedVersionsEnv && !isPublicOnly) {
            const allowedVersions = allowedVersionsEnv.split(',').map(v => v.trim());
            const pluginVersion = (data as any).plugin_version;
            
            if (!pluginVersion) {
                console.warn(`[Sync] Rejected: No plugin_version in request`);
                return NextResponse.json({ 
                    error: 'Plugin version required', 
                    message: 'Please update your plugin to the latest version'
                }, { status: 403 });
            }
            
            if (!allowedVersions.includes(pluginVersion)) {
                console.warn(`[Sync] Rejected: Plugin version ${pluginVersion} not in allowed list: ${allowedVersions.join(', ')}`);
                return NextResponse.json({ 
                    error: 'Plugin version not allowed', 
                    message: `Version ${pluginVersion} is outdated. Please update to: ${allowedVersions.join(' or ')}`
                }, { status: 403 });
            }
            
            console.log(`[Sync] Version ${pluginVersion} validated`);
        }

        const supabase = getSupabaseAdmin();

        // ============================================
        // PUBLIC ONLY MODE: For non-roster players who just want to view data
        // Skip account_id validation and return public team data
        // ============================================
        if ((data as any).public_only === true) {
            console.log(`[Sync] Public data request from team_id=${data.team_id}`);

            // Get all public data in parallel
            const [campaignData, teamPots, teamStatuses] = await Promise.all([
                getCampaignData(),
                getTeamPots(),
                supabase.from('team_status').select('*').order('team_id')
            ]);

            return NextResponse.json({
                success: true,
                public_only: true,

                // Donations data
                donations: {
                    totalAmount: campaignData.totalAmount,
                    currency: campaignData.currency,
                    goal: campaignData.goal,
                    teamPots: teamPots,
                    recentDonations: [] // No recent donations for public requests
                },

                // All teams' progress (for leaderboard display)
                allTeamsProgress: (teamStatuses.data || []).map(t => ({
                    team_id: t.team_id,
                    maps_completed: t.maps_completed || 0,
                    active_player: t.active_player || null
                }))
            });
        }

        // For non-public requests, account_id is required
        if (!data.account_id) {
            return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });
        }

        // Check if account_id is in the players roster
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('id, trackmania_name, team_assignment, trackmania_id')
            .or(`trackmania_id.eq.${data.account_id},trackmania_name.eq.${data.account_id}`)
            .eq('status', 'approved')
            .single();

        if (playerError || !player) {
            // Not in roster - ignore but don't error
            console.log(`[Sync] Account ${data.account_id} not in roster, ignoring`);
            return NextResponse.json({
                success: false,
                reason: 'not_in_roster'
            });
        }

        // Parse team_assignment from string "team4" to integer 4
        let teamId: number;
        const teamAssignment = player.team_assignment;

        if (teamAssignment && typeof teamAssignment === 'string' && teamAssignment.startsWith('team')) {
            teamId = parseInt(teamAssignment.replace('team', ''), 10);
        } else if (typeof teamAssignment === 'number') {
            teamId = teamAssignment;
        } else {
            // Joker or invalid - use team_id from plugin
            teamId = data.team_id;
        }

        if (!teamId || teamId < 1 || teamId > 4) {
            return NextResponse.json({
                success: false,
                reason: 'invalid_team'
            });
        }

        // Get existing team_status to preserve maps_completed if -1 is sent
        let existingMapsCompleted = 0;
        let existingMapsTotal = 2000;

        if (data.progress?.maps_completed === -1 || data.progress?.maps_total === -1) {
            const { data: existing } = await supabase
                .from('team_status')
                .select('maps_completed, maps_total')
                .eq('team_id', teamId)
                .single();

            if (existing) {
                existingMapsCompleted = existing.maps_completed || 0;
                existingMapsTotal = existing.maps_total || 2000;
            }
        }

        // Determine final values: -1 means "don't update", use existing
        const finalMapsCompleted = data.progress?.maps_completed === -1
            ? existingMapsCompleted
            : (data.progress?.maps_completed ?? 0);
        const finalMapsTotal = data.progress?.maps_total === -1
            ? existingMapsTotal
            : (data.progress?.maps_total ?? 2000);

        // Upsert into team_status table
        const { error: upsertError } = await supabase
            .from('team_status')
            .upsert({
                team_id: teamId,
                player_name: player.trackmania_name,
                account_id: data.account_id,

                // Players
                active_player: data.players?.active || null,
                waiting_player: data.players?.waiting || null,
                joker_used: data.players?.joker_used || false,

                // Current map
                current_map_id: data.current_map?.id || null,
                current_map_name: data.current_map?.name || null,
                current_map_author: data.current_map?.author || null,
                current_map_status: data.current_map?.status || null,

                // Progress - use conditional values
                maps_completed: finalMapsCompleted,
                maps_total: finalMapsTotal,
                redo_remaining: data.progress?.redo_remaining || 0,
                
                // Completed map IDs (merged from team_progress)
                completed_map_ids: data.progress?.completed_ids || [],

                // Penalties (stored as JSONB)
                penalties_active: data.penalties?.active || [],
                penalties_waitlist: data.penalties?.waitlist || [],

                // Shield - Calculate expires_at from remaining_ms
                shield_active: data.shield?.active || false,
                shield_type: data.shield?.type || null,
                shield_remaining_ms: data.shield?.remaining_ms || 0,
                shield_expires_at: data.shield?.active && data.shield?.remaining_ms > 0
                    ? new Date(Date.now() + data.shield.remaining_ms).toISOString()
                    : null,
                shield_cooldown_ms: data.shield?.cooldown_remaining_ms || 0,

                // Mode
                mode: data.mode || 'Normal',

                // Timestamp
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'team_id'
            });

        if (upsertError) {
            console.error('[Sync] Upsert error:', upsertError);
            return NextResponse.json({
                error: upsertError.message
            }, { status: 500 });
        }

        console.log(`[Sync] Team ${teamId} updated by ${player.trackmania_name}`);

        // Process penalty tracking updates
        const appliedIds = data.penalties?.applied_donation_ids || [];
        const completedIds = data.penalties?.completed_donation_ids || [];

        if (appliedIds.length > 0) {
            await supabase
                .from('processed_donations')
                .update({ penalty_applied: true })
                .in('donation_id', appliedIds);
            console.log(`[Sync] Marked ${appliedIds.length} penalties as applied`);
        }

        if (completedIds.length > 0) {
            await supabase
                .from('processed_donations')
                .update({
                    penalty_completed: true,
                    penalty_completed_at: new Date().toISOString()
                })
                .in('donation_id', completedIds);
            console.log(`[Sync] Marked ${completedIds.length} penalties as completed`);
        }

        // ============================================
        // Build comprehensive response with all data
        // This replaces the need for separate /donations, /player-status, /team-progress calls
        // ============================================

        // Fetch donation data (throttled sync + cached read)
        try {
            // Sync donations from Tiltify (throttled to every 30s)
            await syncDonations();
        } catch (syncError) {
            console.error('[Sync] Donation sync error (continuing):', syncError);
        }

        // Get all data in parallel
        const [campaignData, teamPots, recentDonations, teamStatuses] = await Promise.all([
            getCampaignData(),
            getTeamPots(),
            getRecentDonations(20),
            supabase.from('team_status').select('*').order('team_id')
        ]);

        // Get player status for this team
        const myTeamStatus = teamStatuses.data?.find(t => t.team_id === teamId);

        return NextResponse.json({
            success: true,
            team_id: teamId,
            player: player.trackmania_name,

            // Donations data (replaces /donations)
            donations: {
                totalAmount: campaignData.totalAmount,
                currency: campaignData.currency,
                goal: campaignData.goal,
                teamPots: teamPots,
                recentDonations: recentDonations
            },

            // Player status for my team (replaces /player-status)
            playerStatus: {
                activePlayer: myTeamStatus?.active_player || null,
                waitingPlayer: myTeamStatus?.waiting_player || null
            },

            // Team progress (replaces /team-progress)
            teamProgress: {
                mapsCompleted: myTeamStatus?.maps_completed || 0,
                mapsTotal: myTeamStatus?.maps_total || 2000,
                redoRemaining: myTeamStatus?.redo_remaining || 0
            },

            // All teams' progress (for leaderboard display)
            allTeamsProgress: (teamStatuses.data || []).map(t => {
                // If data is older than 45 seconds, assume offline (active player crashed/quit)
                const updatedAt = new Date(t.updated_at).getTime();
                const now = Date.now();
                const isOffline = (now - updatedAt) > 45000; // 45s timeout

                return {
                    team_id: t.team_id,
                    maps_completed: t.maps_completed || 0,
                    active_player: isOffline ? null : (t.active_player || null)
                };
            })
        });

    } catch (error) {
        console.error('[Sync] Error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// GET endpoint to retrieve current team statuses (for dashboard)
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        const { data: statuses, error } = await supabase
            .from('team_status')
            .select('*')
            .order('team_id', { ascending: true });

        if (error) {
            console.error('[Sync] GET error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(statuses || []);

    } catch (error) {
        console.error('[Sync] GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
