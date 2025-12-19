"use client";

import { useEffect, useState, useRef } from "react";

interface Alert {
    id: string;
    type: "penalty" | "shield";
    teamId: number;
    name: string;
    donorName?: string;
    amount?: number;
    timestamp: number;
}

const TEAM_COLORS: Record<number, string> = {
    1: "#ef4444",
    2: "#3b82f6",
    3: "#22c55e",
    4: "#f59e0b",
};

const PENALTY_ICONS: Record<string, string> = {
    "Russian Roulette": "🎰",
    "Camera Shuffle": "📷",
    "Cursed Controller": "🎮",
    "Clean Run Only": "✨",
    "Pedal to the Metal": "⛽",
    "Tunnel Vision": "🔦",
    "Player Switch": "🔄",
    "Can't Turn Right": "⬅️",
    "AT or Bust": "🏆",
    "Back to the Future": "⏪",
    "Small Shield": "🛡️",
    "Big Shield": "🛡️🛡️",
};

export default function OverlayAlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const seenDonations = useRef<Set<string>>(new Set());

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/donations?limit=5");
                if (res.ok) {
                    const data = await res.json();
                    const donations = data.donations || [];

                    // Check for new donations
                    const newAlerts: Alert[] = [];
                    for (const don of donations) {
                        if (!seenDonations.current.has(don.donation_id)) {
                            seenDonations.current.add(don.donation_id);
                            
                            // Only show alerts for actual penalties (not "Support Only")
                            if (don.penalty_id > 0) {
                                newAlerts.push({
                                    id: don.donation_id,
                                    type: don.penalty_name.includes("Shield") ? "shield" : "penalty",
                                    teamId: don.penalty_team,
                                    name: don.penalty_name,
                                    donorName: don.donor_name,
                                    amount: don.amount,
                                    timestamp: Date.now(),
                                });
                            }
                        }
                    }

                    if (newAlerts.length > 0) {
                        setAlerts(prev => [...newAlerts, ...prev].slice(0, 3));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch donations:", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    // Remove alerts after 8 seconds
    useEffect(() => {
        const cleanup = setInterval(() => {
            const now = Date.now();
            setAlerts(prev => prev.filter(a => now - a.timestamp < 8000));
        }, 1000);
        return () => clearInterval(cleanup);
    }, []);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 16,
            fontFamily: "'Segoe UI', Roboto, sans-serif",
            background: "transparent",
        }}>
            {alerts.map((alert, idx) => {
                const teamColor = TEAM_COLORS[alert.teamId] || "#888";
                const icon = PENALTY_ICONS[alert.name] || "⚡";
                const isShield = alert.type === "shield";
                const age = Date.now() - alert.timestamp;
                const opacity = Math.max(0, 1 - (age / 8000) * 0.5);

                return (
                    <div
                        key={alert.id}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "12px 16px",
                            background: isShield 
                                ? "linear-gradient(90deg, rgba(34,197,94,0.9), rgba(16,185,129,0.8))"
                                : "linear-gradient(90deg, rgba(239,68,68,0.9), rgba(185,28,28,0.8))",
                            borderRadius: 10,
                            border: `2px solid ${isShield ? "#22c55e" : teamColor}`,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                            opacity,
                            transform: `translateX(${idx === 0 ? 0 : -10}px)`,
                            transition: "opacity 0.3s, transform 0.3s",
                        }}
                    >
                        {/* Icon */}
                        <div style={{
                            fontSize: 28,
                            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                        }}>
                            {icon}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: 16,
                                fontWeight: "bold",
                                color: "#fff",
                                textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                            }}>
                                {alert.name}
                            </div>
                            <div style={{
                                fontSize: 13,
                                color: "rgba(255,255,255,0.9)",
                                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                            }}>
                                {alert.donorName} • £{alert.amount?.toFixed(0)} → Team {alert.teamId}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
