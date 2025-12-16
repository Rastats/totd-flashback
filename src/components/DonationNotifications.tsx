"use client";

import { useState, useEffect, useCallback } from "react";

export interface Donation {
    id: string;
    donorName: string;
    amount: number;
    currency: string;
    potTeam?: number | null;
    penaltyTeam?: number | null;
    isPotRandom?: boolean;
    isPenaltyRandom?: boolean;
    timestamp: Date;
}

// For demo/testing
const DEMO_DONATIONS: Donation[] = [];

export default function DonationNotifications() {
    const [notifications, setNotifications] = useState<Donation[]>([]);
    const [isEnabled, setIsEnabled] = useState(true);

    const addNotification = useCallback((donation: Donation) => {
        setNotifications((prev) => [donation, ...prev].slice(0, 5));
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== donation.id));
        }, 10000);
    }, []);

    // Expose function globally
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).triggerDonation = (data: Partial<Donation>) => {
            addNotification({
                id: `${Date.now()}-${Math.random()}`,
                donorName: data.donorName || "Anonymous",
                amount: data.amount || 10,
                currency: data.currency || "€",
                potTeam: data.potTeam || 1,
                penaltyTeam: data.penaltyTeam || 2,
                isPotRandom: data.isPotRandom || false,
                isPenaltyRandom: data.isPenaltyRandom || false,
                timestamp: new Date(),
            });
        };

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as any).triggerDonation;
        };
    }, [addNotification]);

    // Poll endpoint
    useEffect(() => {
        const fetchDonations = async () => {
            try {
                const res = await fetch("/api/donations");
                if (res.ok) {
                    const data = await res.json();
                    processNewDonations(data.recentDonations);
                }
            } catch (err) {
                console.error("Polling error", err);
            }
        };

        fetchDonations();
        const interval = setInterval(fetchDonations, 10000);
        return () => clearInterval(interval);
    }, [notifications]);

    const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

    const processNewDonations = (recent: any[]) => {
        if (!recent || recent.length === 0) return;

        recent.forEach(d => {
            if (!processedIds.has(d.id.toString())) {
                addNotification({
                    id: d.id.toString(),
                    donorName: d.donorName,
                    amount: Number(d.amount),
                    currency: d.currency,
                    potTeam: d.potTeam,
                    penaltyTeam: d.penaltyTeam,
                    isPotRandom: d.isPotRandom,
                    isPenaltyRandom: d.isPenaltyRandom,
                    timestamp: new Date(d.timestamp)
                });

                setProcessedIds(prev => {
                    const next = new Set(prev);
                    next.add(d.id.toString());
                    return next;
                });
            }
        });
    };

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

                    {/* Line 3: Pot Increase */}
                    <div style={{
                        padding: "6px 10px",
                        background: "#1a3a2a",
                        borderRadius: 6,
                        fontSize: 14,
                        color: "#4ade80",
                        marginBottom: 8,
                    }}>
                        📈 Pot: {donation.isPotRandom ? "Random" : (donation.potTeam ? `Team ${donation.potTeam}` : "Random")}
                    </div>

                    {/* Line 4: Penalty */}
                    <div style={{
                        padding: "6px 10px",
                        background: "#4a1a2a",
                        borderRadius: 6,
                        fontSize: 14,
                        color: "#f87171",
                    }}>
                        ⚠️ Penalty: {donation.isPenaltyRandom ? "Random" : (donation.penaltyTeam ? `Team ${donation.penaltyTeam}` : "Random")}
                    </div>
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
