import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

// Admin Discord IDs (can access /admin page)
const ADMIN_IDS = ["217672821831237643"]; // Rastats

export const authOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }: { token: any; account: any; profile?: any }) {
            if (account && profile) {
                token.discordId = profile.id;
                token.username = profile.username;
                token.isAdmin = ADMIN_IDS.includes(profile.id);
            }
            return token;
        },
        async session({ session, token }: { session: any; token: any }) {
            session.user.discordId = token.discordId;
            session.user.username = token.username;
            session.user.isAdmin = token.isAdmin;
            return session;
        },
    },
    pages: {
        signIn: "/auth/signin",
    },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
