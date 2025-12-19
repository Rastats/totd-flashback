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
                const res = await fetch("/api/donations?limit=3");
                if (res.ok) {
                    const data = await res.json();
                    setDonations(data.donations || []);
                }
            } catch (err) {
                console.error("Failed to fetch donations:", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 12,
            fontFamily: "'Segoe UI', Roboto, sans-serif",
            background: "transparent",
        }}>
            {donations.map((don) => {
                const teamColor = TEAM_COLORS[don.penalty_team] || "#888";
                
                return (
                    <div key={don.donation_id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        background: "rgba(0,0,0,0.75)",
                        borderRadius: 8,
                        borderLeft: `4px solid ${teamColor}`,
                    }}>
                        {/* Amount */}
                        <div style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: "#22c55e",
                            minWidth: 70,
                            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                        }}>
                            £{don.amount.toFixed(0)}
                        </div>

                        {/* Details */}
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#fff",
                                textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                            }}>
                                {don.donor_name}
                            </div>
                            <div style={{
                                fontSize: 12,
                                color: teamColor,
                                fontWeight: 500,
                            }}>
                                {don.penalty_name} → Team {don.penalty_team}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
