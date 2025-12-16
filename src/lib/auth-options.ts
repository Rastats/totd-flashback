import DiscordProvider from "next-auth/providers/discord";
import type { NextAuthOptions } from "next-auth";

// Admin Discord IDs (can access /admin page)
const ADMIN_IDS = ["217672821831237643"]; // Rastats

export const authOptions: NextAuthOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            if (account && profile) {
                token.discordId = (profile as any).id;
                token.username = (profile as any).username;
                token.isAdmin = ADMIN_IDS.includes((profile as any).id);
            }
            return token;
        },
        async session({ session, token }) {
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
