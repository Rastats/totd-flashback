"use client";

import { useEffect, useState } from "react";

interface Donation {
    donation_id: string;
    amount: number;
    currency: string;
    donor_name: string;
    penalty_name: string;
    penalty_team: number;
    pot_team: number | null;
    processed_at: string;
}

const TEAM_COLORS: Record<number, string> = {
    1: "#ef4444",
    2: "#3b82f6",
    3: "#22c55e",
    4: "#f59e0b",
};

export default function OverlayDonationsPage() {
    const [donations, setDonations] = useState<Donation[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/donations");
                if (res.ok) {
                    const data = await res.json();
                    // API returns recentDonations, take first 3
                    setDonations((data.recentDonations || []).slice(0, 3));
                }
            } catch (err) {
                console.error("Failed to fetch donations:", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    if (donations.length === 0) {
        return <div style={{ background: "transparent", padding: 8, color: "#666", fontSize: 11 }}>No donations yet</div>;
    }

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: 8,
            fontFamily: "'Segoe UI', Roboto, sans-serif",
            background: "transparent",
            width: 280,
        }}>
            {donations.map((don) => {
                const teamColor = TEAM_COLORS[don.penalty_team] || "#888";
                
                return (
                    <div key={don.donation_id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        background: "rgba(0,0,0,0.8)",
                        borderRadius: 6,
                        borderLeft: `3px solid ${teamColor}`,
                    }}>
                        {/* Amount */}
                        <div style={{
                            fontSize: 14,
                            fontWeight: "bold",
                            color: "#22c55e",
                            minWidth: 50,
                            textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                        }}>
                            £{don.amount.toFixed(0)}
                        </div>

                        {/* Details */}
                        <div style={{ flex: 1, overflow: "hidden" }}>
                            <div style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#fff",
                                textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}>
                                {don.donor_name}
                            </div>
                            <div style={{
                                fontSize: 10,
                                color: teamColor,
                                fontWeight: 500,
                            }}>
                                {don.penalty_name} → T{don.penalty_team}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
