"use client";

import { useState } from "react";
import Link from "next/link";
import DonationModal from "./DonationModal";

export default function Header() {
    const [showDonationModal, setShowDonationModal] = useState(false);

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
