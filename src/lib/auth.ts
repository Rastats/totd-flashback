import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabase } from "./supabase";

export interface AuthSession {
    user: {
        discordId: string;
        username: string;
        isAdmin: boolean;
        email?: string;
        name?: string;
        image?: string;
    };
}

// Get the current session on the server
export async function getSession(): Promise<AuthSession | null> {
    const session = await getServerSession(authOptions);
    return session as AuthSession | null;
}

// Check if the user is an admin
export async function isAdmin(): Promise<boolean> {
    const session = await getSession();
    return session?.user?.isAdmin ?? false;
}

// Check if the user is a captain for a specific team
export async function isCaptainOfTeam(teamId: number): Promise<boolean> {
    const session = await getSession();
    if (!session?.user?.discordId) return false;

    // Admins can access any team
    if (session.user.isAdmin) return true;

    // Check if the user is a captain for this team
    const { data, error } = await supabase
        .from("captains")
        .select("id")
        .eq("discord_id", session.user.discordId)
        .eq("team_id", teamId)
        .single();

    return !error && !!data;
}

// Get the Discord ID of the current user
export async function getCurrentDiscordId(): Promise<string | null> {
    const session = await getSession();
    return session?.user?.discordId ?? null;
}
