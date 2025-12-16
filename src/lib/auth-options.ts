import { supabase } from "@/lib/supabase";
import DiscordProvider from "next-auth/providers/discord";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session, Account, Profile } from "next-auth";

// Admin Discord IDs (always allow Rastats)
const ADMIN_IDS = ["217672821831237643"];

export const authOptions: NextAuthOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }: { token: JWT, account: Account | null, profile?: Profile }) {
            if (account && profile) {
                const discordId = (profile as any).id;
                token.discordId = discordId;
                token.username = (profile as any).username;

                // Check if admin (hardcoded or in DB)
                let isAdmin = ADMIN_IDS.includes(discordId);

                if (!isAdmin) {
                    try {
                        const { data } = await supabase
                            .from('admins')
                            .select('discord_id')
                            .eq('discord_id', discordId)
                            .single();
                        if (data) isAdmin = true;
                    } catch (e) {
                        console.error("Error checking admin status:", e);
                    }
                }

                token.isAdmin = isAdmin;
            }
            return token;
        },
        async session({ session, token }: { session: Session, token: JWT }) {
            if (session.user) {
                (session.user as any).discordId = token.discordId;
                (session.user as any).username = token.username;
                (session.user as any).isAdmin = token.isAdmin;
            }
            return session;
        },
    },
    pages: {
        signIn: "/auth/signin",
    },
};
