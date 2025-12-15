"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TeamPlanning, TeamSlotAssignment, AvailabilitySlot, TeamAssignment } from "@/lib/types";

interface PlayerSummary {
    id: string;
    name: string;
    teamAssignment: TeamAssignment;
    availability: AvailabilitySlot[];
}

interface TeamData {
    teamId: string;
    players: PlayerSummary[];
    planning: TeamPlanning;
}

const HOURS = 69;

const getSlotTime = (hourIndex: number) => {
    // 0 = Dec 21 21h
    // 3 = Dec 22 00h
    // 27 = Dec 23 00h
    // 51 = Dec 24 00h
    if (hourIndex < 3) {
        return `Dec 21, ${21 + hourIndex}:00`;
    }
    const offsetIndex = hourIndex - 3;
    const day = Math.floor(offsetIndex / 24);
    const hour = offsetIndex % 24;
    const dates = ["Dec 22", "Dec 23", "Dec 24"];
    return `${dates[day]}, ${hour}:00`;
};

// Check if a player is available at a specific hourIndex
const isUnavailable = (player: PlayerSummary, hourIndex: number) => {
    // Reverse mapping: from hourIndex to date + hour
    let dateStr = "";
    let hour = 0;

    if (hourIndex < 3) {
        dateStr = "2025-12-21";
        hour = 21 + hourIndex;
    } else {
        const offsetIndex = hourIndex - 3;
        const dayOffset = Math.floor(offsetIndex / 24);
        const h = offsetIndex % 24;
        dateStr = ["2025-12-22", "2025-12-23", "2025-12-24"][dayOffset];
        hour = h;
    }

    // Check availability array
    // Availability is stored as availability slots with start/end
    const slot = player.availability.find(s =>
        s.date === dateStr &&
        hour >= s.startHour &&
        hour < s.endHour
    );
    return !slot;
};

export default function CaptainPage() {
    const params = useParams();
    const teamId = params.teamId as string;
    const [data, setData] = useState<TeamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [assignments, setAssignments] = useState<Record<number, TeamSlotAssignment>>({});
    const [error, setError] = useState<string | null>(null);

    // Bulk state
    const [bulkStart, setBulkStart] = useState(0);
    const [bulkEnd, setBulkEnd] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/captain/${teamId}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                    setAssignments(json.planning.slots || {});
                } else {
                    const text = await res.text();
                    setError(`Failed to load team data (${res.status}): ${text}`);
                }
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Network error");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [teamId]);

    const handleAssignmentChange = (hourIndex: number, type: 'main' | 'sub', playerId: string) => {
        const current = assignments[hourIndex] || { mainPlayerId: null, subPlayerId: null };
        const newVal = playerId === "null" ? null : playerId;

        const updated = {
            ...current,
            [type === 'main' ? 'mainPlayerId' : 'subPlayerId']: newVal
        };

        setAssignments(prev => ({
            ...prev,
            [hourIndex]: updated
        }));
    };

    const saveChanges = async () => {
        setSaving(true);
        try {
            await fetch(`/api/captain/${teamId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slots: assignments })
            });
            alert("Changes saved successfully!");
        } catch (err) {
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    // Calculate availability for bulk range
    const getBulkAvailability = (player: PlayerSummary) => {
        if (!bulkStart && bulkStart !== 0) return { status: 'unknown', text: '', score: -1 };

        let availableCount = 0;
        let total = 0;

        // Ensure start <= end
        const s = Math.min(bulkStart, bulkEnd);
        const e = Math.max(bulkStart, bulkEnd);

        for (let i = s; i <= e; i++) {
            total++;
            if (!isUnavailable(player, i)) {
                availableCount++;
            }
        }

        if (availableCount === total) return { status: 'full', text: '✅', score: 2 };
        if (availableCount === 0) return { status: 'none', text: '🔴', score: 0 };
        return { status: 'partial', text: `⚠️ (${availableCount}/${total})`, score: 1 };
    };

    if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading...</div>;
    if (error) return <div style={{ padding: 20, color: "#f87171" }}>Error: {error}</div>;
    if (!data) return <div style={{ padding: 20, color: "#f87171" }}>Team not found</div>;

    // Sort players for bulk dropdown
    const sortedPlayers = [...data.players].sort((a, b) => {
        const scoreA = getBulkAvailability(a).score;
        const scoreB = getBulkAvailability(b).score;
        return scoreB - scoreA; // Highest score first
    });

    return (
        <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto", color: "#e2e8f0", fontFamily: "sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h1 style={{ fontSize: 24, fontWeight: "bold" }}>
                    Captain Dashboard - {teamId === "joker" ? "🃏 Jokers" : `Team ${teamId.replace("team", "")}`}
                </h1>
                <button
                    onClick={saveChanges}
                    disabled={saving}
                    style={{
                        background: "#2563eb", color: "white", padding: "10px 20px",
                        border: "none", borderRadius: 6, cursor: saving ? "wait" : "pointer",
                        fontWeight: "bold"
                    }}
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            {/* BULK ACTIONS */}
            <div style={{ background: "#1e293b", padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>⚡ Bulk Assignment</h3>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
                    <div>
                        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#94a3b8" }}>From</label>
                        <select
                            value={bulkStart}
                            onChange={(e) => setBulkStart(parseInt(e.target.value))}
                            style={{ padding: 8, borderRadius: 4, background: "#334155", color: "#fff", border: "1px solid #475569" }}
                        >
                            {Array.from({ length: HOURS }).map((_, i) => (
                                <option key={i} value={i}>{getSlotTime(i)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#94a3b8" }}>To (Inclusive)</label>
                        <select
                            value={bulkEnd}
                            onChange={(e) => setBulkEnd(parseInt(e.target.value))}
                            style={{ padding: 8, borderRadius: 4, background: "#334155", color: "#fff", border: "1px solid #475569" }}
                        >
                            {Array.from({ length: HOURS }).map((_, i) => (
                                <option key={i} value={i}>{getSlotTime(i)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#94a3b8" }}>Set Main Player</label>
                        <select id="bulk-main" style={{ padding: 8, borderRadius: 4, background: "#334155", color: "#fff", border: "1px solid #475569", minWidth: 200 }}>
                            <option value="">-- No Change --</option>
                            <option value="clear">❌ Clear Assignment</option>
                            {sortedPlayers.map(p => {
                                const avail = getBulkAvailability(p);
                                return (
                                    <option key={p.id} value={p.id}>
                                        {avail.text} {p.name} {p.teamAssignment === 'joker' ? "(Joker)" : ""}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#94a3b8" }}>Set Backup Player</label>
                        <select id="bulk-sub" style={{ padding: 8, borderRadius: 4, background: "#334155", color: "#fff", border: "1px solid #475569", minWidth: 200 }}>
                            <option value="">-- No Change --</option>
                            <option value="clear">❌ Clear Assignment</option>
                            {sortedPlayers.map(p => {
                                const avail = getBulkAvailability(p);
                                return (
                                    <option key={p.id} value={p.id}>
                                        {avail.text} {p.name} {p.teamAssignment === 'joker' ? "(Joker)" : ""}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <button
                        onClick={() => {
                            const start = Math.min(bulkStart, bulkEnd);
                            const end = Math.max(bulkStart, bulkEnd);
                            const main = (document.getElementById("bulk-main") as HTMLSelectElement).value;
                            const sub = (document.getElementById("bulk-sub") as HTMLSelectElement).value;

                            if (!main && !sub) return;

                            setAssignments(prev => {
                                const next = { ...prev };
                                for (let i = start; i <= end; i++) {
                                    const current = next[i] || { mainPlayerId: null, subPlayerId: null };
                                    if (main) next[i] = { ...current, mainPlayerId: main === "clear" ? null : main };
                                    if (sub) next[i] = { ...next[i], subPlayerId: sub === "clear" ? null : sub };
                                }
                                return next;
                            });
                        }}
                        style={{ padding: "8px 16px", background: "#f59e0b", color: "#000", fontWeight: "bold", borderRadius: 4, border: "none", cursor: "pointer" }}
                    >
                        Apply to Range
                    </button>
                </div>
            </div>

            <div style={{ background: "#1e293b", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "#0f172a", textAlign: "left" }}>
                            <th style={{ padding: 12, borderBottom: "1px solid #334155" }}>Time Slot</th>
                            <th style={{ padding: 12, borderBottom: "1px solid #334155" }}>Main Player</th>
                            <th style={{ padding: 12, borderBottom: "1px solid #334155" }}>Secondary Player (Backup)</th>
                            <th style={{ padding: 12, borderBottom: "1px solid #334155" }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: HOURS }).map((_, i) => {
                            const slot = assignments[i] || { mainPlayerId: null, subPlayerId: null };
                            const mainMissing = !slot.mainPlayerId;
                            const subMissing = !slot.subPlayerId;

                            let statusColor = "#22c55e"; // Green
                            let statusText = "Ready";
                            if (mainMissing) {
                                statusColor = "#ef4444"; // Red
                                statusText = "Missing Main";
                            } else if (subMissing) {
                                statusColor = "#eab308"; // Yellow
                                statusText = "Missing Backup";
                            }

                            return (
                                <tr key={i} style={{ borderBottom: "1px solid #334155", background: i % 2 === 0 ? "#1e293b" : "#24344d" }}>
                                    <td style={{ padding: 10, fontWeight: 500 }}>{getSlotTime(i)}</td>

                                    {/* MAIN PLAYER */}
                                    <td style={{ padding: 10 }}>
                                        <select
                                            value={slot.mainPlayerId || "null"}
                                            onChange={(e) => handleAssignmentChange(i, 'main', e.target.value)}
                                            style={{
                                                padding: 6, borderRadius: 4, background: "#334155", color: "#fff", border: "1px solid #475569", width: "100%"
                                            }}
                                        >
                                            <option value="null">-- Select Main --</option>
                                            {data.players.map(p => {
                                                const unavailable = isUnavailable(p, i);
                                                return (
                                                    <option key={p.id} value={p.id} style={{ color: unavailable ? "#f87171" : "#fff" }}>
                                                        {unavailable ? "🔴 " : "🟢 "} {p.name} {p.teamAssignment === 'joker' ? "(Joker)" : ""}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </td>

                                    {/* SUB PLAYER */}
                                    <td style={{ padding: 10 }}>
                                        <select
                                            value={slot.subPlayerId || "null"}
                                            onChange={(e) => handleAssignmentChange(i, 'sub', e.target.value)}
                                            style={{
                                                padding: 6, borderRadius: 4, background: "#334155", color: "#fff", border: "1px solid #475569", width: "100%"
                                            }}
                                        >
                                            <option value="null">-- Select Backup --</option>
                                            {data.players.map(p => {
                                                if (p.id === slot.mainPlayerId) return null; // Can't be main and sub
                                                const unavailable = isUnavailable(p, i);
                                                return (
                                                    <option key={p.id} value={p.id} style={{ color: unavailable ? "#f87171" : "#fff" }}>
                                                        {unavailable ? "🔴 " : "🟢 "} {p.name} {p.teamAssignment === 'joker' ? "(Joker)" : ""}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </td>

                                    <td style={{ padding: 10 }}>
                                        <span style={{
                                            padding: "4px 8px", borderRadius: 4,
                                            background: `${statusColor}20`, color: statusColor, fontWeight: "bold", fontSize: 12
                                        }}>
                                            {statusText}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
