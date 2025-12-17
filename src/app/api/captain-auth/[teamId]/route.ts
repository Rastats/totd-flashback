import { NextRequest, NextResponse } from "next/server";
import { isCaptainOfTeam } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const { teamId } = await params;
    const authorized = await isCaptainOfTeam(teamId);

    return NextResponse.json({ authorized });
}
