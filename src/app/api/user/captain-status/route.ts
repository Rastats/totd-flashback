import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
    const session = await getSession();
    if (!session?.user?.username) {
        return NextResponse.json({ isCaptain: false, teamId: null });
    }

    let teamId = null;
    let isCaptain = false;

    // Check if user is a captain in the players table
    const { data } = await supabase
        .from("players")
        .select("team_assignment, is_captain")
        .eq("discord_username", session.user.username)
        .single();

    if (data && data.is_captain && data.team_assignment) {
        isCaptain = true;
        teamId = data.team_assignment;
    }

    return NextResponse.json({
        isCaptain,
        teamId,
        isAdmin: session.user.isAdmin
    });
}
