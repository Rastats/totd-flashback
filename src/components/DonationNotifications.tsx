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
                    {/* Line 1: New Donation! */}
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "#4ade80" }}>
                        💚 New Donation!
                    </div>

                    {/* Line 2: Amount - Donor Name */}
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                        £{donation.amount.toFixed(2)} - {donation.donorName}
                    </div>

                    {/* Line 3: Penalty → Team punished */}
                    {donation.penalty && donation.teamPunished && (
                        <div style={{
                            padding: "6px 10px",
                            background: "#4a1a2a",
                            borderRadius: 6,
                            fontSize: 14,
                            color: "#f87171",
                            marginBottom: 8,
                        }}>
                            {donation.penalty} → {donation.teamPunished}
                        </div>
                    )}

                    {/* Line 4: Bank emoji + Team supported */}
                    {donation.teamSupported && (
                        <div style={{
                            padding: "6px 10px",
                            background: "#1a3a2a",
                            borderRadius: 6,
                            fontSize: 14,
                            color: "#4ade80",
                        }}>
                            💰 {donation.teamSupported}
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
