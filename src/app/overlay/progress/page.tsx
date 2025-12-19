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

const TOTAL_MAPS = 99; // Maps 1902 to 2000

export default function OverlayProgressPage() {
    const [teams, setTeams] = useState<TeamProgress[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/live-status");
                if (res.ok) {
                    const data = await res.json();
                    setTeams(data.teams || []);
                }
            } catch (err) {
                console.error("Failed to fetch live status:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return <div style={{ background: "transparent" }} />;
    }

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 16,
            fontFamily: "'Segoe UI', Roboto, sans-serif",
            background: "transparent",
        }}>
            {teams.map((team) => {
                const progress = Math.min((team.mapsCompleted / TOTAL_MAPS) * 100, 100);

                return (
                    <div key={team.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                    }}>
                        {/* Team Label */}
                        <div style={{
                            width: 80,
                            fontSize: 16,
                            fontWeight: "bold",
                            color: team.color,
                            textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                        }}>
                            {team.name}
                        </div>

                        {/* Progress Bar Container */}
                        <div style={{
                            flex: 1,
                            height: 36,
                            background: "rgba(0,0,0,0.6)",
                            borderRadius: 8,
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
                                left: 12,
                                right: 12,
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}>
                                <span style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "#fff",
                                    textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                                    opacity: team.isOnline ? 1 : 0.5,
                                }}>
                                    {team.isOnline ? (team.activePlayer || "—") : "Offline"}
                                </span>
                                <span style={{
                                    fontSize: 14,
                                    fontWeight: "bold",
                                    color: "#fff",
                                    textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                                }}>
                                    {team.mapsCompleted} / {TOTAL_MAPS}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
