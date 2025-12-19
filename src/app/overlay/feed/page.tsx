"use client";

import { useEffect, useState, useRef } from "react";

// ============ TYPES ============
interface FeedEvent {
    id: string;
    type: "donation" | "penalty_active" | "shield" | "player_change" | "month_complete" | "pot_milestone" | "team_overtake" | "top_donor";
    teamId: number | null;
    message: string;
    subtext?: string;
    timestamp: number;
}

interface TeamStatus {
    id: number;
    name: string;
    color: string;
    activePlayer: string | null;
    mapsCompleted: number;
}

interface Donation {
    donation_id: string;
    amount: number;
    donor_name: string;
    penalty_name: string;
    penalty_team: number;
    pot_team: number | null;
    is_pot_random: boolean;
}

// ============ CONSTANTS ============
const TEAM_COLORS: Record<number, string> = {
    1: "#ef4444",
    2: "#3b82f6", 
    3: "#22c55e",
    4: "#f59e0b",
};

const EVENT_ICONS: Record<string, string> = {
    donation: "💰",
    penalty_active: "⚡",
    shield: "🛡️",
    player_change: "🔄",
    month_complete: "🎉",
    pot_milestone: "💎",
    team_overtake: "🏆",
    top_donor: "👑",
};

const MONTH_THRESHOLDS = [
    { maps: 31, name: "January 2020" },
    { maps: 60, name: "February 2020" },
    { maps: 91, name: "March 2020" },
    // ... continues for each month
];

// ============ COMPONENT ============
export default function OverlayFeedPage() {
    const [events, setEvents] = useState<FeedEvent[]>([]);
    
    // Tracking refs for change detection
    const seenDonations = useRef<Set<string>>(new Set());
    const lastTeamStatus = useRef<Map<number, { player: string | null; maps: number }>>(new Map());
    const lastPotMilestone = useRef<number>(0);
    const lastTopDonor = useRef<string>("");
    const lastMonthCompleted = useRef<Map<number, number>>(new Map());
    const teamLeader = useRef<{ teamId: number; lead: number } | null>(null);

    const addEvent = (event: Omit<FeedEvent, "id" | "timestamp">) => {
        const newEvent: FeedEvent = {
            ...event,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        };
        setEvents(prev => [newEvent, ...prev].slice(0, 10)); // Keep max 10 in memory
    };

    // Poll data sources
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch donations
                const donRes = await fetch("/api/donations");
                if (donRes.ok) {
                    const donData = await donRes.json();
                    const donations: Donation[] = donData.recentDonations || [];
                    const totalAmount = donData.totalAmount || 0;

                    // Check new donations
                    for (const don of donations) {
                        if (!seenDonations.current.has(don.donation_id)) {
                            seenDonations.current.add(don.donation_id);
                            
                            // New donation event
                            const potText = don.pot_team ? `Pot → T${don.pot_team}` : "Pot split";
                            addEvent({
                                type: "donation",
                                teamId: don.penalty_team,
                                message: `£${don.amount.toFixed(0)} from ${don.donor_name}`,
                                subtext: `${don.penalty_name} → T${don.penalty_team} | ${potText}`,
                            });
                        }
                    }

                    // Check pot milestone (every £100)
                    const currentMilestone = Math.floor(totalAmount / 100) * 100;
                    if (currentMilestone > lastPotMilestone.current && lastPotMilestone.current > 0) {
                        addEvent({
                            type: "pot_milestone",
                            teamId: null,
                            message: `£${currentMilestone} reached!`,
                            subtext: `Goal in progress...`,
                        });
                    }
                    lastPotMilestone.current = currentMilestone;

                    // Check top donor change
                    if (donations.length > 0) {
                        // Find top donor from all donations
                        const donorTotals: Record<string, number> = {};
                        for (const d of donations) {
                            donorTotals[d.donor_name] = (donorTotals[d.donor_name] || 0) + d.amount;
                        }
                        const topDonor = Object.entries(donorTotals).sort((a, b) => b[1] - a[1])[0];
                        if (topDonor && topDonor[0] !== lastTopDonor.current && lastTopDonor.current !== "") {
                            addEvent({
                                type: "top_donor",
                                teamId: null,
                                message: `${topDonor[0]} is the top donor!`,
                                subtext: `Total: £${topDonor[1].toFixed(0)}`,
                            });
                        }
                        if (topDonor) lastTopDonor.current = topDonor[0];
                    }
                }

                // Fetch live status for teams
                const statusRes = await fetch("/api/live-status");
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    const teams: TeamStatus[] = statusData.teams || [];

                    for (const team of teams) {
                        const prev = lastTeamStatus.current.get(team.id);

                        if (prev) {
                            // Check player change
                            if (prev.player !== team.activePlayer && team.activePlayer) {
                                addEvent({
                                    type: "player_change",
                                    teamId: team.id,
                                    message: `${team.name}: ${team.activePlayer}`,
                                    subtext: prev.player ? `Replaces ${prev.player}` : "Takes over",
                                });
                            }

                            // Check monthly milestone (simplified - every 30 maps)
                            const prevMonth = Math.floor(prev.maps / 30);
                            const currMonth = Math.floor(team.mapsCompleted / 30);
                            const lastCompleted = lastMonthCompleted.current.get(team.id) || 0;
                            if (currMonth > prevMonth && currMonth > lastCompleted) {
                                lastMonthCompleted.current.set(team.id, currMonth);
                                addEvent({
                                    type: "month_complete",
                                    teamId: team.id,
                                    message: `${team.name} finished a month!`,
                                    subtext: `${team.mapsCompleted} maps completed`,
                                });
                            }
                        }

                        lastTeamStatus.current.set(team.id, {
                            player: team.activePlayer,
                            maps: team.mapsCompleted,
                        });
                    }

                    // Check team overtake (3+ maps lead)
                    if (teams.length >= 2) {
                        const sorted = [...teams].sort((a, b) => b.mapsCompleted - a.mapsCompleted);
                        const leader = sorted[0];
                        const second = sorted[1];
                        const lead = leader.mapsCompleted - second.mapsCompleted;

                        if (lead >= 3) {
                            const prevLeader = teamLeader.current;
                            if (!prevLeader || prevLeader.teamId !== leader.id || lead > prevLeader.lead + 2) {
                                teamLeader.current = { teamId: leader.id, lead };
                                if (prevLeader && prevLeader.teamId !== leader.id) {
                                    addEvent({
                                        type: "team_overtake",
                                        teamId: leader.id,
                                        message: `${leader.name} takes the lead!`,
                                        subtext: `+${lead} maps ahead`,
                                    });
                                }
                            }
                        }
                    }
                }

                // Fetch event log for penalty/shield events
                const logRes = await fetch("/api/event-log?limit=10");
                if (logRes.ok) {
                    const logData = await logRes.json();
                    const logEvents = logData.events || [];
                    
                    for (const ev of logEvents) {
                        const evId = `log-${ev.id}`;
                        if (!seenDonations.current.has(evId)) {
                            seenDonations.current.add(evId);
                            
                            if (ev.event_type === "penalty_applied") {
                                addEvent({
                                    type: "penalty_active",
                                    teamId: ev.team_id,
                                    message: ev.message,
                                });
                            } else if (ev.event_type === "shield_activated") {
                                addEvent({
                                    type: "shield",
                                    teamId: ev.team_id,
                                    message: ev.message,
                                });
                            }
                        }
                    }
                }

            } catch (err) {
                console.error("Feed fetch error:", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    // Auto-remove old events (after 30 seconds)
    useEffect(() => {
        const cleanup = setInterval(() => {
            const now = Date.now();
            setEvents(prev => prev.filter(e => now - e.timestamp < 30000));
        }, 1000);
        return () => clearInterval(cleanup);
    }, []);

    // Only show 4 most recent
    const visibleEvents = events.slice(0, 4);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: 8,
            fontFamily: "'Segoe UI', Roboto, sans-serif",
            background: "transparent",
            width: 320,
        }}>
            {visibleEvents.map((event) => {
                const teamColor = event.teamId ? TEAM_COLORS[event.teamId] || "#888" : "#a855f7";
                const icon = EVENT_ICONS[event.type] || "📢";
                const age = Date.now() - event.timestamp;
                const opacity = Math.max(0.4, 1 - (age / 30000) * 0.6);

                return (
                    <div
                        key={event.id}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 10px",
                            background: "rgba(0,0,0,0.85)",
                            borderRadius: 6,
                            borderLeft: `3px solid ${teamColor}`,
                            opacity,
                            transition: "opacity 0.5s",
                        }}
                    >
                        {/* Icon */}
                        <div style={{ fontSize: 18 }}>{icon}</div>

                        {/* Content */}
                        <div style={{ flex: 1, overflow: "hidden" }}>
                            <div style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#fff",
                                textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}>
                                {event.message}
                            </div>
                            {event.subtext && (
                                <div style={{
                                    fontSize: 10,
                                    color: teamColor,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}>
                                    {event.subtext}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
