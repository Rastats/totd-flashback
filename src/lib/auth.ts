import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
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
export async function isCaptainOfTeam(teamId: string): Promise<boolean> {
    const session = await getSession();
    if (!session?.user?.username) return false;

    // Admins can access any team
    if (session.user.isAdmin) return true;

    // Check if the user is a captain for this team in the players table
    // We match by discord_username since we don't have discord_id in players table
    const { data, error } = await supabase
        .from("players")
        .select("id")
        .ilike("discord_username", session.user.username)
        .eq("team_assignment", teamId)
        .eq("is_captain", true)
        .single();

    return !error && !!data;
}

// Get the Discord ID of the current user
export async function getCurrentDiscordId(): Promise<string | null> {
    const session = await getSession();
    return session?.user?.discordId ?? null;
}
