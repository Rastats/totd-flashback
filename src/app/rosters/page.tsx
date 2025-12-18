"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApplicationStatus, AvailabilitySlot } from "@/lib/types";
import { TEAM_IDS } from "@/lib/config";

interface RosterPlayer {
    id: string;
    trackmaniaName: string;
    discordUsername: string;
    teamAssignment: "team1" | "team2" | "team3" | "team4" | "joker" | null;
    twitchUsername?: string;
    canStream: boolean;
    isCaptain?: boolean;
}

interface CasterRoster {
    id: string;
    displayName: string;
    discordUsername: string;
    twitchUsername?: string;
    englishLevel: string;
    status: ApplicationStatus;
}

const TEAMS = TEAM_IDS;

export default function RostersPage() {
    const [players, setPlayers] = useState<RosterPlayer[]>([]);
    const [casters, setCasters] = useState<CasterRoster[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [playersRes, castersRes] = await Promise.all([
                    fetch("/api/rosters"),
                    fetch("/api/casters")
                ]);

                if (!playersRes.ok) throw new Error("Failed to fetch players");
                const playersData = await playersRes.json();

                if (Array.isArray(playersData)) {
                    setPlayers(playersData);
                } else {
                    console.error("Players data is not an array:", playersData);
                    setPlayers([]);
                }

                if (castersRes.ok) {
                    const castersData = await castersRes.json();
                    if (Array.isArray(castersData)) {
                        setCasters((castersData as CasterRoster[]).filter(c => c.status === "approved"));
                    } else {
                        console.error("Casters data is not an array:", castersData);
                        setCasters([]);
                    }
                } else {
                    console.warn("Failed to fetch casters");
                    setCasters([]);
                }
            } catch (err) {
                console.error("Error loading rosters:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
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
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 24,
                alignItems: "start"
            }}>
                {/* Casters Section */}
                <div style={{
                    background: "#1e293b",
                    borderRadius: 12,
                    border: "1px solid #334155",
                    overflow: "hidden",
                    gridColumn: "1 / -1", // Full width on small screens, or specific placement
                    maxWidth: "800px",
                    margin: "0 auto 24px auto",
                    width: "100%"
                }}>
                    <div style={{
                        padding: "16px",
                        background: "#be185d", // Pinkish for Casters
                        borderBottom: "1px solid #334155",
                        textAlign: "center"
                    }}>
                        <h2 style={{ fontSize: 22, fontWeight: "bold", margin: 0 }}>
                            🎙️ Broadcast Team
                        </h2>
                        <span style={{ fontSize: 13, opacity: 0.9 }}>
                            {casters.length} casters
                        </span>
                    </div>

                    <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                        {casters.length === 0 && (
                            <p style={{ opacity: 0.5, textAlign: "center", fontStyle: "italic", fontSize: 14, width: "100%" }}>
                                Casting team coming soon...
                            </p>
                        )}
                        {casters.map(caster => (
                            <div key={caster.id} style={{
                                display: "flex",
                                flexDirection: "column",
                                padding: "12px",
                                background: "#0f172a",
                                borderRadius: 6,
                                border: "1px solid #334155"
                            }}>
                                <div style={{ fontWeight: 600, fontSize: 15, color: "#f472b6" }}>
                                    {caster.displayName}
                                </div>
                                {caster.twitchUsername && (
                                    <a href={`https://twitch.tv/${caster.twitchUsername}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#a78bfa", marginTop: 4, textDecoration: "none" }}>
                                        twitch.tv/{caster.twitchUsername}
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Teams Section */}
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
                                        borderRadius: 6,
                                        border: player.isCaptain ? "1px solid #eab308" : "none"
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                                                {player.trackmaniaName || player.discordUsername}
                                                {player.isCaptain && (
                                                    <span title="Captain" style={{ fontSize: 12 }}>👑</span>
                                                )}
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
