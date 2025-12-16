"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
// Footer removed to avoid duplication
import { totds } from "@/data/totds";
import { getMapThumbnailUrl, getTrackmaniaIoUrl } from "@/utils/mapUtils";

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
        authorName: string; // Added authorName
        mapUid: string; // Added mapUid for linking
        date: string; // "July 2021"
        authorTime: string;
        thumbnailUrl: string; // generated from UID
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

// Helper to format Author Time (ms -> mm:ss.ms)
const formatAuthorTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

// --- Initial Data (Using Real TOTD Data) ---
// We pick specific maps to match the "progress" of each team for the demo
const getTotdByIndex = (index: number) => {
    const safeIndex = Math.min(Math.max(0, index - 1), totds.length - 1); // 1-based index to 0-based
    return totds[safeIndex];
};

const TEAM1_MAP = getTotdByIndex(453); // Map #453
const TEAM2_MAP = getTotdByIndex(449); // Map #449
const TEAM3_MAP = getTotdByIndex(431); // Map #431
const TEAM4_MAP = getTotdByIndex(416); // Map #416

const TOTAL_MAPS = 2000;

const INITIAL_TEAMS: TeamStatus[] = [
    {
        id: "team1",
        name: "Team 1",
        rank: 1,
        color: "#60a5fa",
        mapsFinished: TOTAL_MAPS - 453, // 1547
        totalMaps: TOTAL_MAPS,
        currentMap: {
            name: TEAM1_MAP.name,
            authorName: TEAM1_MAP.authorName,
            mapUid: TEAM1_MAP.mapUid,
            date: TEAM1_MAP.date,
            authorTime: formatAuthorTime(TEAM1_MAP.authorTime),
            thumbnailUrl: getMapThumbnailUrl(TEAM1_MAP.mapId)
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
        mapsFinished: TOTAL_MAPS - 449 + 5, // 1551 + 5 (Russian Roulette bonus)
        totalMaps: TOTAL_MAPS,
        currentMap: {
            name: TEAM2_MAP.name,
            authorName: TEAM2_MAP.authorName,
            mapUid: TEAM2_MAP.mapUid,
            date: TEAM2_MAP.date,
            authorTime: formatAuthorTime(TEAM2_MAP.authorTime),
            thumbnailUrl: getMapThumbnailUrl(TEAM2_MAP.mapId)
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
        mapsFinished: TOTAL_MAPS - 431, // 1569
        totalMaps: TOTAL_MAPS,
        currentMap: {
            name: TEAM3_MAP.name,
            authorName: TEAM3_MAP.authorName,
            mapUid: TEAM3_MAP.mapUid,
            date: TEAM3_MAP.date,
            authorTime: formatAuthorTime(TEAM3_MAP.authorTime),
            thumbnailUrl: getMapThumbnailUrl(TEAM3_MAP.mapId)
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
        mapsFinished: TOTAL_MAPS - 416, // 1584
        totalMaps: TOTAL_MAPS,
        currentMap: {
            name: TEAM4_MAP.name,
            authorName: TEAM4_MAP.authorName,
            mapUid: TEAM4_MAP.mapUid,
            date: TEAM4_MAP.date,
            authorTime: formatAuthorTime(TEAM4_MAP.authorTime),
            thumbnailUrl: getMapThumbnailUrl(TEAM4_MAP.mapId)
        },
        activeShield: null,
        activePenalties: [{ name: "Camera Shuffle", timeLeft: 800 }],
        penaltyQueue: 5
    }
];

const INITIAL_FEED: FeedEvent[] = [
    { id: "1", type: "month_finish", message: "Team 1 completed August 2021! 📅", teamId: "team1", timestamp: "14:05" },
    { id: "2", type: "donation_milestone", message: "We reached £1,500 raised! 🎉", timestamp: "14:04" },
    { id: "3", type: "shield_cooldown", message: "Team 2 Shield Cooldown expired (Ready to use)", teamId: "team2", timestamp: "14:03" },
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
            <div style={{ padding: 12, background: "rgba(0,0,0,0.2)", textAlign: "center", borderBottom: "1px solid #334155" }}>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: team.color }}>{team.name}</h3>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                    {team.mapsFinished} / {team.totalMaps} maps
                </div>
            </div>

            {/* Map Info */}
            <div style={{ padding: 12, flex: 1 }}>
                <a
                    href={getTrackmaniaIoUrl(team.currentMap.mapUid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                    <div style={{
                        aspectRatio: "16/9",
                        background: "#0f172a",
                        borderRadius: 8,
                        marginBottom: 12,
                        overflow: "hidden",
                        position: "relative",
                        border: "1px solid rgba(255,255,255,0.1)",
                        transition: "transform 0.2s"
                    }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                    >
                        {/* Placeholder for map image */}
                        <div style={{
                            width: "100%",
                            height: "100%",
                            background: `url(${team.currentMap.thumbnailUrl}) center/cover no-repeat`,
                            backgroundColor: "#000",
                        }} />
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 8px", background: "rgba(0,0,0,0.8)" }}>
                            <div style={{ fontSize: 13, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 1 }}>
                                {team.currentMap.name}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, opacity: 0.8 }}>
                                <span style={{ fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                                    by {team.currentMap.authorName}
                                </span>
                                <span style={{ whiteSpace: "nowrap" }}>{team.currentMap.date}</span>
                            </div>
                        </div>
                    </div>
                </a>

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

    // Sort teams by mapsFinished (descending)
    const sortedTeams = [...teams].sort((a, b) => b.mapsFinished - a.mapsFinished);

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

            <main style={{ padding: "24px", maxWidth: 1600, margin: "0 auto" }}>
                {/* Dashboard Header - Centered Timer */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    marginBottom: 24,
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
                    <div style={{ textAlign: "center", background: "#1e293b", padding: "12px 24px", borderRadius: 12, border: "1px solid #334155", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, opacity: 0.7, marginBottom: 2 }}>Time Remaining</div>
                        <div style={{ fontSize: 32, fontFamily: "monospace", fontWeight: "bold", color: "#fff", lineHeight: 1 }}>
                            {formatCountdown(timeLeftMs)}
                        </div>
                    </div>

                    {/* Right: Empty (for balance) */}
                    <div></div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
                    {/* LEFT COLUMN: Teams Grid & Timeline */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                        {/* Teams Grid (4 columns now since Joker removed) */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                            {sortedTeams.map((team, index) => (
                                <TeamCard key={team.id} team={{ ...team, rank: index + 1 }} />
                            ))}
                        </div>

                        {/* Visual Timeline (Static Mockup) */}
                        <div style={{ background: "#1e293b", padding: "16px 16px 40px 16px", borderRadius: 12, border: "1px solid #334155" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <h3 style={{ margin: 0, fontSize: 16 }}>Event Timeline</h3>
                                <div style={{ fontSize: 11, opacity: 0.6 }}>Progress towards July 2020</div>
                            </div>

                            <div style={{ position: "relative", height: 32, background: "#0f172a", borderRadius: 20, display: "flex", alignItems: "center", padding: "0 10px" }}>
                                {/* Timeline Track */}
                                <div style={{ position: "absolute", left: 10, right: 10, height: 4, background: "#334155", borderRadius: 2 }}></div>

                                {/* Start Marker (Dec 2025) */}
                                <div style={{ position: "absolute", left: "2%", top: 34, fontSize: 10, opacity: 0.5 }}>Dec 2025</div>

                                {/* End Marker (July 2020) */}
                                <div style={{ position: "absolute", right: "2%", top: 34, fontSize: 10, opacity: 0.5 }}>July 2020</div>

                                {/* Team Markers */}
                                {teams.map((team, i) => {
                                    // Calculate fake position based on mapsFinished
                                    const percent = (team.mapsFinished / team.totalMaps) * 100;
                                    const isTop = i % 2 === 0;
                                    // Stagger heights: Teams 1&2 (i=0,1) get longer arrows to be outer
                                    // Teams 3&4 (i=2,3) get shorter arrows to be inner
                                    const arrowHeight = (i < 2) ? 35 : 20;

                                    return (
                                        <div key={team.id} style={{
                                            position: "absolute",
                                            left: `${percent}%`,
                                            top: "50%",
                                            transform: "translate(-50%, -50%)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            zIndex: 5,
                                            width: 0,
                                            height: 0
                                        }}>
                                            {/* The Dot */}
                                            <div style={{
                                                position: "absolute",
                                                width: 12,
                                                height: 12,
                                                borderRadius: "50%",
                                                background: team.color,
                                                border: "2px solid #fff",
                                                boxShadow: "0 0 10px " + team.color,
                                                zIndex: 10
                                            }} />

                                            {/* Connector & Label */}
                                            <div style={{
                                                position: "absolute",
                                                [isTop ? "bottom" : "top"]: 10, // Start offset from the dot
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                whiteSpace: "nowrap",
                                                zIndex: 20
                                            }}>
                                                {isTop ? (
                                                    /* Label Above */
                                                    <>
                                                        <div style={{
                                                            fontSize: 10,
                                                            color: team.color,
                                                            fontWeight: "bold",
                                                            marginBottom: 2,
                                                            background: "rgba(0, 0, 0, 0.8)",
                                                            padding: "2px 6px",
                                                            borderRadius: 4,
                                                            border: `1px solid ${team.color}44`
                                                        }}>
                                                            {team.name}
                                                        </div>
                                                        <div style={{ width: 2, height: arrowHeight, background: team.color }}></div>
                                                        {/* Arrow Tip Down */}
                                                        <div style={{
                                                            width: 0, height: 0,
                                                            borderLeft: "4px solid transparent",
                                                            borderRight: "4px solid transparent",
                                                            borderTop: `4px solid ${team.color}`,
                                                            marginBottom: -2
                                                        }}></div>
                                                    </>
                                                ) : (
                                                    /* Label Below */
                                                    <>
                                                        {/* Arrow Tip Up */}
                                                        <div style={{
                                                            width: 0, height: 0,
                                                            borderLeft: "4px solid transparent",
                                                            borderRight: "4px solid transparent",
                                                            borderBottom: `4px solid ${team.color}`,
                                                            marginTop: -2
                                                        }}></div>
                                                        <div style={{ width: 2, height: arrowHeight, background: team.color }}></div>
                                                        <div style={{
                                                            fontSize: 10,
                                                            color: team.color,
                                                            fontWeight: "bold",
                                                            marginTop: 2,
                                                            background: "rgba(0, 0, 0, 0.8)",
                                                            padding: "2px 6px",
                                                            borderRadius: 4,
                                                            border: `1px solid ${team.color}44`
                                                        }}>
                                                            {team.name}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ height: 16 }}></div>
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

        </div>
    );
}
