import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
    const session = await getSession();
    if (!session?.user?.username) {
        return NextResponse.json({ isCaptain: false, teamId: null });
    }

    // Admins are technically captains of everything, but for UI we might want to show "Admin Dashboard" instead
    if (session.user.isAdmin) {
        return NextResponse.json({ isCaptain: true, isAdmin: true, teamId: null });
    }

    const { data } = await supabase
        .from("players")
        .select("team_assignment")
        .eq("discord_username", session.user.username)
        .eq("is_captain", true)
        .single();

    if (data && data.team_assignment) {
        return NextResponse.json({ isCaptain: true, teamId: data.team_assignment });
    }

    return NextResponse.json({ isCaptain: false, teamId: null });
}
