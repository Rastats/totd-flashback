import { supabaseAdmin } from './supabase-admin';
import { PENALTY_CONFIG, getInitialMapsRemaining, calculateTimerExpiry } from './penalty-config';
import { addPenaltyToTeamState } from './penalty-utils';


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

// NOTE: Penalty addition now uses shared utility: addPenaltyToTeamState() from './penalty-utils'

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

    // Track if we should skip pot increment
    let shouldSkipPot = false;

    // Skip pot increment if already done or donation too old
    if (!shouldIncrementPot) {
        if (isOldDonation) {
            console.log(`[Tiltify] Skipping pot for old donation ${donation.id} (${Math.round(ageMs / 1000)}s old)`);
        } else if (potAlreadyIncremented) {
            console.log(`[Tiltify] Pot already incremented for ${donation.id}`);
        }
        shouldSkipPot = true;
    }

    // Only try to increment pot if not skipping
    if (!shouldSkipPot) {
        // RACE CONDITION FIX: Use atomic check-and-increment
        const { data: lockCheck, error: lockError } = await supabaseAdmin
            .from('processed_donations')
            .update({ pot_incremented: true })
            .eq('donation_id', donation.id)
            .eq('pot_incremented', false)
            .select('donation_id')
            .single();

        if (lockError || !lockCheck) {
            console.log(`[Tiltify] Pot increment skipped (concurrent update) for ${donation.id}`);
            shouldSkipPot = true;
        } else {
            // Update team pots with error handling
            try {
                if (potTeam !== null) {
                    const { error: rpcError } = await supabaseAdmin.rpc('increment_team_pot', {
                        target_team_id: potTeam,
                        increment_amount: amount
                    });
                    if (rpcError) {
                        console.error(`[Tiltify] RPC Error for team ${potTeam}:`, rpcError);
                    } else {
                        console.log(`[Tiltify] Pot incremented: Team ${potTeam} +£${amount}`);
                    }
                } else {
                    // Split equally among all teams
                    const splitAmount = amount / TEAM_COUNT;
                    for (let teamId = 1; teamId <= TEAM_COUNT; teamId++) {
                        const { error: rpcError } = await supabaseAdmin.rpc('increment_team_pot', {
                            target_team_id: teamId,
                            increment_amount: splitAmount
                        });
                        if (rpcError) {
                            console.error(`[Tiltify] RPC Error for team ${teamId}:`, rpcError);
                        }
                    }
                    console.log(`[Tiltify] Pot split: All teams +£${splitAmount.toFixed(2)} each`);
                }
            } catch (err) {
                console.error('[Tiltify] Exception during pot increment:', err);
            }
        }
    }

    // ==============================================
    // ADD PENALTY TO TEAM STATE (using shared utility)
    // ALWAYS apply penalty for NEW donations, even if pot was skipped
    // ==============================================
    if (penalty && isNewDonation) {
        await addPenaltyToTeamState(penaltyTeam, penalty.id, penalty.name, donation.id);
        console.log(`[Tiltify] Penalty applied: ${penalty.name} to Team ${penaltyTeam}`);
    }

    console.log(`[Tiltify] Processed donation ${donation.id}: £${amount} | Pot: Team ${potTeam ?? 'ALL'}${shouldSkipPot ? ' (skipped)' : ''} | Penalty: Team ${penaltyTeam} (${penalty?.name ?? 'none'})`);
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
