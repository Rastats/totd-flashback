import { supabaseAdmin } from './supabase-admin';
import { PENALTY_CONFIG, getInitialMapsRemaining, calculateTimerExpiry } from './penalty-config';

const TILTIFY_API_URL = 'https://v5api.tiltify.com';
const CLIENT_ID = process.env.TILTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.TILTIFY_CLIENT_SECRET;
const CAMPAIGN_ID = process.env.TILTIFY_CAMPAIGN_ID;
const TEAM_COUNT = 4; // Number of teams

let accessToken: string | null = null;
let tokenExpiresAt = 0;

// Penalty thresholds (amount in any currency)
const PENALTY_THRESHOLDS = [
    { min: 500, id: 10, name: 'Back to the Future' },
    { min: 200, id: 9, name: 'AT or Bust' },
    { min: 100, id: 8, name: "Can't Turn Right" },
    { min: 75, id: 7, name: 'Player Switch' },
    { min: 50, id: 6, name: 'Tunnel Vision' },
    { min: 35, id: 5, name: 'Pedal to the Metal' },
    { min: 25, id: 4, name: 'Clean Run Only' },
    { min: 15, id: 3, name: 'Cursed Controller' },
    { min: 10, id: 2, name: 'Camera Shuffle' },
    { min: 5, id: 1, name: 'Russian Roulette' },
];

async function getAccessToken(): Promise<string> {
    if (accessToken && Date.now() < tokenExpiresAt) {
        return accessToken;
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('Missing Tiltify credentials');
    }

    const res = await fetch(`${TILTIFY_API_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'client_credentials',
            scope: 'public'
        }),
    });

    if (!res.ok) {
        throw new Error(`Failed to get Tiltify token: ${res.statusText}`);
    }

    const data = await res.json();
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;

    return accessToken!;
}

// Get penalty for a donation amount
function getPenaltyForAmount(amount: number): { id: number; name: string } | null {
    for (const threshold of PENALTY_THRESHOLDS) {
        if (amount >= threshold.min) {
            return { id: threshold.id, name: threshold.name };
        }
    }
    return null;
}

// Parse cents to determine pot team and penalty team
function parseCents(amount: number): {
    potTeam: number | null;
    penaltyTeam: number;
    isPotRandom: boolean;
    isPenaltyRandom: boolean;
} {
    const cents = Math.round((amount - Math.floor(amount)) * 100) % 100;
    const digitPot = Math.floor(cents / 10);     // Tens digit = pot team
    const digitPenalty = cents % 10;              // Units digit = penalty team

    let potTeam: number | null = null;
    let isPotRandom = false;

    // Valid team numbers are 1 to TEAM_COUNT
    if (digitPot >= 1 && digitPot <= TEAM_COUNT) {
        potTeam = digitPot;
    } else {
        // 0 or > TEAM_COUNT = split equally (no specific team)
        potTeam = null;
        isPotRandom = true;
    }

    let penaltyTeam: number;
    let isPenaltyRandom = false;

    if (digitPenalty >= 1 && digitPenalty <= TEAM_COUNT) {
        penaltyTeam = digitPenalty;
    } else {
        // 0 or > TEAM_COUNT = random team
        penaltyTeam = Math.floor(Math.random() * TEAM_COUNT) + 1;
        isPenaltyRandom = true;
    }

    return { potTeam, penaltyTeam, isPotRandom, isPenaltyRandom };
}

// Immediate-effect penalties (must activate immediately, can override others)
const IMMEDIATE_PENALTY_IDS = [7, 9, 10]; // Player Switch, AT or Bust, Back to the Future

// Add a penalty to team_server_state with proper slot management
// - Shield blocking
// - 2 active slots max
// - Immediate penalties override lowest ID active penalty if full
// - Non-immediate go to waitlist if full
async function addPenaltyToTeam(teamId: number, penaltyId: number, penaltyName: string, donationId: string): Promise<void> {
    // Get current team state
    const { data: teamData, error: fetchError } = await supabaseAdmin
        .from('team_server_state')
        .select('penalties_active, penalties_waitlist, shield_active, shield_type, shield_expires_at')
        .eq('team_id', teamId)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error(`[Tiltify] Failed to fetch team ${teamId} state:`, fetchError);
        return;
    }

    // Check if shield is active (blocks ALL penalties)
    if (teamData?.shield_active) {
        // Also check if shield hasn't expired
        if (teamData.shield_expires_at && new Date(teamData.shield_expires_at) > new Date()) {
            console.log(`[Tiltify] Shield active for Team ${teamId}, blocking penalty: ${penaltyName}`);
            return;
        }
    }

    const currentActive: any[] = teamData?.penalties_active || [];
    const currentWaitlist: any[] = teamData?.penalties_waitlist || [];

    // Create penalty object
    const config = PENALTY_CONFIG[penaltyId];
    const newPenalty = {
        id: penaltyId,
        name: penaltyName,
        donation_id: donationId,
        maps_remaining: config?.maps ?? null,
        maps_total: config?.maps ?? null,
        timer_expires_at: config?.timerMinutes
            ? new Date(Date.now() + config.timerMinutes * 60 * 1000).toISOString()
            : null,
        timer_minutes: config?.timerMinutes ?? null,
        added_at: new Date().toISOString(),
        activated_at: null as string | null
    };

    const isImmediate = IMMEDIATE_PENALTY_IDS.includes(penaltyId);
    let updatedActive = [...currentActive];
    let updatedWaitlist = [...currentWaitlist];
    let removedPenalty: any = null;

    if (isImmediate) {
        // IMMEDIATE PENALTIES (7, 9, 10): Go directly to ACTIVE
        if (currentActive.length < 2) {
            // Slot available - activate
            newPenalty.activated_at = new Date().toISOString();
            if (config?.timerMinutes) {
                newPenalty.timer_expires_at = new Date(Date.now() + config.timerMinutes * 60 * 1000).toISOString();
            }
            updatedActive.push(newPenalty);
            console.log(`[Tiltify] Team ${teamId}: Activated ${penaltyName} (immediate)`);
        } else {
            // 2 active already - override lowest ID
            let lowestIdx = 0;
            let lowestId = currentActive[0]?.penalty_id ?? currentActive[0]?.id ?? 999;
            for (let i = 1; i < currentActive.length; i++) {
                const thisId = currentActive[i]?.penalty_id ?? currentActive[i]?.id ?? 999;
                if (thisId < lowestId) {
                    lowestId = thisId;
                    lowestIdx = i;
                }
            }

            // Remove lowest ID penalty
            removedPenalty = updatedActive[lowestIdx];
            updatedActive.splice(lowestIdx, 1);

            // Add new immediate penalty as active
            newPenalty.activated_at = new Date().toISOString();
            if (config?.timerMinutes) {
                newPenalty.timer_expires_at = new Date(Date.now() + config.timerMinutes * 60 * 1000).toISOString();
            }
            updatedActive.push(newPenalty);

            console.log(`[Tiltify] Team ${teamId}: ${penaltyName} OVERRIDES ${removedPenalty?.name} (lowest ID ${lowestId})`);
        }
    } else {
        // NON-IMMEDIATE PENALTIES (1,2,3,4,5,6,8): ALWAYS go to WAITLIST
        // Dropped only if waitlist has 2 penalties with HIGHER IDs
        if (currentWaitlist.length < 2) {
            // Waitlist has room
            updatedWaitlist.push(newPenalty);
            console.log(`[Tiltify] Team ${teamId}: ${penaltyName} added to waitlist`);
        } else {
            // Waitlist full (2 penalties) - check if we should replace lowest ID
            // Only drop if BOTH waitlist penalties have higher IDs than incoming
            const waitlistIds = currentWaitlist.map((p: any) => p.penalty_id ?? p.id ?? 0);
            const incomingId = penaltyId;

            // Count how many waitlist penalties have LOWER or EQUAL ID than incoming
            const lowerOrEqualCount = waitlistIds.filter((id: number) => id <= incomingId).length;

            if (lowerOrEqualCount > 0) {
                // At least one waitlist penalty has lower/equal ID - replace the LOWEST
                let lowestIdx = 0;
                let lowestId = waitlistIds[0];
                for (let i = 1; i < waitlistIds.length; i++) {
                    if (waitlistIds[i] < lowestId) {
                        lowestId = waitlistIds[i];
                        lowestIdx = i;
                    }
                }

                // Only replace if incoming has higher ID
                if (incomingId > lowestId) {
                    const removed = updatedWaitlist.splice(lowestIdx, 1)[0];
                    updatedWaitlist.push(newPenalty);
                    console.log(`[Tiltify] Team ${teamId}: ${penaltyName} (ID ${incomingId}) replaces ${removed?.name} (ID ${lowestId}) in waitlist`);
                } else {
                    // Incoming has lower or equal ID - add anyway by removing lowest
                    updatedWaitlist.splice(lowestIdx, 1);
                    updatedWaitlist.push(newPenalty);
                    console.log(`[Tiltify] Team ${teamId}: ${penaltyName} added to waitlist, removed lowest ID`);
                }
            } else {
                // Both waitlist penalties have higher IDs than incoming - DROP incoming
                console.log(`[Tiltify] Team ${teamId}: Waitlist full with higher IDs, ${penaltyName} (ID ${incomingId}) DROPPED`);
                return;
            }
        }
    }

    // Update team_server_state
    const { error: updateError } = await supabaseAdmin
        .from('team_server_state')
        .upsert({
            team_id: teamId,
            penalties_active: updatedActive,
            penalties_waitlist: updatedWaitlist,
            updated_at: new Date().toISOString()
        }, { onConflict: 'team_id' });

    if (updateError) {
        console.error(`[Tiltify] Failed to update team ${teamId} penalties:`, updateError);
        return;
    }

    // Log event
    let message = `Penalty applied: ${penaltyName}`;
    if (removedPenalty) {
        message = `${penaltyName} replaced ${removedPenalty.name} (immediate override)`;
    }

    await supabaseAdmin.from('event_log').insert({
        event_type: 'penalty_applied',
        team_id: teamId,
        message: message,
        metadata: { penalty_id: penaltyId, penalty_name: penaltyName, donation_id: donationId, removed: removedPenalty?.name }
    });
}

// Process a new donation and store it in Supabase
async function processDonation(donation: {
    id: string;
    donor_name: string;
    amount: { value: string; currency: string };
    completed_at: string;
}): Promise<void> {
    const amount = parseFloat(donation.amount.value);
    const { potTeam, penaltyTeam, isPotRandom, isPenaltyRandom } = parseCents(amount);
    const penalty = getPenaltyForAmount(amount);

    // Check if donation is too old (> 3 minutes) - skip pot increment for old donations
    const donationTime = new Date(donation.completed_at).getTime();
    const now = Date.now();
    const ageMs = now - donationTime;
    const isOldDonation = ageMs > 3 * 60 * 1000; // 3 minutes (was 1 minute)

    // Check if donation exists AND if pot was already incremented
    // This is more robust than just checking existence
    const { data: existingDonation } = await supabaseAdmin
        .from('processed_donations')
        .select('donation_id, pot_incremented')
        .eq('donation_id', donation.id)
        .single();

    const isNewDonation = !existingDonation;
    const potAlreadyIncremented = existingDonation?.pot_incremented === true;
    // Determine if we should increment pot (new AND recent AND not already done)
    const shouldIncrementPot = !isOldDonation && !potAlreadyIncremented;

    // Insert into processed_donations (always record, even if old)
    const donationRecord = {
        donation_id: donation.id,
        amount: amount,
        currency: donation.amount.currency,
        donor_name: donation.donor_name || 'Anonymous',
        pot_team: potTeam,
        penalty_team: penaltyTeam,
        penalty_id: penalty?.id ?? 0,
        penalty_name: penalty?.name ?? 'Support Only',
        is_pot_random: isPotRandom,
        is_penalty_random: isPenaltyRandom,
        processed_at: donation.completed_at,
        pot_incremented: shouldIncrementPot // Set to true only if we're about to increment
    };

    const { error: insertError } = await supabaseAdmin
        .from('processed_donations')
        .upsert(donationRecord, { onConflict: 'donation_id' });

    if (insertError) {
        console.error('Error inserting donation:', insertError);
        return;
    }

    // Skip pot increment if already done or donation too old
    if (!shouldIncrementPot) {
        if (isOldDonation) {
            console.log(`[Tiltify] Skipping pot for old donation ${donation.id} (${Math.round(ageMs / 1000)}s old)`);
        } else if (potAlreadyIncremented) {
            console.log(`[Tiltify] Pot already incremented for ${donation.id}`);
        }
        return;
    }

    // RACE CONDITION FIX: Use atomic check-and-increment
    // Re-check pot_incremented in a single query with update
    const { data: lockCheck, error: lockError } = await supabaseAdmin
        .from('processed_donations')
        .update({ pot_incremented: true })
        .eq('donation_id', donation.id)
        .eq('pot_incremented', false)  // Only update if still false
        .select('donation_id')
        .single();

    if (lockError || !lockCheck) {
        // Another process already incremented pot
        console.log(`[Tiltify] Pot increment skipped (concurrent update) for ${donation.id}`);
        return;
    }

    // Update team pots
    if (potTeam !== null) {
        // Specific team gets the full amount
        await supabaseAdmin.rpc('increment_team_pot', {
            target_team_id: potTeam,
            increment_amount: amount
        });
    } else {
        // Split equally among all teams
        const splitAmount = amount / TEAM_COUNT;
        for (let teamId = 1; teamId <= TEAM_COUNT; teamId++) {
            await supabaseAdmin.rpc('increment_team_pot', {
                target_team_id: teamId,
                increment_amount: splitAmount
            });
        }
    }

    // ==============================================
    // ADD PENALTY TO TEAM STATE
    // Server-side slot management: 2 active max, waitlist, immediate override
    // ==============================================
    if (penalty) {
        await addPenaltyToTeam(penaltyTeam, penalty.id, penalty.name, donation.id);
    }

    console.log(`[Tiltify] Processed donation ${donation.id}: £${amount} | Pot: Team ${potTeam ?? 'ALL'} | Penalty: Team ${penaltyTeam} (${penalty?.name ?? 'none'})`);
}

// Fetch and process new donations from Tiltify
export async function syncDonations(): Promise<void> {
    if (!CAMPAIGN_ID) {
        throw new Error('Missing Campaign ID');
    }

    const token = await getAccessToken();

    // Fetch recent donations from Tiltify
    const donationsRes = await fetch(
        `${TILTIFY_API_URL}/api/public/campaigns/${CAMPAIGN_ID}/donations?limit=50`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!donationsRes.ok) {
        throw new Error(`Failed to fetch donations: ${donationsRes.statusText}`);
    }

    const donationsData = await donationsRes.json();
    const donations = donationsData.data || [];

    // Get already processed donation IDs
    const { data: processedIds } = await supabaseAdmin
        .from('processed_donations')
        .select('donation_id');

    const processedSet = new Set((processedIds || []).map((d: { donation_id: string }) => d.donation_id));

    // Process new donations (oldest first for correct order)
    const newDonations = donations.filter((d: { id: string }) => !processedSet.has(d.id));
    newDonations.reverse(); // Process oldest first

    for (const donation of newDonations) {
        await processDonation(donation);
    }
}

// Get campaign data including total raised
export async function getCampaignData(): Promise<{
    totalAmount: number;
    currency: string;
    goal: number;
}> {
    if (!CAMPAIGN_ID) {
        throw new Error('Missing Campaign ID');
    }

    const token = await getAccessToken();

    const campaignRes = await fetch(
        `${TILTIFY_API_URL}/api/public/campaigns/${CAMPAIGN_ID}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!campaignRes.ok) {
        throw new Error(`Failed to fetch campaign: ${campaignRes.statusText}`);
    }

    const campaignData = await campaignRes.json();

    return {
        totalAmount: parseFloat(campaignData.data.amount_raised.value),
        currency: campaignData.data.amount_raised.currency,
        goal: parseFloat(campaignData.data.goal.value)
    };
}

// Get team pots from team_server_state table
export async function getTeamPots(): Promise<Array<{
    team_id: number;
    pot_amount: number;
    currency: string;
    updated_at: string;
}>> {
    const { data, error } = await supabaseAdmin
        .from('team_server_state')
        .select('team_id, pot_amount, updated_at')
        .order('team_id');

    if (error) {
        console.error('Error fetching team pots:', error);
        return [];
    }

    // Transform to expected format (currency is always GBP)
    return (data || []).map(row => ({
        team_id: row.team_id,
        pot_amount: row.pot_amount || 0,
        currency: 'GBP',
        updated_at: row.updated_at
    }));
}

// Get recent processed donations from Supabase
export async function getRecentDonations(limit: number = 20): Promise<Array<{
    donation_id: string;
    amount: number;
    currency: string;
    donor_name: string;
    pot_team: number | null;
    penalty_team: number;
    penalty_id: number;
    penalty_name: string;
    is_pot_random: boolean;
    is_penalty_random: boolean;
    processed_at: string;
}>> {
    const { data, error } = await supabaseAdmin
        .from('processed_donations')
        .select('*')
        .order('processed_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching donations:', error);
        return [];
    }

    return data || [];
}
