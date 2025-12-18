"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import DonationModal from "./DonationModal";

export default function Header() {
    const { data: session } = useSession() as { data: any, status: string };
    const [showDonationModal, setShowDonationModal] = useState(false);
    const [captainInfo, setCaptainInfo] = useState<{ isCaptain: boolean; teamId: string | null; isAdmin?: boolean } | null>(null);
    const [totalRaised, setTotalRaised] = useState<number | null>(null);

    useEffect(() => {
        fetch("/api/user/captain-status")
            .then(res => res.json())
            .then(data => setCaptainInfo(data))
            .catch(err => console.error("Failed to fetch captain status:", err));

        // Fetch donation total
        const fetchTotal = async () => {
            try {
                const res = await fetch('/api/donations');
                if (res.ok) {
                    const data = await res.json();
                    setTotalRaised(data.totalAmount || 0);
                }
            } catch (e) { /* ignore */ }
        };
        fetchTotal();
        const interval = setInterval(fetchTotal, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <header style={{
                position: "sticky",
                top: 0,
                zIndex: 100,
                background: "rgba(26, 26, 46, 0.95)",
                backdropFilter: "blur(8px)",
                borderBottom: "1px solid #2a2a3a",
                padding: "12px 24px",
            }}>
                <nav style={{
                    maxWidth: 900,
                    margin: "0 auto",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    <Link href="/" style={{
                        fontWeight: 600,
                        fontSize: 18,
                        color: "#fff",
                        textDecoration: "none",
                    }}>
                        🏎️ TOTD Flashback
                    </Link>

                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {/* Admin Dashboard Link */}
                        {(session?.user?.isAdmin || captainInfo?.isAdmin) && (
                            <Link href="/admin" style={{
                                padding: "8px 16px",
                                background: "rgba(96, 165, 250, 0.1)",
                                border: "1px solid #60a5fa",
                                borderRadius: 8,
                                color: "#60a5fa",
                                fontWeight: 600,
                                textDecoration: "none",
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                            }}>
                                🛡️ Admin
                            </Link>
                        )}

                        {/* Roster Link (Admin only) */}
                        {(session?.user?.isAdmin || captainInfo?.isAdmin) && (
                            <Link href="/rosters" style={{
                                padding: "8px 16px",
                                background: "rgba(16, 185, 129, 0.1)",
                                border: "1px solid #10b981",
                                borderRadius: 8,
                                color: "#10b981",
                                fontWeight: 600,
                                textDecoration: "none",
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                            }}>
                                📋 Rosters
                            </Link>
                        )}

                        {/* Captain Dashboard Link */}
                        {captainInfo?.isCaptain && captainInfo.teamId && (
                            <Link href={`/captain/${captainInfo.teamId}`} style={{
                                padding: "8px 16px",
                                background: "rgba(234, 179, 8, 0.1)",
                                border: "1px solid #eab308",
                                borderRadius: 8,
                                color: "#eab308",
                                fontWeight: 600,
                                textDecoration: "none",
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                            }}>
                                👑 My Team
                            </Link>
                        )}

                        {/* Login Button Area */}
                        {session ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {session.user?.image && (
                                    <img
                                        src={session.user.image}
                                        alt="User"
                                        style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #334155" }}
                                    />
                                )}
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "end" }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>
                                        {session.user?.name}
                                    </span>
                                    {/* Sign Out (text link for minimalism) */}
                                    <button
                                        onClick={() => signOut()}
                                        style={{ background: "none", border: "none", color: "#64748b", fontSize: 11, cursor: "pointer", padding: 0 }}
                                    >
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => signIn("discord")}
                                style={{
                                    padding: "8px 16px",
                                    background: "#5865F2", // Discord Blurple
                                    borderRadius: 8,
                                    color: "#fff",
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8
                                }}
                            >
                                <span>Login</span>
                            </button>
                        )}

                        {/* Donate Button + Total */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                            {totalRaised !== null && (
                                <div style={{
                                    padding: "6px 10px",
                                    background: "#2a2a3a",
                                    borderRadius: 6,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "#f59e0b",
                                }}>
                                    💰 £{totalRaised.toFixed(2)}
                                </div>
                            )}
                            <button
                                onClick={() => setShowDonationModal(true)}
                                style={{
                                    padding: "10px 20px",
                                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                                    borderRadius: 8,
                                    color: "#fff",
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 14,
                                    boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
                                }}
                            >
                                ❤️ Donate
                            </button>
                        </div>
                    </div>
                </nav>
            </header>

            <DonationModal
                isOpen={showDonationModal}
                onClose={() => setShowDonationModal(false)}
            />
        </>
    );
}
