import { NextResponse } from 'next/server';
import { syncDonations, getCampaignData, getTeamPots, getRecentDonations } from '@/lib/tiltify';

// GET /api/donations
// Returns campaign data, team pots, and recent donations
export async function GET() {
    try {
        // Sync new donations from Tiltify to Supabase
        await syncDonations();

        // Get all the data
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
