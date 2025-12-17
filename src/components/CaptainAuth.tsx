"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface CaptainAuthProps {
    children: React.ReactNode;
    teamId: string;
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

export default function CaptainAuth({ children, teamId }: CaptainAuthProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const user = session?.user as ExtendedUser | undefined;
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
            return;
        }

        if (status === "authenticated") {
            // Admin has access to all teams
            if (user?.isAdmin) {
                setAuthorized(true);
                setCheckingAuth(false);
                return;
            }

            // Check if user is captain of this team via server-side check
            fetch(`/api/captain-auth/${teamId}`)
                .then(res => res.json())
                .then(data => {
                    setAuthorized(data.authorized);
                    setCheckingAuth(false);
                })
                .catch(() => {
                    setAuthorized(false);
                    setCheckingAuth(false);
                });
        }
    }, [status, user, router, teamId]);

    if (status === "loading" || checkingAuth) {
        return (
            <main style={{ maxWidth: 700, margin: "0 auto", padding: "100px 16px", fontFamily: "system-ui", textAlign: "center" }}>
                <p style={{ opacity: 0.7 }}>Checking authorization...</p>
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

    if (!authorized) {
        return (
            <main style={{ maxWidth: 700, margin: "0 auto", padding: "100px 16px", fontFamily: "system-ui", textAlign: "center" }}>
                <h1 style={{ fontSize: 28, marginBottom: 16, color: "#f87171" }}>🚫 Access Denied</h1>
                <p style={{ opacity: 0.8, marginBottom: 24 }}>
                    You are not a captain for this team.
                </p>
                <p style={{ opacity: 0.6, marginBottom: 24 }}>
                    Logged in as: {user?.username || user?.name}
                </p>
                <Link href="/" style={{ color: "#60a5fa" }}>← Back to Home</Link>
            </main>
        );
    }

    return <>{children}</>;
}
