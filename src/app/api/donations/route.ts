import { NextResponse } from 'next/server';
import { syncDonations, getCampaignData, getTeamPots, getRecentDonations } from '@/lib/tiltify';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Throttle syncDonations using database timestamp (works across serverless instances)
const SYNC_THROTTLE_MS = 30000; // 30 seconds

// GET /api/donations
// Returns campaign data, team pots, and recent donations
export async function GET(request: Request) {
    try {
        // Rate limiting - use plugin tier for higher limits
        const rateLimited = applyRateLimit(request, RATE_LIMITS.plugin);
        if (rateLimited) return rateLimited;

        // Check if we should sync by getting last sync time from Supabase
        const now = Date.now();
        let shouldSync = true;
        
        const { data: lastSync } = await supabaseAdmin
            .from('campaign_data')
            .select('cached_at')
            .eq('id', 1)
            .single();
        
        if (lastSync?.cached_at) {
            const lastSyncTime = new Date(lastSync.cached_at).getTime();
            shouldSync = (now - lastSyncTime) >= SYNC_THROTTLE_MS;
        }
        
        if (shouldSync) {
            try {
                await syncDonations();
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
