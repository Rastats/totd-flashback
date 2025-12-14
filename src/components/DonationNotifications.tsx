"use client";

import { useState, useEffect, useCallback } from "react";

export interface Donation {
    id: string;
    donorName: string;
    amount: number;
    currency: string;
    teamSupported: string | null;
    teamPunished: string | null;
    penalty: string | null;
    timestamp: Date;
}

// For demo/testing - in production this would come from Tiltify API via /api/donations
const DEMO_DONATIONS: Donation[] = [];

export default function DonationNotifications() {
    const [notifications, setNotifications] = useState<Donation[]>([]);
    const [isEnabled, setIsEnabled] = useState(true); // Toggle to disable during dev

    // Add a notification
    const addNotification = useCallback((donation: Donation) => {
        setNotifications((prev) => [donation, ...prev].slice(0, 5)); // Keep last 5

        // Auto-remove after 10 seconds
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== donation.id));
        }, 10000);
    }, []);

    // Expose function globally for testing/manual triggers
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).triggerDonation = (data: Partial<Donation>) => {
            addNotification({
                id: `${Date.now()}-${Math.random()}`,
                donorName: data.donorName || "Anonymous",
                amount: data.amount || 10,
                currency: data.currency || "€",
                teamSupported: data.teamSupported || null,
                teamPunished: data.teamPunished || null,
                penalty: data.penalty || null,
                timestamp: new Date(),
            });
        };

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as any).triggerDonation;
        };
    }, [addNotification]);

    // TODO: Poll /api/donations endpoint when Tiltify API is available
    // useEffect(() => {
    //     const fetchDonations = async () => {
    //         const res = await fetch("/api/donations");
    //         const data = await res.json();
    //         // Process new donations...
    //     };
    //     const interval = setInterval(fetchDonations, 5000);
    //     return () => clearInterval(interval);
    // }, []);

    if (!isEnabled || notifications.length === 0) {
        return null;
    }

    return (
        <div style={{
            position: "fixed",
            top: 80,
            right: 16,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 350,
        }}>
            {notifications.map((donation, index) => (
                <div
                    key={donation.id}
                    style={{
                        padding: 16,
                        background: "linear-gradient(135deg, #1a2a1a, #0a1a0a)",
                        borderRadius: 12,
                        border: "2px solid #4ade80",
                        boxShadow: "0 8px 32px rgba(74, 222, 128, 0.3)",
                        animation: "slideIn 0.5s ease-out",
                        opacity: 1 - index * 0.15,
                    }}
                >
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 14, opacity: 0.7 }}>💚 New Donation!</span>
                        <span style={{ fontSize: 20, fontWeight: 700, color: "#4ade80" }}>
                            {donation.currency}{donation.amount.toFixed(2)}
                        </span>
                    </div>

                    {/* Donor name */}
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                        {donation.donorName}
                    </div>

                    {/* Team info */}
                    {(donation.teamSupported || donation.teamPunished) && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                            {donation.teamSupported && (
                                <span style={{
                                    padding: "4px 8px",
                                    background: "#22543d",
                                    borderRadius: 4,
                                    color: "#4ade80",
                                }}>
                                    ⬆️ {donation.teamSupported}
                                </span>
                            )}
                            {donation.teamPunished && (
                                <span style={{
                                    padding: "4px 8px",
                                    background: "#4a1a1a",
                                    borderRadius: 4,
                                    color: "#f87171",
                                }}>
                                    ⬇️ {donation.teamPunished}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Penalty */}
                    {donation.penalty && (
                        <div style={{
                            marginTop: 8,
                            padding: "6px 10px",
                            background: "#4a1a2a",
                            borderRadius: 6,
                            fontSize: 13,
                            color: "#f472b6",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}>
                            ⚡ {donation.penalty}
                        </div>
                    )}
                </div>
            ))}

            <style jsx global>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `}</style>
        </div>
    );
}
