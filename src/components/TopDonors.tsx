"use client";

import { useState, useEffect } from "react";

interface Donation {
    id: string;
    donor_name: string;
    amount: number;
    completed_at: string;
}

interface TopDonorsProps {
    limit?: number;
    showAmount?: boolean;
}

export default function TopDonors({ limit = 5, showAmount = true }: TopDonorsProps) {
    const [donations, setDonations] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTopDonors = async () => {
            try {
                const res = await fetch(`/api/top-donors?limit=${limit}`);
                if (res.ok) {
                    const data = await res.json();
                    setDonations(data);
                }
            } catch (error) {
                console.error("Failed to fetch top donors:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTopDonors();
        // Refresh every 30 seconds
        const interval = setInterval(fetchTopDonors, 30000);
        return () => clearInterval(interval);
    }, [limit]);

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: 20, opacity: 0.6 }}>
                Loading top donors...
            </div>
        );
    }

    if (donations.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: 20, opacity: 0.6 }}>
                No donations yet. Be the first!
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {donations.map((donation, index) => (
                <div
                    key={donation.id}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        background: index === 0 ? "linear-gradient(135deg, #2a2a1a, #3a3a2a)" : "#1a1a2a",
                        borderRadius: 8,
                        border: index === 0 ? "1px solid #f59e0b" : "1px solid #2a2a3a",
                    }}
                >
                    <span style={{
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: index === 0 ? "#f59e0b" : index === 1 ? "#94a3b8" : index === 2 ? "#cd7c32" : "#4a4a5a",
                        borderRadius: "50%",
                        fontWeight: "bold",
                        fontSize: 14,
                        color: index < 3 ? "#000" : "#fff",
                    }}>
                        {index + 1}
                    </span>
                    <span style={{ flex: 1, fontWeight: index === 0 ? 600 : 400 }}>
                        {donation.donor_name || "Anonymous"}
                    </span>
                    {showAmount && (
                        <span style={{
                            fontWeight: 600,
                            color: "#f59e0b",
                            fontSize: index === 0 ? 18 : 14,
                        }}>
                            £{donation.amount.toFixed(2)}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
