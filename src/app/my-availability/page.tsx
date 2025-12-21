"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { TEAMS } from "@/lib/config";

// Event days for the grid (Dec 21-24, 2025)
const EVENT_DAYS = [
    { date: "2025-12-21", label: "Dec 21" },
    { date: "2025-12-22", label: "Dec 22" },
    { date: "2025-12-23", label: "Dec 23" },
    { date: "2025-12-24", label: "Dec 24" },
];

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
    const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // State for tracking selected cells (day -> Set of hours)
    const [selectedCells, setSelectedCells] = useState<Record<string, Set<number>>>({});

    useEffect(() => {
        const fetchAvailability = async () => {
            try {
                const res = await fetch("/api/my-availability");
                if (res.ok) {
                    const data = await res.json();
                    setPlayer(data.player);
                    setAvailability(data.availability || []);
                    
                    // Convert availability to selected cells
                    const cells: Record<string, Set<number>> = {};
                    for (const slot of data.availability || []) {
                        if (!cells[slot.date]) cells[slot.date] = new Set();
                        for (let h = slot.startHour; h < slot.endHour; h++) {
                            cells[slot.date].add(h);
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
    const toggleCell = (date: string, hour: number) => {
        setSelectedCells(prev => {
            const newCells = { ...prev };
            if (!newCells[date]) newCells[date] = new Set();
            
            if (newCells[date].has(hour)) {
                newCells[date].delete(hour);
            } else {
                newCells[date].add(hour);
            }
            return newCells;
        });
        setSuccess(false);
    };

    // Convert selected cells back to availability slots
    const convertToSlots = (): AvailabilitySlot[] => {
        const slots: AvailabilitySlot[] = [];
        
        for (const [date, hours] of Object.entries(selectedCells)) {
            if (hours.size === 0) continue;
            
            // Sort hours and group consecutive ones
            const sortedHours = Array.from(hours).sort((a, b) => a - b);
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

            {/* Player Info */}
            {player && (
                <div style={{ 
                    background: "#1e293b", 
                    borderRadius: 8, 
                    padding: 16, 
                    marginBottom: 24,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
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
                gridTemplateColumns: `60px repeat(${EVENT_DAYS.length}, 1fr)`,
                background: "#1e293b",
                borderRadius: 12,
                overflow: "hidden"
            }}>
                {/* Header */}
                <div style={{ background: "#0f172a", padding: 12, fontWeight: "bold", textAlign: "center" }}>Time</div>
                {EVENT_DAYS.map(day => (
                    <div key={day.date} style={{ 
                        background: "#0f172a", 
                        padding: 12, 
                        fontWeight: "bold", 
                        textAlign: "center",
                        borderLeft: "1px solid #334155"
                    }}>
                        {day.label}
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
                        {EVENT_DAYS.map(day => {
                            const isSelected = selectedCells[day.date]?.has(hour);
                            
                            // Check if hour is within event bounds
                            const isInEvent = (
                                (day.date === "2025-12-21" && hour >= 21) ||
                                (day.date === "2025-12-22") ||
                                (day.date === "2025-12-23") ||
                                (day.date === "2025-12-24" && hour < 18)
                            );

                            return (
                                <div
                                    key={`${day.date}-${hour}`}
                                    onClick={() => isInEvent && toggleCell(day.date, hour)}
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
                ⏰ Times shown in CET (Paris time). Event runs Dec 21 21:00 - Dec 24 18:00 CET.
            </p>
        </div>
    );
}
