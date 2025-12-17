"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DonationModal from "./DonationModal";

export default function Header() {
    const [showDonationModal, setShowDonationModal] = useState(false);
    const [captainInfo, setCaptainInfo] = useState<{ isCaptain: boolean; teamId: string | null } | null>(null);

    useEffect(() => {
        fetch("/api/user/captain-status")
            .then(res => res.json())
            .then(data => setCaptainInfo(data))
            .catch(err => console.error("Failed to fetch captain status:", err));
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
                                fontSize: 14,
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                            }}>
                                👑 My Team
                            </Link>
                        )}

                        {/* Donate Button */}
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

                        {/* Donation Counter */}
                        <div style={{
                            padding: "6px 12px",
                            background: "#2a2a3a",
                            borderRadius: 6,
                            fontSize: 14,
                        }}>
                            💰 <strong>£0</strong> raised
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
