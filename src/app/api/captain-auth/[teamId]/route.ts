import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const { teamId } = await params;

    // Fetch captains for this team
    const { data: captains, error } = await supabase
        .from("captains")
        .select("discord_id")
        .eq("team_id", teamId);

    if (error) {
        console.error("Error fetching captains:", error);
        return NextResponse.json({ captainDiscordIds: [] });
    }

    const captainDiscordIds = captains?.map(c => c.discord_id) || [];

    return NextResponse.json({ captainDiscordIds });
}
