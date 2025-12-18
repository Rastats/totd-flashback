import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET /api/top-donors
// Returns top donors sorted by amount
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10', 10);

        const supabase = getSupabaseAdmin();

        // Get top donations ordered by amount
        const { data, error } = await supabase
            .from('donations')
            .select('id, donor_name, amount, completed_at')
            .order('amount', { ascending: false })
            .limit(Math.min(limit, 50)); // Cap at 50 for safety

        if (error) {
            console.error('[TopDonors] Error:', error);
            return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('[TopDonors] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
