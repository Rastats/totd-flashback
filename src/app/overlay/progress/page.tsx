"use client";

import { useEffect, useState } from "react";

interface TeamProgress {
    id: number;
    name: string;
    color: string;
    activePlayer: string | null;
    mapsCompleted: number;
    isOnline: boolean;
}

const TOTAL_MAPS = 2000; // All TOTDs

export default function OverlayProgressPage() {
    const [teams, setTeams] = useState<TeamProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/live-status");
                if (res.ok) {
                    const data = await res.json();
                    setTeams(data.teams || []);
                    setIsConnected(true);
                } else {
                    setIsConnected(false);
                }
            } catch (err) {
                console.error("Failed to fetch live status:", err);
                setIsConnected(false);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return <div style={{ background: "transparent" }} />;
    }

    // Show disconnected indicator (U2 improvement)
    if (!isConnected && teams.length === 0) {
        return (
            <div style={{
                padding: 12,
                background: "rgba(0,0,0,0.8)",
                borderRadius: 6,
                border: "2px solid #ef4444",
                color: "#ef4444",
                fontFamily: "'Segoe UI', Roboto, sans-serif",
                fontSize: 12,
                textAlign: "center",
            }}>
                ⚠️ Connection Lost
            </div>
        );
    }

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: 8,
            fontFamily: "'Segoe UI', Roboto, sans-serif",
            background: "transparent",
            width: 380,
        }}>
            {teams.map((team) => {
                const progress = Math.min((team.mapsCompleted / TOTAL_MAPS) * 100, 100);

                return (
                    <div key={team.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}>
                        {/* Team Label */}
                        <div style={{
                            width: 90,
                            fontSize: 11,
                            fontWeight: "bold",
                            color: team.color,
                            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                            whiteSpace: "nowrap",
                        }}>
                            {team.name}
                        </div>

                        {/* Progress Bar Container */}
                        <div style={{
                            flex: 1,
                            height: 26,
                            background: "rgba(0,0,0,0.7)",
                            borderRadius: 5,
                            border: `2px solid ${team.color}`,
                            overflow: "hidden",
                            position: "relative",
                        }}>
                            {/* Progress Fill */}
                            <div style={{
                                width: `${progress}%`,
                                height: "100%",
                                background: `linear-gradient(90deg, ${team.color}88, ${team.color})`,
                                transition: "width 0.5s ease-out",
                            }} />

                            {/* Active Player Name (overlay) */}
                            <div style={{
                                position: "absolute",
                                top: 0,
                                left: 8,
                                right: 8,
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}>
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "#fff",
                                    textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                                    opacity: team.isOnline ? 1 : 0.5,
                                }}>
                                    {team.isOnline ? (team.activePlayer || "—") : "Offline"}
                                </span>
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: "bold",
                                    color: "#fff",
                                    textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                                }}>
                                    {team.mapsCompleted}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
