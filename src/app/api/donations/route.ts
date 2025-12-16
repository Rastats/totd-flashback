import { NextResponse } from 'next/server';
import { getCampaignDonations } from '@/lib/tiltify';

// This is the campaign ID for "TOTD Flashback" (Should be env var, but I will hardcode for now based on user info or add to env)
// Wait, I need to ask user for Campaign ID or find it.
// Assuming "TOTD Flashback" is the name, I'll use a placeholder or ask.
// But user gave me Client ID/Secret. They might not know Campaign ID.
// However, I can probably search for it if I don't have it.
// For now, I will use a dummy ID or env var.
const CAMPAIGN_ID = process.env.TILTIFY_CAMPAIGN_ID || "123456";

export async function GET() {
    try {
        const data = await getCampaignDonations(CAMPAIGN_ID);
        return NextResponse.json(data);
    } catch (error) {
        console.error("Donation fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch donations" }, { status: 500 });
    }
}
