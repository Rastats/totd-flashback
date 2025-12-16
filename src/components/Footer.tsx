"use client";

import { useState } from "react";
import Link from "next/link";
import DonationModal from "./DonationModal";

export default function Footer() {
    const [showDonationModal, setShowDonationModal] = useState(false);

    return (
        <>
            <footer style={{
                marginTop: 48,
                padding: "32px 24px",
                background: "#0a0a12",
                borderTop: "1px solid #2a2a3a",
            }}>
                <div style={{
                    maxWidth: 900,
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                }}>
                    {/* Top row: Donate + Social Links */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
                            <div style={{
                                padding: "6px 12px",
                                background: "#2a2a3a",
                                borderRadius: 6,
                                fontSize: 14,
                            }}>
                                💰 <strong>£0</strong> raised
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <a
                                href="https://discord.gg/YMHdQXB3eC"
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#7289da", fontSize: 14, fontWeight: 500, textDecoration: "none" }}
                            >
                                📱 Discord
                            </a>
                            <a
                                href="https://twitch.tv/rastats"
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#a855f7", fontSize: 14, fontWeight: 500, textDecoration: "none" }}
                            >
                                📺 Twitch
                            </a>
                            <a
                                href="https://www.savethechildren.org.uk/christmas-jumper-day"
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#f87171", fontSize: 14, fontWeight: 500, textDecoration: "none" }}
                            >
                                🎄 Save the Children UK
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
                        <Link href="/penalties" style={{ color: "#f87171", fontSize: 13, textDecoration: "none", opacity: 0.9 }}>
                            ⚠️ Penalties
                        </Link>
                        <Link href="/shields" style={{ color: "#4ade80", fontSize: 13, textDecoration: "none", opacity: 0.9 }}>
                            🛡️ Shields
                        </Link>
                        <Link href="/how-to-join" style={{ color: "#60a5fa", fontSize: 13, textDecoration: "none", opacity: 0.9 }}>
                            📋 How to Join
                        </Link>
                        <Link href="/signup/player" style={{ color: "#60a5fa", fontSize: 13, textDecoration: "none", opacity: 0.9 }}>
                            🎮 Apply as Player
                        </Link>
                        <Link href="/signup/caster" style={{ color: "#a855f7", fontSize: 13, textDecoration: "none", opacity: 0.9 }}>
                            🎙️ Apply as Caster
                        </Link>
                    </div>

                    {/* Bottom: Copyright */}
                    <div style={{ textAlign: "center", fontSize: 12, opacity: 0.5 }}>
                        Organized by Rastats • TOTD Flashback © 2025
                    </div>
                </div>
            </footer>

            <DonationModal
                isOpen={showDonationModal}
                onClose={() => setShowDonationModal(false)}
            />
        </>
    );
}
