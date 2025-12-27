"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { TEAMS } from "@/lib/config";

// Same timezones as signup forms - ordered west to east
const TIMEZONES = [
    { label: "🇺🇸 Los Angeles (UTC-8)", offset: -8 },
    { label: "🇺🇸 Denver (UTC-7)", offset: -7 },
    { label: "🇺🇸 Chicago (UTC-6)", offset: -6 },
    { label: "🇺🇸 New York (UTC-5)", offset: -5 },
    { label: "🇧🇷 São Paulo (UTC-3)", offset: -3 },
    { label: "🇬🇧 London (UTC+0)", offset: 0 },
    { label: "🇫🇷 Paris (UTC+1)", offset: 1 },
    { label: "🇬🇷 Athens (UTC+2)", offset: 2 },
    { label: "🇹🇷 Istanbul (UTC+3)", offset: 3 },
    { label: "🇦🇪 Dubai (UTC+4)", offset: 4 },
    { label: "🇮🇩 Jakarta (UTC+7)", offset: 7 },
    { label: "🇸🇬 Singapore (UTC+8)", offset: 8 },
    { label: "🇯🇵 Tokyo (UTC+9)", offset: 9 },
    { label: "🇦🇺 Sydney (UTC+11)", offset: 11 },
    { label: "🇳🇿 Auckland (UTC+13)", offset: 13 },
];

// Get columns (days) to display based on timezone
// Event: Dec 26 20:00 CET to Dec 29 17:00 CET
function getColumnDays(tzOffset: number): number[] {
    if (tzOffset >= 10) return [27, 28, 29, 30]; // Far east
    if (tzOffset <= -5) return [25, 26, 27, 28, 29]; // Americas (show more days)
    return [26, 27, 28, 29]; // Europe
}

// Convert local day+hour to hourIndex (CET-based event index 0-68)
// Event starts Dec 26 20:00 CET
function getHourIndexForLocal(localDay: number, localHour: number, tzOffset: number): number {
    const offsetDiff = tzOffset - 1; // CET is +1
    const totalLocalHours = localDay * 24 + localHour;
    const totalCetHours = totalLocalHours - offsetDiff;
    const cetDay = Math.floor(totalCetHours / 24);
    const cetHour = totalCetHours % 24;
    return (cetDay - 26) * 24 + cetHour - 20; // Day 26, hour 20 = index 0
}

// Convert hourIndex to local day+hour for a timezone
function getLocalTimeForHourIndex(hourIndex: number, tzOffset: number): { day: number; hour: number } {
    // hourIndex 0 = Dec 26 20:00 CET
    const cetTotalHours = 26 * 24 + 20 + hourIndex; // Day 26, hour 20 + index
    const cetDay = Math.floor(cetTotalHours / 24);
    const cetHour = cetTotalHours % 24;

    // Convert CET to target timezone
    const offsetDiff = tzOffset - 1; // CET is +1
    const totalLocalHours = cetDay * 24 + cetHour + offsetDiff;
    const localDay = Math.floor(totalLocalHours / 24);
    const localHour = ((totalLocalHours % 24) + 24) % 24;

    return { day: localDay, hour: localHour };
}

interface PlayerInfo {
    id: string;
    name: string;
    discordUsername: string;
    teamAssignment: string | null;
}

export default function MyAvailabilityPage() {
    const { data: session, status } = useSession();
    const [player, setPlayer] = useState<PlayerInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [tzOffset, setTzOffset] = useState(1); // Default: Paris

    // Store selected hour indices (timezone-independent, 0-68)
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    // Get column days based on timezone
    const columnDays = useMemo(() => getColumnDays(tzOffset), [tzOffset]);

    useEffect(() => {
        const fetchAvailability = async () => {
            try {
                const res = await fetch("/api/my-availability");
                if (res.ok) {
                    const data = await res.json();
                    setPlayer(data.player);

                    // API returns hourIndex directly for each slot
                    const indices = new Set<number>(
                        (data.availability || []).map((s: { hourIndex: number }) => s.hourIndex)
                    );
                    setSelectedIndices(indices);
                } else {
                    const data = await res.json();
                    setError(data.message || data.error);
                }
            } catch (err) {
                setError("Failed to load availability");
            } finally {
                setLoading(false);
            }
        };

        if (status === "authenticated") {
            fetchAvailability();
        } else if (status === "unauthenticated") {
            setLoading(false);
        }
    }, [status]);

    // Toggle a cell by converting to hourIndex
    const toggleCell = (day: number, hour: number) => {
        const hourIndex = getHourIndexForLocal(day, hour, tzOffset);
        if (hourIndex < 0 || hourIndex > 68) return;

        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(hourIndex)) {
                next.delete(hourIndex);
            } else {
                next.add(hourIndex);
            }
            return next;
        });
        setSuccess(false);
    };

    // Check if a cell is selected (by converting display day+hour to index)
    const isCellSelected = (day: number, hour: number): boolean => {
        const hourIndex = getHourIndexForLocal(day, hour, tzOffset);
        return selectedIndices.has(hourIndex);
    };

    const saveAvailability = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            // Send hour indices directly in the new format
            const availability = Array.from(selectedIndices).map(hourIndex => ({
                hourIndex,
                preference: 'ok'
            }));

            const res = await fetch("/api/my-availability", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ availability })
            });

            if (res.ok) {
                setSuccess(true);
            } else {
                const data = await res.json();
                setError(data.error || "Failed to save");
            }
        } catch (err) {
            setError("Failed to save availability");
        } finally {
            setSaving(false);
        }
    };

    // Get team info
    const teamInfo = player?.teamAssignment ? TEAMS.find(t => t.id === player.teamAssignment) : null;
    const selectedTz = TIMEZONES.find(tz => tz.offset === tzOffset) || TIMEZONES[6]; // Paris default

    if (status === "loading" || loading) {
        return (
            <div style={{ padding: 40, maxWidth: 1000, margin: "0 auto", color: "#e2e8f0" }}>
                <p>Loading...</p>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return (
            <div style={{ padding: 40, maxWidth: 600, margin: "0 auto", color: "#e2e8f0", textAlign: "center" }}>
                <h1 style={{ fontSize: 24, marginBottom: 16 }}>📅 My Availability</h1>
                <p style={{ color: "#94a3b8", marginBottom: 24 }}>
                    Log in with Discord to view and edit your availability.
                </p>
                <button
                    onClick={() => signIn("discord")}
                    style={{
                        padding: "12px 24px",
                        background: "#5865F2",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 16,
                        cursor: "pointer",
                    }}
                >
                    🔐 Login with Discord
                </button>
            </div>
        );
    }

    if (error && !player) {
        return (
            <div style={{ padding: 40, maxWidth: 600, margin: "0 auto", color: "#e2e8f0", textAlign: "center" }}>
                <h1 style={{ fontSize: 24, marginBottom: 16, color: "#f87171" }}>❌ Not Found</h1>
                <p style={{ color: "#94a3b8", marginBottom: 24 }}>{error}</p>
                <Link href="/" style={{ color: "#60a5fa" }}>← Back to Home</Link>
            </div>
        );
    }

    return (
        <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto", color: "#e2e8f0" }}>
            <div style={{ marginBottom: 24 }}>
                <Link href="/" style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>← Back</Link>
                <h1 style={{ fontSize: 24, fontWeight: "bold", margin: "8px 0" }}>📅 My Availability</h1>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>
                    Click cells to toggle your availability. Green = available.
                </p>
            </div>

            {/* Player Info + Timezone Selector */}
            {player && (
                <div style={{
                    background: "#1e293b",
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 24,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 16
                }}>
                    <div>
                        <div style={{ fontWeight: "bold", fontSize: 18 }}>{player.name}</div>
                        <div style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span>Discord: {player.discordUsername}</span>
                            {teamInfo && (
                                <>
                                    <span style={{ color: teamInfo.color }}>
                                        • {teamInfo.name}
                                    </span>
                                    <Link
                                        href={`/schedule/${teamInfo.id}`}
                                        style={{
                                            padding: "4px 10px",
                                            background: teamInfo.color + "22",
                                            border: `1px solid ${teamInfo.color}`,
                                            borderRadius: 4,
                                            color: teamInfo.color,
                                            fontSize: 11,
                                            textDecoration: "none",
                                            fontWeight: 600,
                                        }}
                                    >
                                        📅 Team Schedule
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {/* Timezone Selector */}
                        <select
                            value={tzOffset}
                            onChange={(e) => setTzOffset(parseInt(e.target.value))}
                            style={{
                                padding: "8px 12px",
                                background: "#0f172a",
                                border: "1px solid #334155",
                                borderRadius: 6,
                                color: "#fff",
                                fontSize: 13,
                            }}
                        >
                            {TIMEZONES.map(tz => (
                                <option key={tz.label} value={tz.offset}>{tz.label}</option>
                            ))}
                        </select>
                        <button
                            onClick={saveAvailability}
                            disabled={saving}
                            style={{
                                padding: "10px 24px",
                                background: saving ? "#475569" : "#22c55e",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                fontWeight: "bold",
                                cursor: saving ? "wait" : "pointer",
                            }}
                        >
                            {saving ? "Saving..." : "💾 Save Changes"}
                        </button>
                    </div>
                </div>
            )}

            {/* Success/Error Messages */}
            {success && (
                <div style={{ background: "#14532d", padding: 12, borderRadius: 6, marginBottom: 16, color: "#22c55e" }}>
                    ✅ Availability saved successfully!
                </div>
            )}
            {error && player && (
                <div style={{ background: "#7f1d1d", padding: 12, borderRadius: 6, marginBottom: 16, color: "#fca5a5" }}>
                    ❌ {error}
                </div>
            )}

            {/* Availability Grid */}
            <div style={{
                display: "grid",
                gridTemplateColumns: `60px repeat(${columnDays.length}, 1fr)`,
                background: "#1e293b",
                borderRadius: 12,
                overflow: "hidden"
            }}>
                {/* Header */}
                <div style={{ background: "#0f172a", padding: 12, fontWeight: "bold", textAlign: "center" }}>Time</div>
                {columnDays.map(day => (
                    <div key={day} style={{
                        background: "#0f172a",
                        padding: 12,
                        fontWeight: "bold",
                        textAlign: "center",
                        borderLeft: "1px solid #334155"
                    }}>
                        Dec {day}
                    </div>
                ))}

                {/* Hours Grid */}
                {Array.from({ length: 24 }).map((_, hour) => (
                    <div key={hour} style={{ display: "contents" }}>
                        <div style={{
                            padding: 8,
                            textAlign: "right",
                            fontSize: 12,
                            color: "#94a3b8",
                            borderTop: "1px solid #334155"
                        }}>
                            {hour.toString().padStart(2, '0')}:00
                        </div>
                        {columnDays.map(day => {
                            const hourIndex = getHourIndexForLocal(day, hour, tzOffset);
                            const isInEvent = hourIndex >= 0 && hourIndex <= 68;
                            const isSelected = isCellSelected(day, hour);

                            return (
                                <div
                                    key={`${day}-${hour}`}
                                    onClick={() => isInEvent && toggleCell(day, hour)}
                                    style={{
                                        borderTop: "1px solid #334155",
                                        borderLeft: "1px solid #334155",
                                        minHeight: 28,
                                        background: isInEvent
                                            ? (isSelected ? "#22c55e" : "#1e293b")
                                            : "#0f172a",
                                        cursor: isInEvent ? "pointer" : "default",
                                        opacity: isInEvent ? 1 : 0.3,
                                    }}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>

            <p style={{ fontSize: 12, color: "#64748b", marginTop: 16 }}>
                ⏰ Times shown in {selectedTz.label}. Event runs Dec 26 20:00 - Dec 29 17:00 CET.
            </p>
        </div>
    );
}
