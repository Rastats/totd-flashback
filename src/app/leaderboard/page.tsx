"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";

// --- Types (Dummy Data) ---
type TeamId = "team1" | "team2" | "team3" | "team4";

interface TeamStatus {
    id: TeamId;
    name: string;
    rank: number;
    color: string;
    mapsFinished: number;
    totalMaps: number; // e.g. 1500
    currentMap: {
        name: string;
        date: string; // "July 2021"
        authorTime: string;
        thumbnailUrl: string; // placeholder
    };
    activeShield: {
        type: "small" | "big";
        timeLeft: number; // seconds
    } | null;
    activePenalties: {
        name: string;
        timeLeft: number; // seconds
    }[];
    penaltyQueue: number;
}

interface FeedEvent {
    id: string;
    type: "month_finish" | "penalty" | "shield" | "shield_cooldown" | "donation_milestone";
    message: string;
    teamId?: TeamId;
    timestamp: string; // "14:02"
}

// --- Dummy Data ---
const INITIAL_TEAMS: TeamStatus[] = [
    {
        id: "team1",
        name: "Team 1",
        rank: 1,
        color: "#60a5fa",
        mapsFinished: 452,
        totalMaps: 1500,
        currentMap: {
            name: "TOTD #453 - Canyon Drift",
            date: "September 2021",
            authorTime: "00:42.123",
            thumbnailUrl: "https://via.placeholder.com/300x169/1e293b/FFFFFF?text=Map+Thumbnail"
        },
        activeShield: { type: "big", timeLeft: 3400 },
        activePenalties: [],
        penaltyQueue: 0
    },
    {
        id: "team2",
        name: "Team 2",
        rank: 2,
        color: "#a78bfa",
        mapsFinished: 448,
        totalMaps: 1500,
        currentMap: {
            name: "TOTD #449 - Grass Temple",
            date: "September 2021",
            authorTime: "00:38.991",
            thumbnailUrl: "https://via.placeholder.com/300x169/1e293b/FFFFFF?text=Map+Thumbnail"
        },
        activeShield: null,
        activePenalties: [{ name: "Tunnel Vision", timeLeft: 145 }],
        penaltyQueue: 2
    },
    {
        id: "team3",
        name: "Team 3",
        rank: 3,
        color: "#f472b6",
        mapsFinished: 430,
        totalMaps: 1500,
        currentMap: {
            name: "TOTD #431 - Ice Slide",
            date: "August 2021",
            authorTime: "00:51.000",
            thumbnailUrl: "https://via.placeholder.com/300x169/1e293b/FFFFFF?text=Map+Thumbnail"
        },
        activeShield: null,
        activePenalties: [],
        penaltyQueue: 0
    },
    {
        id: "team4",
        name: "Team 4",
        rank: 4,
        color: "#34d399",
        mapsFinished: 415,
        totalMaps: 1500,
        currentMap: {
            name: "TOTD #416 - Dirt Valley",
            date: "August 2021",
            authorTime: "00:44.555",
            thumbnailUrl: "https://via.placeholder.com/300x169/1e293b/FFFFFF?text=Map+Thumbnail"
        },
        activeShield: null,
        activePenalties: [{ name: "Camera Shuffle", timeLeft: 800 }],
        penaltyQueue: 5
    }
];

const INITIAL_FEED: FeedEvent[] = [
    { id: "1", type: "month_finish", message: "Team 1 completed August 2021! 📅", teamId: "team1", timestamp: "14:05" },
    { id: "2", type: "donation_milestone", message: "We reached £1,500 raised! 🎉", timestamp: "14:04" },
    { id: "3", type: "shield_cooldown", message: "Team 2 Shield Cooldown expired", teamId: "team2", timestamp: "14:03" },
    { id: "4", type: "penalty", message: "Team 2 : 'Tunnel Vision' activated by anon (£20)", teamId: "team2", timestamp: "14:01" },
    { id: "5", type: "shield", message: "Team 4 bought a Small Shield", teamId: "team4", timestamp: "13:58" },
];

// --- Helpers ---
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatCountdown = (ms: number) => {
    if (ms <= 0) return "EVENT ENDED";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours}h ${mins}m ${secs.toString().padStart(2, '0')}s`;
};

// --- Components ---

const TeamCard = ({ team }: { team: TeamStatus }) => {
    return (
        <div style={{
            background: "#1e293b",
            borderRadius: 12,
            border: `2px solid ${team.color}`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            position: "relative"
        }}>
            {/* Rank Badge */}
            <div style={{
                position: "absolute",
                top: 12,
                left: 12,
                background: team.color,
                color: "#0f172a",
                fontWeight: "bold",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                boxShadow: "0 2px 5px rgba(0,0,0,0.3)"
            }}>
                #{team.rank}
            </div>

            {/* Header */}
            <div style={{ padding: 16, background: "rgba(0,0,0,0.2)", textAlign: "center", borderBottom: "1px solid #334155" }}>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: team.color }}>{team.name}</h3>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                    {team.mapsFinished} / {team.totalMaps} maps
                </div>
            </div>

            {/* Map Info */}
            <div style={{ padding: 16, flex: 1 }}>
                <div style={{
                    aspectRatio: "16/9",
                    background: "#0f172a",
                    borderRadius: 8,
                    marginBottom: 12,
                    overflow: "hidden",
                    position: "relative"
                }}>
                    {/* Placeholder for map image */}
                    <div style={{
                        width: "100%",
                        height: "100%",
                        background: `url(${team.currentMap.thumbnailUrl}) center/cover no-repeat`,
                        opacity: 0.6
                    }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 8, background: "rgba(0,0,0,0.8)" }}>
                        <div style={{ fontSize: 14, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {team.currentMap.name}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.8 }}>
                            <span>{team.currentMap.date}</span>
                            <span>AT: {team.currentMap.authorTime}</span>
                        </div>
                    </div>
                </div>

                {/* Status Section */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Shield Status */}
                    {team.activeShield ? (
                        <div style={{ background: "rgba(52, 211, 153, 0.2)", border: "1px solid #34d399", borderRadius: 6, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#34d399", fontWeight: "bold" }}>🛡️ {team.activeShield.type === "big" ? "BIG" : "Small"} Shield</span>
                            <span style={{ fontSize: 14, fontFamily: "monospace" }}>{formatTime(team.activeShield.timeLeft)}</span>
                        </div>
                    ) : (
                        <div style={{ padding: "8px 12px", opacity: 0.3, fontSize: 13, border: "1px dashed #666", borderRadius: 6, textAlign: "center" }}>
                            No active shield
                        </div>
                    )}

                    {/* Penalties */}
                    <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, opacity: 0.6 }}>Active Penalties</div>
                        {team.activePenalties.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {team.activePenalties.map((p, i) => (
                                    <div key={i} style={{ background: "rgba(248, 113, 113, 0.2)", border: "1px solid #f87171", borderRadius: 4, padding: "4px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                                        <span style={{ color: "#f87171" }}>⚠️ {p.name}</span>
                                        <span style={{ fontFamily: "monospace" }}>{formatTime(p.timeLeft)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: 13, opacity: 0.5, fontStyle: "italic" }}>None</div>
                        )}
                    </div>

                    {/* Queue */}
                    {team.penaltyQueue > 0 && (
                        <div style={{ marginTop: 8, padding: "4px 8px", background: "#4a1a1a", borderRadius: 4, fontSize: 12, color: "#fca5a5", textAlign: "center" }}>
                            +{team.penaltyQueue} penalties in queue
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function LeaderboardPage() {
    const [teams, setTeams] = useState<TeamStatus[]>(INITIAL_TEAMS);
    const [feed, setFeed] = useState<FeedEvent[]>(INITIAL_FEED);
    const [timeLeftMs, setTimeLeftMs] = useState(0);

    // Countdown Effect
    useEffect(() => {
        // Target: Dec 24, 2025 at 18:00:00 Paris Time (CET which is UTC+1)
        // ISO string with offset: 2025-12-24T18:00:00+01:00
        const targetDate = new Date("2025-12-24T18:00:00+01:00").getTime();

        const updateTimer = () => {
            const now = new Date().getTime();
            const diff = targetDate - now;
            setTimeLeftMs(Math.max(0, diff));
        };

        updateTimer(); // initial
        const timer = setInterval(() => {
            updateTimer();

            // Randomly decrease shield/penalty timers for demo
            setTeams(prevTeams => prevTeams.map(team => ({
                ...team,
                activeShield: team.activeShield ? { ...team.activeShield, timeLeft: Math.max(0, team.activeShield.timeLeft - 1) } : null,
                activePenalties: team.activePenalties.map(p => ({ ...p, timeLeft: Math.max(0, p.timeLeft - 1) }))
            })));

        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div style={{ background: "#0f172a", minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
            {/* Header removed, using global layout */}

            <main style={{ padding: "48px 24px 24px", maxWidth: 1600, margin: "0 auto" }}>
                {/* Dashboard Header - Centered Timer */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    marginBottom: 48,
                    gap: 16
                }}>
                    {/* Left: Title */}
                    <div>
                        <h1 style={{ fontSize: 36, fontWeight: "bold", background: "linear-gradient(to right, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
                            LIVE LEADERBOARD
                        </h1>
                        <p style={{ opacity: 0.6, marginTop: 4, fontSize: 14 }}>TOTD Flashback Event • Real-time tracking</p>
                    </div>

                    {/* Center: Timer */}
                    <div style={{ textAlign: "center", background: "#1e293b", padding: "16px 32px", borderRadius: 12, border: "1px solid #334155", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 2, opacity: 0.7, marginBottom: 4 }}>Time Remaining</div>
                        <div style={{ fontSize: 42, fontFamily: "monospace", fontWeight: "bold", color: "#fff", lineHeight: 1 }}>
                            {formatCountdown(timeLeftMs)}
                        </div>
                    </div>

                    {/* Right: Empty (for balance) */}
                    <div></div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
                    {/* LEFT COLUMN: Teams Grid & Timeline */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

                        {/* Teams Grid (4 columns now since Joker removed) */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                            {teams.map(team => (
                                <TeamCard key={team.id} team={team} />
                            ))}
                        </div>

                        {/* Visual Timeline (Static Mockup) */}
                        <div style={{ background: "#1e293b", padding: 24, borderRadius: 12, border: "1px solid #334155" }}>
                            <h3 style={{ margin: "0 0 16px 0", fontSize: 18 }}>Event Timeline</h3>
                            <div style={{ position: "relative", height: 40, background: "#0f172a", borderRadius: 20, display: "flex", alignItems: "center", padding: "0 10px" }}>
                                {/* Timeline Track */}
                                <div style={{ position: "absolute", left: 10, right: 10, height: 4, background: "#334155", borderRadius: 2 }}></div>

                                {/* 2020 Marker */}
                                <div style={{ position: "absolute", left: "2%", top: 45, fontSize: 12, opacity: 0.5 }}>July 2020</div>

                                {/* 2025 Marker */}
                                <div style={{ position: "absolute", right: "2%", top: 45, fontSize: 12, opacity: 0.5 }}>Dec 2025</div>

                                {/* Team Markers */}
                                {teams.map((team, i) => {
                                    // Calculate fake position based on mapsFinished
                                    const percent = (team.mapsFinished / team.totalMaps) * 100;
                                    return (
                                        <div key={team.id} style={{
                                            position: "absolute",
                                            left: `${percent}%`,
                                            top: -6 + (i % 2 === 0 ? -15 : 15), // stagger
                                            transform: "translateX(-50%)",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center"
                                        }}>
                                            <div style={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: "50%",
                                                background: team.color,
                                                border: "2px solid #fff",
                                                boxShadow: "0 0 10px " + team.color
                                            }} />
                                            <div style={{ fontSize: 10, marginTop: 4, color: team.color, fontWeight: "bold" }}>{team.name}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ height: 20 }}></div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Event Feed */}
                    <div style={{
                        background: "#1e293b",
                        borderRadius: 12,
                        border: "1px solid #334155",
                        padding: 16,
                        height: "fit-content",
                        maxHeight: "800px",
                        position: "sticky",
                        top: 24
                    }}>
                        <h3 style={{ margin: "0 0 16px 0", fontSize: 18, borderBottom: "1px solid #334155", paddingBottom: 12 }}>Live Feed</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {feed.map(event => (
                                <div key={event.id} style={{
                                    paddingRight: 8,
                                    borderLeft: `3px solid ${event.teamId ? INITIAL_TEAMS.find(t => t.id === event.teamId)?.color : "#fff"}`,
                                    paddingLeft: 12
                                }}>
                                    <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 2 }}>{event.timestamp}</div>
                                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                                        {event.message}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
