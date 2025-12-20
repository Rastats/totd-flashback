"use client";
// src/app/admin/page.tsx

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { PlayerApplication, CasterApplication, ApplicationStatus, TeamAssignment } from "@/lib/types";
import RequireAuth from "@/components/RequireAuth";
import EventControlPanel from "@/components/EventControlPanel";

const inputStyle = {
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #444",
    background: "#1a1a2e",
    color: "#fff",
    fontSize: 13,
};

const buttonStyle = {
    padding: "6px 12px",
    borderRadius: 4,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500 as const,
};

export default function AdminPage() {
    const [players, setPlayers] = useState<PlayerApplication[]>([]);
    const [casters, setCasters] = useState<CasterApplication[]>([]);
    const [pots, setPots] = useState<{ team_number: number, amount: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<"players" | "casters" | "coverage" | "pots" | "event">("players");
    const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
    const [selectedPlayer, setSelectedPlayer] = useState<PlayerApplication | null>(null);
    const [selectedCaster, setSelectedCaster] = useState<CasterApplication | null>(null);
    const [pendingTeamAssignment, setPendingTeamAssignment] = useState<Record<string, TeamAssignment>>({});
    const [potAdjustments, setPotAdjustments] = useState<Record<number, string>>({});

    const fetchData = useCallback(async () => {
        try {
            const [playersRes, castersRes, potsRes] = await Promise.all([
                fetch("/api/players"),
                fetch("/api/casters"),
                fetch("/api/admin/pots"),
            ]);

            if (playersRes.ok) setPlayers(await playersRes.json());
            if (castersRes.ok) setCasters(await castersRes.json());
            if (potsRes.ok) setPots(await potsRes.json());
        } catch (err) {
            setError("Failed to fetch data");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updatePlayerStatus = async (id: string, status: ApplicationStatus) => {
        try {
            const res = await fetch(`/api/admin/players/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                fetchData();
                setSelectedPlayer(null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const updatePlayerTeam = async (id: string, teamAssignment: TeamAssignment) => {
        try {
            const res = await fetch(`/api/admin/players/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamAssignment }),
            });
            if (res.ok) {
                fetchData();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const updatePlayerCaptain = async (id: string, isCaptain: boolean) => {
        try {
            const res = await fetch(`/api/admin/players/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isCaptain }),
            });
            if (res.ok) {
                fetchData();
            } else {
                const err = await res.text();
                console.error("Failed to update captain:", err);
                alert(`Error: ${err}`);
            }
        } catch (err) {
            console.error(err);
            alert("Network error updating captain");
        }
    };

    const updateCasterStatus = async (id: string, status: ApplicationStatus) => {
        try {
            const res = await fetch(`/api/admin/casters/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                fetchData();
                setSelectedCaster(null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // ================== EDIT AVAILABILITY MODAL ==================
    const [editAvailPlayer, setEditAvailPlayer] = useState<PlayerApplication | null>(null);
    const [tempAvailability, setTempAvailability] = useState<any[]>([]);

    const openAvailabilityEditor = (player: PlayerApplication) => {
        setEditAvailPlayer(player);
        setTempAvailability([...player.availability]); // clone
    };

    const toggleSlot = (date: string, hour: number) => {
        // Find if slot exists covering this hour
        // Simplification: We assume slots are 1h blocks for the editor grid to keep it simple?
        // Or we stick to the backend format: startHour -> endHour.
        // If we want a simple grid clicker:
        // Click -> Create 1h slot 'ok' -> 'preferred' -> 'delete'.

        // Let's implement this logic:
        // Check if there is a slot on this date that contains this hour.
        const existingSlotIndex = tempAvailability.findIndex(s =>
            s.date === date && hour >= s.startHour && hour < s.endHour
        );

        if (existingSlotIndex >= 0) {
            // Found a slot. 
            // If it's 1h long, cycle preference. If >1h, maybe split it? 
            // To keep simple: The editor visualizes 1h blocks. 
            // If we click a block covered by a long slot, we might need to split it if we change preference?
            // COMPLEXITY: Handling variable length slots in a simple grid clicker is hard.
            // ALTERNATIVE: Just visualize existing slots and allow adding/removing standard 1h blocks?
            // BETTER: If a slot covers multiple hours, we treat them as individual hours for the sake of editing logic?
            // Actually, let's just use the `preference` cycle: None -> OK -> Preferred -> None.

            const slot = tempAvailability[existingSlotIndex];

            // If slot is exactly this hour (1h duration)
            if (slot.endHour === slot.startHour + 1) {
                if (slot.preference === 'ok') {
                    // Change to preferred
                    const newSlots = [...tempAvailability];
                    newSlots[existingSlotIndex] = { ...slot, preference: 'preferred' };
                    setTempAvailability(newSlots);
                } else {
                    // Remove (None)
                    const newSlots = [...tempAvailability];
                    newSlots.splice(existingSlotIndex, 1);
                    setTempAvailability(newSlots);
                }
            } else {
                // It's a multi-hour slot. We are clicking one hour inside it.
                // We should probably convert everything to 1h slots for the editor then merge back? 
                // Too complex for "quick edit".
                // Let's Just delete the whole slot if clicked? No.

                // FORCE STRATEGY: We assume the admin wants to granularly control.
                // We split the large slot into pieces excluding the clicked hour, and add the modified hour.
                // This is getting complicated to code inline.

                // VISUAL SHORTCUT: Just cycle preference of the WHOLE slot if clicked? 
                // Or deleting it?
                // Let's go with: Click existing -> Delete. 
                // Click empty -> Add 1h 'ok'.
                // Click 'ok' (1h) -> 'preferred'.

                // Implementation:
                // 1. Remove the existing slot (whatever length).
                // 2. If it was providing coverage for other hours, we need to re-add them.
                const slot = tempAvailability[existingSlotIndex];
                const newSlots = tempAvailability.filter((_, i) => i !== existingSlotIndex);

                // Re-add parts before and after if needed
                if (hour > slot.startHour) {
                    newSlots.push({ ...slot, endHour: hour });
                }
                if (hour + 1 < slot.endHour) {
                    newSlots.push({ ...slot, startHour: hour + 1 });
                }

                // Now we effectively deleted the hour 'hour'.
                // If the user wanted to upgrade preference, we add it back as preferred (if it was ok)
                // If it was preferred, we just deleted it (cycle to None).
                // If it was OK (but part of a larger block), we just deleted it.
                // To support cycle: OK -> PREF -> NONE

                if (slot.preference === 'ok') {
                    newSlots.push({
                        date: date,
                        startHour: hour,
                        endHour: hour + 1,
                        preference: 'preferred',
                        id: Math.random().toString()
                    });
                }

                setTempAvailability(newSlots);
            }
        } else {
            // Empty -> Create 'ok'
            setTempAvailability([...tempAvailability, {
                date: date,
                startHour: hour,
                endHour: hour + 1,
                preference: 'ok',
                id: Math.random().toString()
            }]);
        }
    };

    const saveAvailability = async () => {
        if (!editAvailPlayer) return;

        // ===== DEDUPLICATE AND MERGE SLOTS =====
        // Step 1: Remove exact duplicates and normalize
        const slotMap = new Map<string, { date: string; startHour: number; endHour: number; preference: string }>();

        for (const slot of tempAvailability) {
            // Create unique key for each hour within the slot
            for (let h = slot.startHour; h < slot.endHour; h++) {
                const key = `${slot.date}-${h}`;
                const existing = slotMap.get(key);
                // Keep preferred over ok
                if (!existing || (existing.preference === 'ok' && slot.preference === 'preferred')) {
                    slotMap.set(key, {
                        date: slot.date,
                        startHour: h,
                        endHour: h + 1,
                        preference: slot.preference
                    });
                }
            }
        }

        // Step 2: Convert back to array and merge contiguous slots with same preference
        const hourSlots = Array.from(slotMap.values());
        hourSlots.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startHour - b.startHour;
        });

        const mergedSlots: any[] = [];
        for (const slot of hourSlots) {
            const last = mergedSlots[mergedSlots.length - 1];
            if (last && last.date === slot.date && last.endHour === slot.startHour && last.preference === slot.preference) {
                // Extend the previous slot
                last.endHour = slot.endHour;
            } else {
                // Start a new slot
                mergedSlots.push({ ...slot, id: Math.random().toString() });
            }
        }

        console.log(`[Availability] Reduced ${tempAvailability.length} slots to ${mergedSlots.length} after dedup/merge`);

        try {
            const res = await fetch(`/api/admin/players/${editAvailPlayer.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ availability: mergedSlots }),
            });
            if (res.ok) {
                fetchData();
                setEditAvailPlayer(null);
            } else {
                alert("Failed to save availability");
            }
        } catch (err) {
            console.error(err);
            alert("Network error");
        }
    };

    // ==============================================================

    const filteredPlayers = players.filter(
        (p) => statusFilter === "all" || p.status === statusFilter
    );

    const filteredCasters = casters.filter(
        (c) => statusFilter === "all" || c.status === statusFilter
    );

    const getStatusColor = (status: ApplicationStatus) => {
        switch (status) {
            case "pending": return "#facc15";
            case "approved": return "#4ade80";
            case "rejected": return "#f87171";
        }
    };

    const getTeamLabel = (team: TeamAssignment) => {
        if (!team) return "—";
        if (team === "joker") return "🃏 Joker";
        return `Team ${team.replace("team", "")}`;
    };

    // Get player hours as indices (for team suggestion)
    const getPlayerHourIndices = (player: PlayerApplication): number[] => {
        const indices: number[] = [];
        player.availability.forEach(slot => {
            const dayIndex = ["2025-12-21", "2025-12-22", "2025-12-23", "2025-12-24"].indexOf(slot.date);
            if (dayIndex === -1) return;

            for (let h = slot.startHour; h < slot.endHour; h++) {
                let hourIndex: number;
                if (dayIndex === 0) {
                    hourIndex = h - 21;
                } else {
                    hourIndex = 3 + ((dayIndex - 1) * 24) + h;
                }
                if (hourIndex >= 0 && hourIndex < 69) {
                    indices.push(hourIndex);
                }
            }
        });
        return indices;
    };

    // Suggest best team for a player based on coverage gaps
    const getSuggestedTeam = (player: PlayerApplication): { team: TeamAssignment; gapsFilled: number; score: number }[] => {
        const coverage = getCoverage();
        const playerHours = getPlayerHourIndices(player);
        const teams = ["team1", "team2", "team3", "team4"] as const;

        const suggestions = teams.map(team => {
            let gapsFilled = 0;
            let valuableHours = 0;

            playerHours.forEach(hour => {
                const currentCoverage = coverage[team][hour].count;
                if (currentCoverage === 0) {
                    gapsFilled++; // Filling a gap = very valuable
                    valuableHours += 3;
                } else if (currentCoverage === 1) {
                    valuableHours += 1; // Adding redundancy = somewhat valuable
                }
            });

            return { team: team as TeamAssignment, gapsFilled, score: valuableHours };
        });

        // Sort by score (descending)
        return suggestions.sort((a, b) => b.score - a.score);
    };

    // Find matching players based on wanted teammates (case-insensitive search)
    const findMatchingPlayers = (player: PlayerApplication): PlayerApplication[] => {
        if (!player.wantedTeammates) return [];

        const wantedNames = player.wantedTeammates.toLowerCase().split(/[,;]+/).map(n => n.trim()).filter(n => n);

        return players.filter(p => {
            if (p.id === player.id) return false;
            const pName = (p.trackmaniaName || p.discordUsername || "").toLowerCase();
            const pDiscord = p.discordUsername.toLowerCase();

            return wantedNames.some(wanted =>
                pName.includes(wanted) || pDiscord.includes(wanted) || wanted.includes(pName) || wanted.includes(pDiscord)
            );
        });
    };

    // Bulk approve and assign to team
    const bulkApproveAndAssign = async (playerIds: string[], team: TeamAssignment) => {
        for (const id of playerIds) {
            await updatePlayerStatus(id, "approved");
            await updatePlayerTeam(id, team);
        }
        fetchData();
    };

    // Coverage calculation
    const getCoverage = () => {
        const approvedPlayers = players.filter(p => p.status === "approved");
        const teams = ["team1", "team2", "team3", "team4", "joker"] as const;

        const coverage: Record<string, { count: number, names: string[] }[]> = {};
        [...teams].forEach(t => {
            coverage[t] = Array.from({ length: 69 }, () => ({ count: 0, names: [] }));
        });

        approvedPlayers.forEach(player => {
            const team = player.teamAssignment;
            if (!team) return;

            player.availability.forEach(slot => {
                const dayIndex = ["2025-12-21", "2025-12-22", "2025-12-23", "2025-12-24"].indexOf(slot.date);
                if (dayIndex === -1) return;

                for (let h = slot.startHour; h < slot.endHour; h++) {
                    let hourIndex: number;
                    if (dayIndex === 0) {
                        // Dec 21: only hours 21-23 are valid (indices 0-2)
                        hourIndex = h - 21;
                    } else {
                        // Dec 22: 3 + h, Dec 23: 27 + h, Dec 24: 51 + h
                        hourIndex = 3 + ((dayIndex - 1) * 24) + h;
                    }
                    if (hourIndex >= 0 && hourIndex < 69 && coverage[team]) {
                        coverage[team][hourIndex].count++;
                        coverage[team][hourIndex].names.push(player.trackmaniaName || player.discordUsername);
                    }
                }
            });
        });

        return coverage;
    };

    // Caster coverage calculation
    const getCasterCoverage = () => {
        const approvedCasters = casters.filter(c => c.status === "approved");
        const hours = Array.from({ length: 69 }, () => ({ count: 0, names: [] as string[] }));

        approvedCasters.forEach(caster => {
            caster.availability.forEach(slot => {
                const dayIndex = ["2025-12-21", "2025-12-22", "2025-12-23", "2025-12-24"].indexOf(slot.date);
                if (dayIndex === -1) return;

                for (let h = slot.startHour; h < slot.endHour; h++) {
                    let hourIndex: number;
                    if (dayIndex === 0) {
                        hourIndex = h - 21;
                    } else {
                        hourIndex = 3 + ((dayIndex - 1) * 24) + h;
                    }
                    if (hourIndex >= 0 && hourIndex < 69) {
                        hours[hourIndex].count++;
                        hours[hourIndex].names.push(caster.displayName || caster.discordUsername);
                    }
                }
            });
        });

        return hours;
    };

    if (loading) {
        return (
            <RequireAuth requireAdmin>
                <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
                    <p>Loading...</p>
                </main>
            </RequireAuth>
        );
    }

    return (
        <RequireAuth requireAdmin>
            <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
                <Link href="/" style={{ opacity: 0.7, marginBottom: 16, display: "inline-block" }}>← Back to Home</Link>

                <h1 style={{ fontSize: 32, marginBottom: 8 }}>Admin Dashboard</h1>
                <p style={{ opacity: 0.7, marginBottom: 24 }}>
                    {players.length} players • {casters.length} casters •
                    {players.filter(p => p.status === "pending").length + casters.filter(c => c.status === "pending").length} pending
                </p>

                {error && (
                    <div style={{ padding: 12, background: "#4a1a1a", borderRadius: 6, marginBottom: 16, color: "#f87171" }}>
                        {error}
                    </div>
                )}

                <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                    {(["players", "casters", "coverage", "pots", "event"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                ...buttonStyle,
                                background: activeTab === tab ? "#4a5568" : "#2a2a3a",
                                color: "#fff",
                            }}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Filters */}
                {activeTab !== "coverage" && (
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ marginRight: 8 }}>Status:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "all")}
                            style={inputStyle}
                        >
                            <option value="all">All</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                )}

                {/* Players Tab */}
                {activeTab === "players" && (
                    <div style={{ display: "grid", gap: 16 }}>
                        {filteredPlayers.length === 0 && <p style={{ opacity: 0.7 }}>No players found.</p>}
                        {filteredPlayers.map((player) => (
                            <div
                                key={player.id}
                                style={{
                                    padding: 16,
                                    background: "#12121a",
                                    borderRadius: 8,
                                    border: selectedPlayer?.id === player.id ? "2px solid #60a5fa" : "1px solid #2a2a3a",
                                    cursor: "pointer",
                                }}
                                onClick={() => setSelectedPlayer(selectedPlayer?.id === player.id ? null : player)}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <div>
                                        <strong style={{ fontSize: 16 }}>{player.trackmaniaName || player.trackmaniaId.slice(0, 8)}</strong>
                                        <span style={{ marginLeft: 8, opacity: 0.7 }}>{player.discordUsername}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <span style={{
                                            padding: "4px 8px",
                                            borderRadius: 4,
                                            background: getStatusColor(player.status) + "22",
                                            color: getStatusColor(player.status),
                                            fontSize: 12,
                                        }}>
                                            {player.status}
                                        </span>
                                        <span style={{ opacity: 0.7, fontSize: 13 }}>{getTeamLabel(player.teamAssignment)}</span>
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: 16, fontSize: 13, opacity: 0.8 }}>
                                    <span>🌍 {player.timezone}</span>
                                    <span>🎮 {player.canStream ? "Streamer" : "Player"}</span>
                                    <span>💡 Fast-learn: {player.fastLearnLevel}/10</span>
                                    {player.isCaptain && <span style={{ color: "#fbbf24" }}>👑 Captain</span>}
                                    {player.willingJoker && <span>🃏 Joker OK</span>}
                                    {player.comingAsGroup && <span>👥 Group</span>}
                                </div>

                                {/* Expanded details */}
                                {selectedPlayer?.id === player.id && (
                                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #2a2a3a" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                                            <div>
                                                <strong>Languages:</strong> {player.languages.join(", ")}
                                            </div>
                                            <div>
                                                <strong>TM ID:</strong> {player.trackmaniaId}
                                            </div>
                                            {player.twitchUrl && (
                                                <div>
                                                    <strong>Twitch:</strong>{" "}
                                                    <a href={player.twitchUrl} target="_blank" rel="noreferrer" style={{ color: "#a855f7" }}>
                                                        {player.twitchUrl}
                                                    </a>
                                                </div>
                                            )}
                                            <div>
                                                <strong>Max hours/day:</strong> {player.maxHoursPerDay}h
                                            </div>
                                        </div>

                                        {player.playerNotes && (
                                            <div style={{ marginBottom: 16 }}>
                                                <strong>Player notes:</strong>
                                                <p style={{ opacity: 0.8, marginTop: 4 }}>{player.playerNotes}</p>
                                            </div>
                                        )}

                                        {player.wantedTeammates && (
                                            <div style={{ marginBottom: 16, padding: 12, background: "#2a2a4a", borderRadius: 6 }}>
                                                <strong>👥 Wants to play with:</strong>
                                                <p style={{ opacity: 0.9, marginTop: 4, color: "#a78bfa" }}>{player.wantedTeammates}</p>
                                            </div>
                                        )}

                                        <div style={{ marginBottom: 16 }}>
                                            <strong>Availability ({player.availability.length} slots):</strong>
                                            <span style={{ marginLeft: 12, fontSize: 11, opacity: 0.6 }}>
                                                🟢 Preferred • 🔵 OK
                                            </span>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                                                {player.availability.map((slot, i) => (
                                                    <span key={i} style={{
                                                        padding: "4px 8px",
                                                        background: slot.preference === "preferred" ? "#22543d" : "#2a3a4a",
                                                        borderRadius: 4,
                                                        fontSize: 12,
                                                    }}>
                                                        {slot.date.slice(5)} {slot.startHour}:00-{slot.endHour}:00
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Team Suggestion */}
                                        {player.status !== "approved" && (
                                            <div style={{ marginBottom: 16, padding: 12, background: "#1a2a3a", borderRadius: 6 }}>
                                                <strong>🎯 Select Team:</strong>
                                                <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 12 }}>
                                                    (selected: {pendingTeamAssignment[player.id]?.replace("team", "Team ") || "none"})
                                                </span>
                                                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                                    {getSuggestedTeam(player).map((s, i) => (
                                                        <button
                                                            key={s.team}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPendingTeamAssignment(prev => ({ ...prev, [player.id]: s.team }));
                                                            }}
                                                            style={{
                                                                ...buttonStyle,
                                                                padding: "6px 10px",
                                                                background: pendingTeamAssignment[player.id] === s.team ? "#22543d" : (i === 0 && !pendingTeamAssignment[player.id] ? "#1a3a2a" : "#2a2a3a"),
                                                                color: pendingTeamAssignment[player.id] === s.team ? "#4ade80" : "#fff",
                                                                border: pendingTeamAssignment[player.id] === s.team ? "2px solid #4ade80" : (i === 0 && !pendingTeamAssignment[player.id] ? "1px solid #4ade80" : "1px solid #444"),
                                                            }}
                                                        >
                                                            {s.team?.replace("team", "T")} ({s.gapsFilled} gaps)
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Matching teammates */}
                                        {(() => {
                                            const matches = findMatchingPlayers(player);
                                            if (matches.length === 0) return null;
                                            const suggestedTeam = getSuggestedTeam(player)[0]?.team;

                                            return (
                                                <div style={{ marginBottom: 16, padding: 12, background: "#2a2a4a", borderRadius: 6, border: "1px solid #a78bfa" }}>
                                                    <strong>🔗 Matching teammates found ({matches.length}):</strong>
                                                    <div style={{ marginTop: 8 }}>
                                                        {matches.map(m => (
                                                            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                                                                <span>{m.trackmaniaName || m.discordUsername} ({m.status})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {suggestedTeam && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const allIds = [player.id, ...matches.map(m => m.id)];
                                                                bulkApproveAndAssign(allIds, suggestedTeam);
                                                            }}
                                                            style={{ ...buttonStyle, marginTop: 12, background: "#22543d", color: "#4ade80", width: "100%" }}
                                                        >
                                                            ✓ Approve all {matches.length + 1} → {suggestedTeam?.replace("team", "Team ")}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Actions */}
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            {player.status !== "approved" && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        await updatePlayerStatus(player.id, "approved");
                                                        if (pendingTeamAssignment[player.id]) {
                                                            await updatePlayerTeam(player.id, pendingTeamAssignment[player.id]);
                                                        }
                                                    }}
                                                    style={{ ...buttonStyle, background: "#22543d", color: "#4ade80" }}
                                                >
                                                    ✓ Approve{pendingTeamAssignment[player.id] ? ` → ${pendingTeamAssignment[player.id]?.replace("team", "T")}` : ""}
                                                </button>
                                            )}
                                            {player.status !== "rejected" && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updatePlayerStatus(player.id, "rejected"); }}
                                                    style={{ ...buttonStyle, background: "#4a1a1a", color: "#f87171" }}
                                                >
                                                    ✕ Reject
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openAvailabilityEditor(player); }}
                                                style={{ ...buttonStyle, background: "#2a3a4a", color: "#60a5fa" }}
                                            >
                                                📅 Edit Availability
                                            </button>
                                            {player.availability.length > 10 && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        // Quick dedupe/merge without opening modal
                                                        const slotMap = new Map<string, any>();
                                                        for (const slot of player.availability) {
                                                            for (let h = slot.startHour; h < slot.endHour; h++) {
                                                                const key = `${slot.date}-${h}`;
                                                                const existing = slotMap.get(key);
                                                                if (!existing || (existing.preference === 'ok' && slot.preference === 'preferred')) {
                                                                    slotMap.set(key, { date: slot.date, startHour: h, endHour: h + 1, preference: slot.preference });
                                                                }
                                                            }
                                                        }
                                                        const hourSlots = Array.from(slotMap.values()).sort((a, b) =>
                                                            a.date !== b.date ? a.date.localeCompare(b.date) : a.startHour - b.startHour
                                                        );
                                                        const merged: any[] = [];
                                                        for (const slot of hourSlots) {
                                                            const last = merged[merged.length - 1];
                                                            if (last && last.date === slot.date && last.endHour === slot.startHour && last.preference === slot.preference) {
                                                                last.endHour = slot.endHour;
                                                            } else {
                                                                merged.push({ ...slot, id: Math.random().toString() });
                                                            }
                                                        }
                                                        const res = await fetch(`/api/admin/players/${player.id}`, {
                                                            method: "PATCH",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ availability: merged }),
                                                        });
                                                        if (res.ok) {
                                                            alert(`Fixed! ${player.availability.length} → ${merged.length} slots`);
                                                            fetchData();
                                                        }
                                                    }}
                                                    style={{ ...buttonStyle, background: "#5a3a2a", color: "#fbbf24" }}
                                                >
                                                    🔧 Fix {player.availability.length} slots
                                                </button>
                                            )}
                                            {player.status === "approved" && (
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <select
                                                        value={player.teamAssignment || ""}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            updatePlayerTeam(player.id, (e.target.value || null) as TeamAssignment);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={inputStyle}
                                                    >
                                                        <option value="">Unassigned</option>
                                                        <option value="team1">Team 1</option>
                                                        <option value="team2">Team 2</option>
                                                        <option value="team3">Team 3</option>
                                                        <option value="team4">Team 4</option>
                                                        <option value="joker">Joker</option>
                                                    </select>

                                                    {player.teamAssignment !== "joker" && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                updatePlayerCaptain(player.id, !player.isCaptain);
                                                            }}
                                                            style={{
                                                                ...buttonStyle,
                                                                background: player.isCaptain ? "#eab308" : "#2a2a3a",
                                                                color: player.isCaptain ? "#000" : "#fbbf24",
                                                                border: "1px solid #fbbf24"
                                                            }}
                                                            title={player.isCaptain ? "Remove Captain" : "Make Captain"}
                                                        >
                                                            {player.isCaptain ? "👑 Captain" : "👑 Make Captain"}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Casters Tab */}
                {activeTab === "casters" && (
                    <div style={{ display: "grid", gap: 16 }}>
                        {filteredCasters.length === 0 && <p style={{ opacity: 0.7 }}>No casters found.</p>}
                        {filteredCasters.map((caster) => (
                            <div
                                key={caster.id}
                                style={{
                                    padding: 16,
                                    background: "#12121a",
                                    borderRadius: 8,
                                    border: selectedCaster?.id === caster.id ? "2px solid #60a5fa" : "1px solid #2a2a3a",
                                    cursor: "pointer",
                                }}
                                onClick={() => setSelectedCaster(selectedCaster?.id === caster.id ? null : caster)}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <div>
                                        <strong style={{ fontSize: 16 }}>{caster.displayName}</strong>
                                        <span style={{ marginLeft: 8, opacity: 0.7 }}>{caster.discordUsername}</span>
                                    </div>
                                    <span style={{
                                        padding: "4px 8px",
                                        borderRadius: 4,
                                        background: getStatusColor(caster.status) + "22",
                                        color: getStatusColor(caster.status),
                                        fontSize: 12,
                                    }}>
                                        {caster.status}
                                    </span>
                                </div>

                                <div style={{ display: "flex", gap: 16, fontSize: 13, opacity: 0.8 }}>
                                    <span>🌍 {caster.timezone}</span>
                                    <span>🗣️ EN: {caster.englishLevel}</span>
                                    <span>⭐ Exp: {caster.experienceLevel}/5</span>
                                    {caster.canAppearOnMainStream && <span>📺 Main stream OK</span>}
                                </div>

                                {selectedCaster?.id === caster.id && (
                                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #2a2a3a" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                                            <div><strong>English Level:</strong> {caster.englishLevel}</div>
                                            <div><strong>Twitch:</strong> {caster.twitchUsername || "N/A"}</div>
                                            <div><strong>Mic OK:</strong> {caster.micQualityOk ? "Yes" : "No"}</div>
                                        </div>

                                        <div style={{ display: "flex", gap: 8 }}>
                                            {caster.status !== "approved" && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateCasterStatus(caster.id, "approved"); }}
                                                    style={{ ...buttonStyle, background: "#22543d", color: "#4ade80" }}
                                                >
                                                    ✓ Approve
                                                </button>
                                            )}
                                            {caster.status !== "rejected" && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateCasterStatus(caster.id, "rejected"); }}
                                                    style={{ ...buttonStyle, background: "#4a1a1a", color: "#f87171" }}
                                                >
                                                    ✕ Reject
                                                </button>
                                            )}
                                        </div>

                                        <div style={{ marginTop: 16 }}>
                                            <strong>Availability ({caster.availability.length} slots):</strong>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                                                {caster.availability.map((slot, i) => (
                                                    <span key={i} style={{
                                                        padding: "4px 8px",
                                                        background: "#2a3a4a",
                                                        borderRadius: 4,
                                                        fontSize: 12,
                                                    }}>
                                                        {slot.date.slice(5)} {slot.startHour}:00-{slot.endHour}:00
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Coverage Tab */}
                {activeTab === "coverage" && (
                    <div>
                        <h2 style={{ marginBottom: 16 }}>Team Coverage</h2>
                        <p style={{ opacity: 0.7, marginBottom: 24 }}>
                            Approved and assigned players only. Red = no coverage, Yellow = 1 player, Green = 2+ players
                        </p>

                        {(() => {
                            const coverage = getCoverage();
                            const teams = ["team1", "team2", "team3", "team4", "joker"] as const;

                            return (
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: 8, textAlign: "left", position: "sticky", left: 0, background: "#0a0a0f" }}>Team</th>
                                                {Array.from({ length: 69 }, (_, i) => {
                                                    const hour = (21 + i) % 24;
                                                    // D1: i=0-2 (21h-23h), D2: i=3-26 (0h-23h), D3: i=27-50, D4: i=51-68
                                                    const dateLabels = ["21/12", "22/12", "23/12", "24/12"];
                                                    let dayIndex = 0;
                                                    if (i >= 3 && i < 27) dayIndex = 1;
                                                    else if (i >= 27 && i < 51) dayIndex = 2;
                                                    else if (i >= 51) dayIndex = 3;

                                                    const showDay = (i === 0 || i === 3 || i === 27 || i === 51);
                                                    return (
                                                        <th key={i} style={{ padding: "4px 2px", fontSize: 10, minWidth: 16 }}>
                                                            {showDay ? dateLabels[dayIndex] : ""}
                                                            <br />
                                                            {hour}
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {teams.map((team) => (
                                                <tr key={team}>
                                                    <td style={{ padding: 8, fontWeight: 500, position: "sticky", left: 0, background: "#0a0a0f" }}>
                                                        {team === "joker" ? "🃏 Joker" : `Team ${team.replace("team", "")}`}
                                                    </td>
                                                    {coverage[team].map((data, i) => {
                                                        const count = data.count;
                                                        let bg = "#4a1a1a"; // red - no coverage
                                                        if (count === 1) bg = "#4a3a1a"; // yellow - fragile
                                                        if (count >= 2) bg = "#1a4a2a"; // green - covered

                                                        return (
                                                            <td key={i} title={data.names.join(", ")} style={{
                                                                padding: 2,
                                                                background: bg,
                                                                textAlign: "center",
                                                                color: count > 0 ? "#fff" : "#666",
                                                                fontSize: 10,
                                                                cursor: count > 0 ? "help" : "default",
                                                            }}>
                                                                {count > 0 ? count : ""}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}

                        {/* Caster Coverage */}
                        <h2 style={{ marginTop: 32, marginBottom: 16 }}>Caster Coverage</h2>
                        <p style={{ opacity: 0.7, marginBottom: 24 }}>
                            Approved casters only. Red = no coverage, Yellow = 1 caster, Green = 2+ casters
                        </p>

                        {(() => {
                            const casterCoverage = getCasterCoverage();

                            return (
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: 8, textAlign: "left", position: "sticky", left: 0, background: "#0a0a0f" }}>Role</th>
                                                {Array.from({ length: 69 }, (_, i) => {
                                                    const hour = (21 + i) % 24;
                                                    const dateLabels = ["21/12", "22/12", "23/12", "24/12"];
                                                    let dayIndex = 0;
                                                    if (i >= 3 && i < 27) dayIndex = 1;
                                                    else if (i >= 27 && i < 51) dayIndex = 2;
                                                    else if (i >= 51) dayIndex = 3;

                                                    const showDay = (i === 0 || i === 3 || i === 27 || i === 51);
                                                    return (
                                                        <th key={i} style={{ padding: "4px 2px", fontSize: 10, minWidth: 16 }}>
                                                            {showDay ? dateLabels[dayIndex] : ""}
                                                            <br />
                                                            {hour}
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td style={{ padding: 8, fontWeight: 500, position: "sticky", left: 0, background: "#0a0a0f" }}>
                                                    🎙️ Casters
                                                </td>
                                                {casterCoverage.map((data, i) => {
                                                    const count = data.count;
                                                    let bg = "#4a1a1a"; // red - no coverage
                                                    if (count === 1) bg = "#4a3a1a"; // yellow - fragile
                                                    if (count >= 2) bg = "#1a4a2a"; // green - covered

                                                    return (
                                                        <td key={i} title={data.names.join(", ")} style={{
                                                            padding: 2,
                                                            background: bg,
                                                            textAlign: "center",
                                                            color: count > 0 ? "#fff" : "#666",
                                                            fontSize: 10,
                                                            cursor: count > 0 ? "help" : "default",
                                                        }}>
                                                            {count > 0 ? count : ""}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}

                        <div style={{ marginTop: 24 }}>
                            <h3 style={{ marginBottom: 12 }}>Coverage Gaps</h3>
                            {(() => {
                                const coverage = getCoverage();
                                const gaps: string[] = [];

                                ["team1", "team2", "team3", "team4"].forEach(team => {
                                    coverage[team].forEach((data, hour) => {
                                        if (data.count === 0) {
                                            const day = Math.floor(hour / 24) + 1;
                                            const h = (21 + hour) % 24;
                                            gaps.push(`${team.replace("team", "Team ")}: Day ${day}, ${h}:00`);
                                        }
                                    });
                                });

                                if (gaps.length === 0) {
                                    return <p style={{ color: "#4ade80" }}>✓ No coverage gaps!</p>;
                                }

                                return (
                                    <ul style={{ color: "#f87171", lineHeight: 1.6 }}>
                                        {gaps.slice(0, 20).map((gap, i) => (
                                            <li key={i}>{gap}</li>
                                        ))}
                                        {gaps.length > 20 && <li>... and {gaps.length - 20} more</li>}
                                    </ul>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* Pots Tab */}
                {activeTab === "pots" && (
                    <div>
                        <h2 style={{ marginBottom: 16 }}>Team Pots Management</h2>
                        <p style={{ opacity: 0.7, marginBottom: 24 }}>
                            Adjust team penalty pots manually. Positive = add penalties, Negative = subtract.
                        </p>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                            {[1, 2, 3, 4].map(teamNum => {
                                const pot = pots.find(p => p.team_number === teamNum);
                                const currentAmount = pot?.amount || 0;
                                const adjustmentValue = potAdjustments[teamNum] || "";

                                return (
                                    <div key={teamNum} style={{
                                        padding: 20,
                                        background: "#12121a",
                                        borderRadius: 8,
                                        border: "1px solid #2a2a3a",
                                        textAlign: "center"
                                    }}>
                                        <h3 style={{ marginBottom: 12, color: "#60a5fa" }}>Team {teamNum}</h3>
                                        <div style={{ fontSize: 32, fontWeight: "bold", marginBottom: 16 }}>
                                            {currentAmount}
                                        </div>
                                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                            <input
                                                type="number"
                                                placeholder="+/-"
                                                value={adjustmentValue}
                                                onChange={(e) => setPotAdjustments(prev => ({
                                                    ...prev,
                                                    [teamNum]: e.target.value
                                                }))}
                                                style={{
                                                    ...inputStyle,
                                                    width: "100%",
                                                    textAlign: "center"
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button
                                                onClick={async () => {
                                                    const adj = parseInt(adjustmentValue) || 0;
                                                    if (adj === 0) return;
                                                    await fetch("/api/admin/pots", {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            team_number: teamNum,
                                                            adjustment: adj,
                                                            reason: "manual admin adjustment"
                                                        })
                                                    });
                                                    setPotAdjustments(prev => ({ ...prev, [teamNum]: "" }));
                                                    fetchData();
                                                }}
                                                style={{
                                                    ...buttonStyle,
                                                    flex: 1,
                                                    background: "#22543d",
                                                    color: "#4ade80"
                                                }}
                                            >
                                                Apply
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Reset Team ${teamNum} pot to 0?`)) return;
                                                    await fetch("/api/admin/pots", {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            team_number: teamNum,
                                                            amount: 0,
                                                            reason: "manual reset"
                                                        })
                                                    });
                                                    fetchData();
                                                }}
                                                style={{
                                                    ...buttonStyle,
                                                    background: "#4a1a1a",
                                                    color: "#f87171"
                                                }}
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: 32, padding: 16, background: "#1a1a2a", borderRadius: 8 }}>
                            <h3 style={{ marginBottom: 12 }}>Quick Actions</h3>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                <button
                                    onClick={async () => {
                                        if (!confirm("Reset ALL team pots to 0?")) return;
                                        for (const teamNum of [1, 2, 3, 4]) {
                                            await fetch("/api/admin/pots", {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ team_number: teamNum, amount: 0, reason: "full reset" })
                                            });
                                        }
                                        fetchData();
                                    }}
                                    style={{ ...buttonStyle, background: "#4a1a1a", color: "#f87171" }}
                                >
                                    Reset All Pots
                                </button>
                                <button
                                    onClick={() => fetchData()}
                                    style={{ ...buttonStyle, background: "#2a2a4a", color: "#fff" }}
                                >
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Event Control Tab */}
                {activeTab === "event" && (
                    <EventControlPanel />
                )}

                {/* Edit Availability Modal */}
                {editAvailPlayer && (
                    <div style={{
                        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                        background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
                    }}>
                        <div style={{ background: "#1e293b", padding: 24, borderRadius: 12, width: "95%", maxWidth: 1000, maxHeight: "90vh", overflowY: "auto" }}>
                            <h2 style={{ marginBottom: 16 }}>Edit Availability: {editAvailPlayer.trackmaniaName}</h2>
                            <p style={{ marginBottom: 24, opacity: 0.7 }}>Click cells to cycle: Empty → <span style={{ color: "#3b82f6" }}>OK</span> → <span style={{ color: "#22c55e" }}>Preferred</span> → Empty</p>

                            <div style={{ display: "grid", gridTemplateColumns: "100px repeat(24, 1fr)", gap: 2, marginBottom: 24 }}>
                                <div />
                                {Array.from({ length: 24 }).map((_, h) => (
                                    <div key={h} style={{ fontSize: 10, textAlign: "center", color: "#64748b" }}>{h}</div>
                                ))}

                                {["2025-12-21", "2025-12-22", "2025-12-23", "2025-12-24"].map(date => (
                                    <>
                                        <div style={{ fontSize: 12, fontWeight: "bold", padding: "8px 0" }}>{date.slice(5)}</div>
                                        {Array.from({ length: 24 }).map((_, h) => {
                                            // Determine state of this cell
                                            const slot = tempAvailability.find(s => s.date === date && h >= s.startHour && h < s.endHour);
                                            let bg = "#0f172a";
                                            if (slot) {
                                                bg = slot.preference === 'preferred' ? "#22c55e" : "#3b82f6";
                                            }

                                            // Limit based on event hours if needed, but let's allow all for simplicity or match valid hours
                                            // Event: 21st 21:00 -> 24th 18:00
                                            const isInvalid = (date === "2025-12-21" && h < 21) || (date === "2025-12-24" && h >= 18);

                                            return (
                                                <div
                                                    key={h}
                                                    onClick={() => !isInvalid && toggleSlot(date, h)}
                                                    style={{
                                                        height: 32,
                                                        background: isInvalid ? "#000" : bg,
                                                        borderRadius: 2,
                                                        cursor: isInvalid ? "default" : "pointer",
                                                        border: "1px solid #334155",
                                                        opacity: isInvalid ? 0.3 : 1
                                                    }}
                                                    title={`${date} ${h}:00`}
                                                />
                                            );
                                        })}
                                    </>
                                ))}
                            </div>

                            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                                <button onClick={() => setEditAvailPlayer(null)} style={{ ...buttonStyle, background: "#334155" }}>Cancel</button>
                                <button onClick={saveAvailability} style={{ ...buttonStyle, background: "#22c55e", color: "#000" }}>Save Changes</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </RequireAuth>
    );
}
