"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RosterPlayer {
    id: string;
    trackmaniaName: string;
    discordUsername: string;
    teamAssignment: "team1" | "team2" | "team3" | "team4" | "joker" | null;
    twitchUsername?: string;
    canStream: boolean;
}

const TEAMS = ["team1", "team2", "team3", "team4", "joker"] as const;

export default function RostersPage() {
    const [players, setPlayers] = useState<RosterPlayer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/rosters")
            .then(res => res.json())
            .then(data => {
                setPlayers(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const getTeamPlayers = (team: string) => {
        return players.filter(p => p.teamAssignment === team);
    };

    if (loading) {
        return (
            <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui", textAlign: "center", color: "#fff" }}>
                <p style={{ opacity: 0.7 }}>Loading rosters...</p>
            </main>
        );
    }

    return (
        <main style={{ maxWidth: 1400, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui", color: "#fff" }}>
            <div style={{ marginBottom: 32, textAlign: "center" }}>
                <h1 style={{ fontSize: 36, marginBottom: 8, fontWeight: "bold" }}>Official Rosters</h1>
                <p style={{ opacity: 0.6 }}>TOTD Flashback 2025</p>
                <Link href="/" style={{ marginTop: 16, display: "inline-block", color: "#60a5fa" }}>← Back to Home</Link>
            </div>

            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: 24,
                alignItems: "start"
            }}>
                {TEAMS.map(team => {
                    const teamPlayers = getTeamPlayers(team);
                    const isJoker = team === "joker";

                    return (
                        <div key={team} style={{
                            background: "#1e293b",
                            borderRadius: 12,
                            border: "1px solid #334155",
                            overflow: "hidden"
                        }}>
                            <div style={{
                                padding: "16px",
                                background: isJoker ? "#4c1d95" : "#0f172a",
                                borderBottom: "1px solid #334155",
                                textAlign: "center"
                            }}>
                                <h2 style={{ fontSize: 20, fontWeight: "bold", margin: 0 }}>
                                    {isJoker ? "🃏 Jokers" : `Team ${team.replace("team", "")}`}
                                </h2>
                                <span style={{ fontSize: 13, opacity: 0.7 }}>
                                    {teamPlayers.length} players
                                </span>
                            </div>

                            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                                {teamPlayers.length === 0 && (
                                    <p style={{ opacity: 0.5, textAlign: "center", fontStyle: "italic", fontSize: 14 }}>
                                        No players assigned yet
                                    </p>
                                )}
                                {teamPlayers.map(player => (
                                    <div key={player.id} style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "8px",
                                        background: "#0f172a",
                                        borderRadius: 6
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                                                {player.trackmaniaName || player.discordUsername}
                                            </div>
                                            {player.twitchUsername && (
                                                <div style={{ fontSize: 12, color: "#a78bfa", marginTop: 2 }}>
                                                    twitch.tv/{player.twitchUsername}
                                                </div>
                                            )}
                                        </div>
                                        {player.canStream && (
                                            <span title="Streamer" style={{ fontSize: 14 }}>📺</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </main>
    );
}
