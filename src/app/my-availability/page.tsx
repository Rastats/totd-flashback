"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { TEAMS } from "@/lib/config";

// Same timezones as Captain Dashboard - ordered west to east
const TIMEZONES = [
    { label: "🇺🇸 Los Angeles (UTC-8)", offset: -8 },
    { label: "🇺🇸 Denver (UTC-7)", offset: -7 },
    { label: "🇺🇸 Chicago (UTC-6)", offset: -6 },
    { label: "🇺🇸 New York (UTC-5)", offset: -5 },
    { label: "🇧🇷 São Paulo (UTC-3)", offset: -3 },
    { label: "🇬🇧 London (UTC+0)", offset: 0 },
    { label: "🇫🇷 Paris (UTC+1)", offset: 1 },
    { label: "🇷🇺 Moscow (UTC+3)", offset: 3 },
    { label: "🇨🇳 Beijing (UTC+8)", offset: 8 },
    { label: "🇯🇵 Tokyo (UTC+9)", offset: 9 },
    { label: "🇦🇺 Sydney (UTC+11)", offset: 11 },
    { label: "🇳🇿 Auckland (UTC+13)", offset: 13 },
];

// Get columns (days) to display based on timezone
function getColumnDays(tzOffset: number): number[] {
    // Event: Dec 21 21:00 CET to Dec 24 18:00 CET
    // For UTC+1 (CET), show days 21-24
    // For timezones ahead of CET, might show day 25
    // For timezones behind CET, might show day 20
    if (tzOffset >= 10) return [22, 23, 24, 25]; // Far east (Sydney, Auckland)
    if (tzOffset <= -5) return [21, 22, 23, 24]; // Americas
    return [21, 22, 23, 24]; // Europe
}

// Convert local day+hour to hourIndex (CET-based event index 0-68)
function getHourIndexForLocal(localDay: number, localHour: number, tzOffset: number): number {
    const offsetDiff = tzOffset - 1; // CET is +1
    const totalLocalHours = localDay * 24 + localHour;
    const totalCetHours = totalLocalHours - offsetDiff;
    const cetDay = Math.floor(totalCetHours / 24);
    const cetHour = totalCetHours % 24;
    return (cetDay - 21) * 24 + cetHour - 21;
}

interface AvailabilitySlot {
    date: string;
    startHour: number;
    endHour: number;
    preference: string;
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

    // State for tracking selected cells (key: "day-hour", value: true)
    const [selectedCells, setSelectedCells] = useState<Record<string, boolean>>({});

    // Get column days based on timezone
    const columnDays = useMemo(() => getColumnDays(tzOffset), [tzOffset]);

    useEffect(() => {
        const fetchAvailability = async () => {
            try {
                const res = await fetch("/api/my-availability");
                if (res.ok) {
                    const data = await res.json();
                    setPlayer(data.player);
                    
                    // Convert availability slots to selected cells
                    const cells: Record<string, boolean> = {};
                    for (const slot of data.availability || []) {
                        const day = parseInt(slot.date.split('-')[2]);
                        for (let h = slot.startHour; h < slot.endHour; h++) {
                            cells[`${day}-${h}`] = true;
                        }
                    }
                    setSelectedCells(cells);
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

    // Toggle a cell
    const toggleCell = (day: number, hour: number) => {
        const key = `${day}-${hour}`;
        setSelectedCells(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
        setSuccess(false);
    };

    // Convert selected cells back to availability slots for saving
    const convertToSlots = (): AvailabilitySlot[] => {
        const slots: AvailabilitySlot[] = [];
        const dayHours: Record<number, number[]> = {};
        
        // Group by day
        for (const key of Object.keys(selectedCells)) {
            if (!selectedCells[key]) continue;
            const [dayStr, hourStr] = key.split('-');
            const day = parseInt(dayStr);
            const hour = parseInt(hourStr);
            if (!dayHours[day]) dayHours[day] = [];
            dayHours[day].push(hour);
        }
        
        // Convert to slots
        for (const [dayStr, hours] of Object.entries(dayHours)) {
            const day = parseInt(dayStr);
            const date = `2025-12-${day.toString().padStart(2, '0')}`;
            const sortedHours = hours.sort((a, b) => a - b);
            
            let startHour = sortedHours[0];
            let endHour = startHour + 1;
            
            for (let i = 1; i < sortedHours.length; i++) {
                if (sortedHours[i] === endHour) {
                    endHour++;
                } else {
                    slots.push({ date, startHour, endHour, preference: "available" });
                    startHour = sortedHours[i];
                    endHour = startHour + 1;
                }
            }
            slots.push({ date, startHour, endHour, preference: "available" });
        }
        
        return slots;
    };

    const saveAvailability = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);
        
        try {
            const slots = convertToSlots();
            const res = await fetch("/api/my-availability", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ availability: slots })
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
    const selectedTz = TIMEZONES.find(tz => tz.offset === tzOffset) || TIMEZONES[0];

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
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>
                            Discord: {player.discordUsername}
                            {teamInfo && (
                                <span style={{ color: teamInfo.color, marginLeft: 12 }}>
                                    • {teamInfo.name}
                                </span>
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
                            const isSelected = selectedCells[`${day}-${hour}`];

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
                ⏰ Times shown in {selectedTz.label}. Event runs Dec 21 21:00 - Dec 24 18:00 CET.
            </p>
        </div>
    );
}
