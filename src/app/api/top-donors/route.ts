import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET /api/top-donors
// Returns top donors sorted by total amount (aggregated)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10', 10);

        const supabase = getSupabaseAdmin();

        // Get all donations from processed_donations
        const { data, error } = await supabase
            .from('processed_donations')
            .select('donor_name, amount, currency, processed_at')
            .order('processed_at', { ascending: false });

        if (error) {
            console.error('[TopDonors] Error:', error);
            return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
        }

        // Aggregate donations by donor name
        const donorTotals: Record<string, { amount: number; currency: string; lastDonation: string }> = {};

        for (const donation of data || []) {
            const name = donation.donor_name || 'Anonymous';
            if (!donorTotals[name]) {
                donorTotals[name] = { amount: 0, currency: donation.currency, lastDonation: donation.processed_at };
            }
            donorTotals[name].amount += donation.amount;
        }

        // Convert to array and sort by amount descending
        const topDonors = Object.entries(donorTotals)
            .map(([donor_name, data]) => ({
                donor_name,
                amount: Math.round(data.amount * 100) / 100, // Round to 2 decimals
                currency: data.currency,
                completed_at: data.lastDonation
            }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, Math.min(limit, 50));

        return NextResponse.json(topDonors);
    } catch (error) {
        console.error('[TopDonors] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

