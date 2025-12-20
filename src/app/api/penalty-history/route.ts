import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// All 10 penalty types with their IDs and names
const PENALTY_TYPES = [
    { id: 1, name: 'Russian Roulette' },
    { id: 2, name: 'Camera Shuffle' },
    { id: 3, name: 'Cursed Controller' },
    { id: 4, name: 'Clean Run Only' },
    { id: 5, name: 'Pedal to the Metal' },
    { id: 6, name: 'Tunnel Vision' },
    { id: 7, name: 'Player Switch' },
    { id: 8, name: "Can't Turn Right" },
    { id: 9, name: 'AT or Bust' },
    { id: 10, name: 'Back to the Future' },
];

interface PenaltyStats {
    penaltyId: number;
    penaltyName: string;
    team1: number;
    team2: number;
    team3: number;
    team4: number;
    total: number;
}

// GET /api/penalty-history
// Returns completed penalty counts by type and team
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // Query all completed penalties grouped by penalty_id and penalty_team
        const { data, error } = await supabase
            .from('processed_donations')
            .select('penalty_id, penalty_team')
            .eq('penalty_completed', true);

        if (error) {
            console.error('[PenaltyHistory] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Count by penalty type and team
        const counts: Record<number, Record<number, number>> = {};
        
        // Initialize all penalty types with 0 counts
        PENALTY_TYPES.forEach(p => {
            counts[p.id] = { 1: 0, 2: 0, 3: 0, 4: 0 };
        });

        // Count completed penalties
        (data || []).forEach((row: any) => {
            const penaltyId = row.penalty_id;
            const teamId = row.penalty_team;
            if (counts[penaltyId] && teamId >= 1 && teamId <= 4) {
                counts[penaltyId][teamId]++;
            }
        });

        // Format for response
        const stats: PenaltyStats[] = PENALTY_TYPES.map(p => ({
            penaltyId: p.id,
            penaltyName: p.name,
            team1: counts[p.id][1] || 0,
            team2: counts[p.id][2] || 0,
            team3: counts[p.id][3] || 0,
            team4: counts[p.id][4] || 0,
            total: (counts[p.id][1] || 0) + (counts[p.id][2] || 0) + 
                   (counts[p.id][3] || 0) + (counts[p.id][4] || 0)
        }));

        // Calculate team totals
        const teamTotals = {
            team1: stats.reduce((sum, s) => sum + s.team1, 0),
            team2: stats.reduce((sum, s) => sum + s.team2, 0),
            team3: stats.reduce((sum, s) => sum + s.team3, 0),
            team4: stats.reduce((sum, s) => sum + s.team4, 0),
            total: stats.reduce((sum, s) => sum + s.total, 0)
        };

        return NextResponse.json({
            penalties: stats,
            totals: teamTotals,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[PenaltyHistory] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
