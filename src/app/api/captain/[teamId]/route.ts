import { NextResponse } from 'next/server';
import { getPlayers, getTeamPlanning, updateTeamPlanning } from '@/lib/store';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const { teamId } = await params;

    // 1. Get Players (filtered for this team + jokers)
    const allPlayers = await getPlayers();
    const teamPlayers = allPlayers.filter(p =>
        p.status === 'approved' &&
        (p.teamAssignment === teamId || p.teamAssignment === 'joker')
    ).map(p => ({
        id: p.id,
        name: p.trackmaniaName || p.discordUsername,
        teamAssignment: p.teamAssignment,
        availability: p.availability
    }));

    // 2. Get Planning
    const planning = await getTeamPlanning(teamId);

    return NextResponse.json({
        teamId,
        players: teamPlayers,
        planning
    });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const { teamId } = await params;
    const body = await request.json();

    // Body should be Record<number, TeamSlotAssignment>
    const planning = await updateTeamPlanning(teamId, body.slots);

    return NextResponse.json(planning);
}
