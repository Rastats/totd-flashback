"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

interface RequireAuthProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
    allowedDiscordIds?: string[];
}

// Extended user type from our NextAuth callbacks
interface ExtendedUser {
    discordId?: string;
    username?: string;
    isAdmin?: boolean;
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

export default function RequireAuth({ children, requireAdmin = false, allowedDiscordIds }: RequireAuthProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const user = session?.user as ExtendedUser | undefined;

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
        }
    }, [status, router]);

    if (status === "loading") {
        return (
            <main style={{ maxWidth: 700, margin: "0 auto", padding: "100px 16px", fontFamily: "system-ui", textAlign: "center" }}>
                <p style={{ opacity: 0.7 }}>Loading...</p>
            </main>
        );
    }

    if (status === "unauthenticated") {
        return (
            <main style={{ maxWidth: 700, margin: "0 auto", padding: "100px 16px", fontFamily: "system-ui", textAlign: "center" }}>
                <p style={{ opacity: 0.7 }}>Redirecting to login...</p>
            </main>
        );
    }

    // Check admin permission
    if (requireAdmin && !user?.isAdmin) {
        return (
            <main style={{ maxWidth: 700, margin: "0 auto", padding: "100px 16px", fontFamily: "system-ui", textAlign: "center" }}>
                <h1 style={{ fontSize: 28, marginBottom: 16, color: "#f87171" }}>🚫 Access Denied</h1>
                <p style={{ opacity: 0.8, marginBottom: 24 }}>
                    You don&apos;t have permission to access this page.
                </p>
                <p style={{ opacity: 0.6, marginBottom: 24 }}>
                    Logged in as: {user?.username || user?.name}
                </p>
                <Link href="/" style={{ color: "#60a5fa" }}>← Back to Home</Link>
            </main>
        );
    }

    // Check specific Discord ID permission
    if (allowedDiscordIds && allowedDiscordIds.length > 0) {
        if (!user?.isAdmin && (!user?.discordId || !allowedDiscordIds.includes(user.discordId))) {
            return (
                <main style={{ maxWidth: 700, margin: "0 auto", padding: "100px 16px", fontFamily: "system-ui", textAlign: "center" }}>
                    <h1 style={{ fontSize: 28, marginBottom: 16, color: "#f87171" }}>🚫 Access Denied</h1>
                    <p style={{ opacity: 0.8, marginBottom: 24 }}>
                        You don&apos;t have permission to access this page.
                    </p>
                    <p style={{ opacity: 0.6, marginBottom: 24 }}>
                        Logged in as: {user?.username || user?.name}
                    </p>
                    <Link href="/" style={{ color: "#60a5fa" }}>← Back to Home</Link>
                </main>
            );
        }
    }

    return <>{children}</>;
}
