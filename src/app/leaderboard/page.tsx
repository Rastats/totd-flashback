"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TEAMS } from "@/lib/config";
import { totds } from "@/data/totds";
import { getMapThumbnailUrl, getTrackmaniaIoUrl } from "@/utils/mapUtils";

// --- Types ---
interface TeamStatus {
    id: number;
    name: string;
    color: string;
    mapsFinished: number;
    totalMaps: number;
    activePlayer: string | null;
    currentMap: {
        name: string;
        authorName: string;
        mapUid: string;
        mapIndex: number;
        date: string;
        authorTime: string;
        thumbnailUrl: string;
    } | null;
    activeShield: {
        type: "small" | "big";
        timeLeft: number;
    } | null;
    shieldCooldowns: {
        small: number | null;  // seconds until available, null = available
        big: number | null;    // seconds until available, null = available
    };
    activePenalties: {
        name: string;
        timeLeft: number;
        mapsRemaining: number;
        mapsTotal: number;
    }[];
    penaltyWaitlist: string[];
    isOnline: boolean;
    teamPot: number;
}

interface FeedEvent {
    id: string;
    type: "donation" | "penalty" | "shield" | "milestone";
    message: string;
    teamId?: number;
    timestamp: string;
}

// Helper to format Author Time (ms -> mm:ss.ms)
const formatAuthorTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

const TOTAL_MAPS = 2000;

// Team colors from config
const TEAM_COLORS: Record<number, { name: string; color: string }> = Object.fromEntries(
    TEAMS.map(t => [t.number, { name: t.name, color: t.color }])
);

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

// Get TOTD info by map number (1-based)
const getTotdInfo = (mapNumber: number) => {
    if (mapNumber < 1 || mapNumber > totds.length) return null;
    const totd = totds[mapNumber - 1];
    return {
        name: totd.name,
        authorName: totd.authorName,
        mapUid: totd.mapUid,
        mapIndex: totd.id,
        date: totd.date,
        authorTime: '',  // Not available in simplified TOTD data
        thumbnailUrl: getMapThumbnailUrl(totd.mapId)  // Use mapId for thumbnails (Nadeo API requires UUID)
    };
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
            position: "relative",
            opacity: team.isOnline ? 1 : 0.6
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
                #{team.id}
            </div>

            {/* Online indicator */}
            <div style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: team.isOnline ? "#4ade80" : "#6b7280",
                boxShadow: team.isOnline ? "0 0 8px #4ade80" : "none"
            }} title={team.isOnline ? "Online" : "Offline"} />

            {/* Header */}
            <div style={{ padding: 12, background: "rgba(0,0,0,0.2)", textAlign: "center", borderBottom: "1px solid #334155" }}>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: "bold", color: team.color }}>{team.name}</h3>
                {team.activePlayer && (
                    <div style={{ fontSize: 13, color: "#4ade80", marginTop: 4 }}>
                        🎮 {team.activePlayer}
                    </div>
                )}
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                    {team.mapsFinished} / {team.totalMaps} maps
                </div>
                <div style={{ fontSize: 14, color: "#fbbf24", marginTop: 6, fontWeight: "bold" }}>
                    💰 £{Number(team.teamPot ?? 0).toFixed(2)}
                </div>
            </div>

            {/* Map Info */}
            <div style={{ padding: 12, flex: 1 }}>
                {team.currentMap ? (
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
                                    <span style={{ whiteSpace: "nowrap", fontSize: "1.25em" }}>#{team.currentMap.mapIndex} – {team.currentMap.date}</span>
                                </div>
                            </div>
                        </div>
                    </a>
                ) : (
                    <div style={{ aspectRatio: "16/9", background: "#0f172a", borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
                        No map data
                    </div>
                )}

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
                                    <div key={i} style={{ background: "rgba(248, 113, 113, 0.2)", border: "1px solid #f87171", borderRadius: 4, padding: "4px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, gap: 8 }}>
                                        <span style={{ color: "#f87171" }}>⚠️ {p.name}</span>
                                        <span style={{ fontFamily: "monospace", display: "flex", gap: 6, alignItems: "center" }}>
                                            {p.mapsTotal > 1 && <span style={{ color: "#fbbf24" }}>{p.mapsTotal - p.mapsRemaining}/{p.mapsTotal}</span>}
                                            {p.timeLeft > 0 && <span style={{ color: "#38bdf8" }}>⏱ {formatTime(p.timeLeft)}</span>}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: 13, opacity: 0.5, fontStyle: "italic" }}>None</div>
                        )}
                    </div>

                    {/* Waitlist */}
                    {team.penaltyWaitlist.length > 0 && (
                        <div
                            title={team.penaltyWaitlist.join("\n")}
                            style={{ marginTop: 8, padding: "4px 8px", background: "#4a1a1a", borderRadius: 4, fontSize: 12, color: "#fca5a5", textAlign: "center", cursor: "help" }}
                        >
                            +{team.penaltyWaitlist.length} in waitlist: {team.penaltyWaitlist.join(", ")}
                        </div>
                    )}

                    {/* Shield Cooldowns */}
                    {(team.shieldCooldowns.small !== null || team.shieldCooldowns.big !== null) && (
                        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6, display: "flex", gap: 8, justifyContent: "center" }}>
                            {team.shieldCooldowns.small !== null && (
                                <span>⏱️ Small: {formatTime(team.shieldCooldowns.small)}</span>
                            )}
                            {team.shieldCooldowns.big !== null && (
                                <span>⏱️ Big: {formatTime(team.shieldCooldowns.big)}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function LeaderboardPage() {
    const [teams, setTeams] = useState<TeamStatus[]>([]);
    const [feed, setFeed] = useState<FeedEvent[]>([]);
    const [timeLeftMs, setTimeLeftMs] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [penaltyHistory, setPenaltyHistory] = useState<{
        penalties: { penaltyId: number; penaltyName: string; team1: number; team2: number; team3: number; team4: number; total: number }[];
        totals: { team1: number; team2: number; team3: number; team4: number; total: number };
    }>({
        penalties: [
            { penaltyId: 1, penaltyName: 'Russian Roulette', team1: 0, team2: 0, team3: 0, team4: 0, total: 0 },
            { penaltyId: 2, penaltyName: 'Camera Shuffle', team1: 0, team2: 0, team3: 0, team4: 0, total: 0 },
            { penaltyId: 3, penaltyName: 'Cursed Controller', team1: 0, team2: 0, team3: 0, team4: 0, total: 0 },
            { penaltyId: 4, penaltyName: 'Clean Run Only', team1: 0, team2: 0, team3: 0, team4: 0, total: 0 },
            { penaltyId: 5, penaltyName: 'Pedal to the Metal', team1: 0, team2: 0, team3: 0, team4: 0, total: 0 },
            { penaltyId: 6, penaltyName: 'Tunnel Vision', team1: 0, team2: 0, team3: 0, team4: 0, total: 0 },
            { penaltyId: 7, penaltyName: 'Player Switch', team1: 0, team2: 0, team3: 0, team4: 0, total: 0 },
            { penaltyId: 8, penaltyName: "Can't Turn Right", team1: 0, team2: 0, team3: 0, team4: 0, total: 0 },
            { penaltyId: 9, penaltyName: 'AT or Bust', team1: 0, team2: 0, team3: 0, team4: 0, total: 0 },
            { penaltyId: 10, penaltyName: 'Back to the Future', team1: 0, team2: 0, team3: 0, team4: 0, total: 0 },
        ],
        totals: { team1: 0, team2: 0, team3: 0, team4: 0, total: 0 }
    });

    // Fetch live data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Single API call for all leaderboard data (P1 optimization)
                const res = await fetch('/api/leaderboard-data');
                if (!res.ok) throw new Error('Failed to fetch leaderboard data');
                const data = await res.json();

                // Transform team data
                const transformedTeams: TeamStatus[] = data.teams.map((t: any) => {
                    const teamId = t.id;
                    const mapsCompleted = t.mapsCompleted || 0;

                    // Get current map info from API - ONLY if we have real data from plugin
                    // If currentMapId is NULL or no active player, show "No map data"
                    let mapInfo = null;
                    if (t.currentMapId && t.currentMapName && t.activePlayer) {
                        // Use data from API (synced from plugin)
                        const totdData = getTotdInfo(t.currentMapId);
                        mapInfo = {
                            name: t.currentMapName,
                            authorName: t.currentMapAuthor || totdData?.authorName || 'Unknown',
                            mapUid: totdData?.mapUid || '',
                            mapIndex: t.currentMapId,
                            date: totdData?.date || '',
                            authorTime: totdData?.authorTime || '',
                            thumbnailUrl: totdData?.thumbnailUrl || ''
                        };
                    }
                    // No fallback - if no currentMapId from plugin, show "No map data"

                    return {
                        id: teamId,
                        name: t.name || `Team ${teamId}`,
                        color: t.color || "#888",
                        mapsFinished: mapsCompleted,
                        totalMaps: TOTAL_MAPS,
                        activePlayer: t.activePlayer,
                        currentMap: mapInfo,
                        activeShield: t.shield?.active ? {
                            type: t.shield.type as "small" | "big",
                            timeLeft: Math.floor((t.shield.remaining_ms || 0) / 1000)
                        } : null,
                        shieldCooldowns: {
                            small: t.shield?.small_cooldown_ms ? Math.floor(t.shield.small_cooldown_ms / 1000) : null,
                            big: t.shield?.big_cooldown_ms ? Math.floor(t.shield.big_cooldown_ms / 1000) : null
                        },
                        activePenalties: (t.penalties?.active || [])
                            .slice(0, 2)
                            .map((p: any) => ({
                                name: p.name,
                                timeLeft: p.timer_remaining_ms ? Math.floor(p.timer_remaining_ms / 1000) : 0,
                                mapsRemaining: p.maps_remaining ?? 0,
                                mapsTotal: p.maps_total ?? 0
                            })),
                        penaltyWaitlist: (t.penalties?.waitlist || []).slice(0, 2).map((p: any) => p.name),
                        isOnline: t.isOnline,
                        teamPot: t.potAmount || 0
                    };
                });

                // Fetch event log for live feed (fallback to donations if not available)
                let feedEvents: FeedEvent[] = [];
                try {
                    const eventLogRes = await fetch('/api/event-log?limit=15');
                    if (eventLogRes.ok) {
                        const eventLogData = await eventLogRes.json();
                        if (eventLogData.events?.length > 0) {
                            feedEvents = eventLogData.events.map((e: any) => ({
                                id: e.id,
                                type: e.event_type as FeedEvent['type'],
                                message: e.message,
                                teamId: e.team_id,
                                timestamp: new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                            }));
                        }
                    }
                } catch { /* ignore */ }

                // If no event log entries, fallback to donations
                if (feedEvents.length === 0) {
                    const donationsRes = await fetch('/api/donations');
                    const donationsData = donationsRes.ok ? await donationsRes.json() : { recentDonations: [] };
                    feedEvents = (donationsData.recentDonations || []).slice(0, 10).map((d: any) => ({
                        id: d.donation_id,
                        type: "donation" as const,
                        message: `${d.donor_name || 'Anonymous'} donated £${d.amount} → ${d.penalty_name || 'Donation'}`,
                        teamId: d.penalty_team,
                        timestamp: new Date(d.processed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    }));
                }

                setTeams(transformedTeams);
                setFeed(feedEvents);
                setLoading(false);
                setError(null);
            } catch (err) {
                console.error('Leaderboard fetch error:', err);
                setError('Failed to load live data');
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, []);

    // Countdown Effect
    useEffect(() => {
        const targetDate = new Date("2025-12-29T17:00:00+01:00").getTime();

        const updateTimer = () => {
            const now = new Date().getTime();
            const diff = targetDate - now;
            setTimeLeftMs(Math.max(0, diff));
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
    }, []);

    // Real-time shield countdown (updates every second)
    useEffect(() => {
        const timer = setInterval(() => {
            setTeams(prev => prev.map(team => {
                if (team.activeShield && team.activeShield.timeLeft > 0) {
                    return {
                        ...team,
                        activeShield: {
                            ...team.activeShield,
                            timeLeft: Math.max(0, team.activeShield.timeLeft - 1)
                        }
                    };
                }
                return team;
            }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Real-time penalty countdown (updates every second)
    useEffect(() => {
        const timer = setInterval(() => {
            setTeams(prev => prev.map(team => {
                const updatedPenalties = team.activePenalties.map(p => ({
                    ...p,
                    timeLeft: p.timeLeft > 0 ? Math.max(0, p.timeLeft - 1) : p.timeLeft
                }));
                return {
                    ...team,
                    activePenalties: updatedPenalties
                };
            }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch penalty history (every 30 seconds)
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch('/api/penalty-history');
                if (res.ok) {
                    const data = await res.json();
                    setPenaltyHistory(data);
                }
            } catch (e) { /* ignore */ }
        };
        fetchHistory();
        const interval = setInterval(fetchHistory, 30000);
        return () => clearInterval(interval);
    }, []);

    // Sort teams by mapsFinished (descending)
    const sortedTeams = [...teams].sort((a, b) => b.mapsFinished - a.mapsFinished);

    if (loading) {
        return (
            <div style={{ background: "#0f172a", minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🏁</div>
                    <p>Loading live data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ background: "#0f172a", minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                    <p style={{ color: "#f87171" }}>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: 16, padding: "8px 16px", background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" }}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: "#0f172a", minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
            <main style={{ padding: "24px", maxWidth: 1600, margin: "0 auto" }}>
                {/* Dashboard Header */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    marginBottom: 24,
                    gap: 16
                }}>
                    <div>
                        <h1 style={{ fontSize: 36, fontWeight: "bold", background: "linear-gradient(to right, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
                            LIVE LEADERBOARD
                        </h1>
                        <p style={{ opacity: 0.6, marginTop: 4, fontSize: 14 }}>TOTD Flashback Event • Real-time tracking</p>
                    </div>
                    {/* Timer centered in header */}
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, opacity: 0.7, marginBottom: 2 }}>Time Remaining</div>
                        <div style={{ fontSize: 32, fontFamily: "monospace", fontWeight: "bold", color: "#fff", lineHeight: 1 }}>
                            {formatCountdown(timeLeftMs)}
                        </div>
                    </div>
                    <div></div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
                    {/* LEFT COLUMN: Teams Grid */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                            {sortedTeams.map((team, index) => (
                                <TeamCard key={team.id} team={{ ...team, id: index + 1 }} />
                            ))}
                        </div>

                        {/* Progress Timeline */}
                        <div style={{ background: "#1e293b", padding: "16px 16px 40px 16px", borderRadius: 12, border: "1px solid #334155" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <h3 style={{ margin: 0, fontSize: 16 }}>Event Timeline</h3>
                                <div style={{ fontSize: 11, opacity: 0.6 }}>Progress towards July 2020</div>
                            </div>

                            <div style={{ position: "relative", height: 32, background: "#0f172a", borderRadius: 20, display: "flex", alignItems: "center", padding: "0 10px" }}>
                                <div style={{ position: "absolute", left: 10, right: 10, height: 4, background: "#334155", borderRadius: 2 }}></div>
                                <div style={{ position: "absolute", left: "2%", top: 34, fontSize: 10, opacity: 0.5 }}>Dec 2025</div>
                                <div style={{ position: "absolute", right: "2%", top: 34, fontSize: 10, opacity: 0.5 }}>July 2020</div>

                                {sortedTeams.map((team, i) => {
                                    const percent = (team.mapsFinished / team.totalMaps) * 100;
                                    const isTop = i % 2 === 0;
                                    const arrowHeight = (i < 2) ? 35 : 12;

                                    return (
                                        <div key={team.id} style={{
                                            position: "absolute",
                                            left: `${percent}%`,
                                            top: "50%",
                                            transform: "translate(-50%, -50%)",
                                            zIndex: 5
                                        }}>
                                            <div style={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: "50%",
                                                background: team.color,
                                                border: "2px solid #fff",
                                                boxShadow: "0 0 10px " + team.color
                                            }} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Event Feed */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Live Feed */}
                        <div style={{
                            background: "#1e293b",
                            borderRadius: 12,
                            border: "1px solid #334155",
                            padding: 16,
                            height: "fit-content",
                            maxHeight: "400px"
                        }}>
                            <h3 style={{ margin: "0 0 16px 0", fontSize: 18, borderBottom: "1px solid #334155", paddingBottom: 12 }}>Live Feed</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "300px", overflowY: "auto" }}>
                                {feed.length > 0 ? feed.slice(0, 5).map(event => (
                                    <div key={event.id} style={{
                                        paddingRight: 8,
                                        borderLeft: `3px solid ${event.teamId ? TEAM_COLORS[event.teamId]?.color : "#fff"}`,
                                        paddingLeft: 12
                                    }}>
                                        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 2 }}>{event.timestamp}</div>
                                        <div style={{ fontSize: 13, lineHeight: 1.4 }}>{event.message}</div>
                                    </div>
                                )) : (
                                    <div style={{ opacity: 0.5, textAlign: "center", padding: 20 }}>No recent events</div>
                                )}
                            </div>
                        </div>

                        {/* Penalty History Table */}
                        {penaltyHistory && (
                            <div style={{
                                background: "#1e293b",
                                borderRadius: 12,
                                border: "1px solid #334155",
                                padding: 16,
                            }}>
                                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, borderBottom: "1px solid #334155", paddingBottom: 8 }}>
                                    Penalties Completed ({penaltyHistory.totals.total})
                                </h3>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid #334155" }}>
                                            <th style={{ textAlign: "left", padding: "4px 2px", opacity: 0.7 }}>Penalty</th>
                                            <th style={{ textAlign: "center", padding: "4px 2px", color: TEAM_COLORS[1]?.color, width: 30 }}>T1</th>
                                            <th style={{ textAlign: "center", padding: "4px 2px", color: TEAM_COLORS[2]?.color, width: 30 }}>T2</th>
                                            <th style={{ textAlign: "center", padding: "4px 2px", color: TEAM_COLORS[3]?.color, width: 30 }}>T3</th>
                                            <th style={{ textAlign: "center", padding: "4px 2px", color: TEAM_COLORS[4]?.color, width: 30 }}>T4</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {penaltyHistory.penalties.map(p => (
                                            <tr key={p.penaltyId} style={{ borderBottom: "1px solid #1e293b" }}>
                                                <td style={{ padding: "3px 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>{p.penaltyName}</td>
                                                <td style={{ textAlign: "center", padding: "3px 2px", fontFamily: "monospace" }}>{p.team1 || "—"}</td>
                                                <td style={{ textAlign: "center", padding: "3px 2px", fontFamily: "monospace" }}>{p.team2 || "—"}</td>
                                                <td style={{ textAlign: "center", padding: "3px 2px", fontFamily: "monospace" }}>{p.team3 || "—"}</td>
                                                <td style={{ textAlign: "center", padding: "3px 2px", fontFamily: "monospace" }}>{p.team4 || "—"}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ fontWeight: "bold", borderTop: "1px solid #475569" }}>
                                            <td style={{ padding: "4px 2px" }}>Total</td>
                                            <td style={{ textAlign: "center", padding: "4px 2px", color: TEAM_COLORS[1]?.color }}>{penaltyHistory.totals.team1}</td>
                                            <td style={{ textAlign: "center", padding: "4px 2px", color: TEAM_COLORS[2]?.color }}>{penaltyHistory.totals.team2}</td>
                                            <td style={{ textAlign: "center", padding: "4px 2px", color: TEAM_COLORS[3]?.color }}>{penaltyHistory.totals.team3}</td>
                                            <td style={{ textAlign: "center", padding: "4px 2px", color: TEAM_COLORS[4]?.color }}>{penaltyHistory.totals.team4}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
