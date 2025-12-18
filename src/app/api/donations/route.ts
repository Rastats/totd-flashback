import { NextResponse } from 'next/server';
import { syncDonations, getCampaignData, getTeamPots, getRecentDonations } from '@/lib/tiltify';

export const dynamic = 'force-dynamic';

// Throttle syncDonations to prevent excessive Tiltify API calls
let lastSyncTime = 0;
const SYNC_THROTTLE_MS = 30000; // 30 seconds

// GET /api/donations
// Returns campaign data, team pots, and recent donations
export async function GET() {
    try {
        // Only sync if enough time has passed since last sync
        const now = Date.now();
        if (now - lastSyncTime >= SYNC_THROTTLE_MS) {
            try {
                await syncDonations();
                lastSyncTime = now;
            } catch (syncError) {
                // Log sync error but don't fail the request - return cached data
                console.error('[Donations] Sync error (continuing with cached data):', syncError);
            }
        }

        // Get all the data (from Supabase cache, even if sync failed)
        const [campaignData, teamPots, recentDonations] = await Promise.all([
            getCampaignData(),
            getTeamPots(),
            getRecentDonations(20)
        ]);

        return NextResponse.json({
            totalAmount: campaignData.totalAmount,
            currency: campaignData.currency,
            goal: campaignData.goal,
            teamPots: teamPots,
            recentDonations: recentDonations
        });
    } catch (error) {
        console.error('Donation API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch donations' },
            { status: 500 }
        );
    }
}
