import { NextResponse } from 'next/server';

const TILTIFY_API_URL = 'https://v5api.tiltify.com';
const CLIENT_ID = process.env.TILTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.TILTIFY_CLIENT_SECRET;

let accessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiresAt) {
        return accessToken;
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error("Missing Tiltify credentials");
        throw new Error("Missing Tiltify credentials");
    }

    const res = await fetch(`${TILTIFY_API_URL}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'client_credentials',
            scope: 'public' // Usually 'public' is enough for reading campaign data in V5
        }),
    });

    if (!res.ok) {
        throw new Error(`Failed to get Tiltify token: ${res.statusText}`);
    }

    const data = await res.json();
    accessToken = data.access_token;
    // Expire 1 minute before actual expiry to be safe
    tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;

    return accessToken;
}

// Use env var or passed ID
export async function getCampaignDonations(campaignId: string = process.env.TILTIFY_CAMPAIGN_ID!) {
    if (!campaignId) throw new Error("Missing Campaign ID");
    const token = await getAccessToken();

    // 1. Fetch Campaign Details (Total Raised)
    const campaignRes = await fetch(`${TILTIFY_API_URL}/api/public/campaigns/${campaignId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!campaignRes.ok) {
        console.error("Failed to fetch campaign", await campaignRes.text());
        throw new Error("Failed to fetch campaign");
    }
    const campaignData = await campaignRes.json();

    // 2. Fetch Recent Donations (List)
    const donationsRes = await fetch(`${TILTIFY_API_URL}/api/public/campaigns/${campaignId}/donations?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    let recentDonations = [];
    if (donationsRes.ok) {
        const donationsData = await donationsRes.json();
        recentDonations = donationsData.data.map((d: any) => {
            const comment = d.comment || "";
            let targetTeam = null;

            // Parse Team from Cents (Matching Plugin Logic)
            // Tenths = Pot Team, Units = Penalty Team
            const amt = parseFloat(d.amount.value);
            const cents = Math.round((amt - Math.floor(amt)) * 100);

            const digitPot = Math.floor(cents / 10);
            const digitPenalty = cents % 10;

            let potTeam = null;
            let isPotRandom = false;
            // Assume 4 teams
            if (digitPot >= 1 && digitPot <= 4) potTeam = digitPot;
            else isPotRandom = true;

            let penaltyTeam = null;
            let isPenaltyRandom = false;
            if (digitPenalty >= 1 && digitPenalty <= 4) penaltyTeam = digitPenalty;
            else isPenaltyRandom = true;

            return {
                id: d.id,
                donorName: d.donor_name || "Anonymous",
                amount: parseFloat(d.amount.value),
                currency: d.amount.currency,
                comment: comment,
                potTeam,
                penaltyTeam,
                isPotRandom,
                isPenaltyRandom,
                timestamp: d.completed_at
            };
        });
    }

    return {
        totalAmount: campaignData.data.amount_raised.value,
        currency: campaignData.data.amount_raised.currency,
        goal: campaignData.data.goal.value,
        recentDonations
    };
}
