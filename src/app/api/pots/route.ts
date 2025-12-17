import { NextResponse } from 'next/server';
import { getTeamPots } from '@/lib/tiltify';

// GET /api/pots
// Returns team pots only (lightweight endpoint for frequent polling)
export async function GET() {
    try {
        const teamPots = await getTeamPots();

        return NextResponse.json({
            teamPots: teamPots,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Pots API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch team pots' },
            { status: 500 }
        );
    }
}
