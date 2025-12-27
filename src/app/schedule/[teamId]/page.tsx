"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AvailabilitySlot, TeamAssignment } from "@/lib/types";
import { TEAMS } from "@/lib/config";
import Link from "next/link";

// =============== TYPES ===============
interface PlayerSummary {
    id: string;
    name: string;
    teamAssignment: TeamAssignment;
    availability: AvailabilitySlot[];
}

interface CalendarSlot {
    hourIndex: number;
    mainPlayerId: string;
    mainPlayerName: string;
    subPlayerId: string | null;
    subPlayerName: string | null;
}

// =============== CONSTANTS ===============
// Timezones ordered west to east
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

const PLAYER_COLORS = [
    "#60a5fa", "#fbbf24", "#f472b6", "#34d399",
    "#a78bfa", "#fb923c", "#2dd4bf", "#f87171"
];

const getPlayerColor = (name: string): string => {
    const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return PLAYER_COLORS[hash % PLAYER_COLORS.length];
};

// =============== TIME UTILITIES ===============
// Event: Dec 26 20:00 CET to Dec 29 17:00 CET (69 hours, indices 0-68)
const getLocalTimeForHourIndex = (hourIndex: number, tzOffset: number): { day: number; hour: number } => {
    // hourIndex 0 = Dec 26 20:00 CET
    const cetTotalHours = 26 * 24 + 20 + hourIndex; // Day 26, hour 20 + index
    const cetDay = Math.floor(cetTotalHours / 24);
    const cetHour = cetTotalHours % 24;
    const offsetDiff = tzOffset - 1;
    const totalLocalHours = cetDay * 24 + cetHour + offsetDiff;
    const localDay = Math.floor(totalLocalHours / 24);
    const localHour = ((totalLocalHours % 24) + 24) % 24;
    return { day: localDay, hour: localHour };
};

const getHourIndexForLocal = (localDay: number, localHour: number, tzOffset: number): number => {
    const offsetDiff = tzOffset - 1;
    const totalLocalHours = localDay * 24 + localHour;
    const totalCetHours = totalLocalHours - offsetDiff;
    const startTotalHours = 26 * 24 + 20; // Dec 26, 20:00 CET
    return totalCetHours - startTotalHours;
};

const getColumnDays = (tzOffset: number): number[] => {
    const start = getLocalTimeForHourIndex(0, tzOffset);
    const end = getLocalTimeForHourIndex(68, tzOffset);
    const days: number[] = [];
    for (let d = start.day; d <= end.day; d++) days.push(d);
    return days;
};

// =============== MAIN COMPONENT ===============
export default function SchedulePage() {
    const params = useParams();
    const teamId = params.teamId as string;

    const [players, setPlayers] = useState<PlayerSummary[]>([]);
    const [slots, setSlots] = useState<CalendarSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tzOffset, setTzOffset] = useState(1);

    const teamConfig = TEAMS.find(t => t.id === teamId);
    const teamColor = teamConfig?.color || "#60a5fa";
    const teamName = teamConfig?.name || `Team ${teamId.replace("team", "")}`;

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Use public API endpoint (no auth required)
                const res = await fetch(`/api/schedule/${teamId}`);
                if (res.ok) {
                    const json = await res.json();
                    setPlayers(json.players || []);
                    const storedSlots: CalendarSlot[] = [];
                    const rawSlots = json.planning?.slots || {};
                    for (let i = 0; i <= 68; i++) {
                        const raw = rawSlots[i];
                        if (raw?.mainPlayerId) {
                            storedSlots.push({
                                hourIndex: i,
                                mainPlayerId: raw.mainPlayerId,
                                mainPlayerName: raw.main_player_name || "Unknown",
                                subPlayerId: raw.subPlayerId || null,
                                subPlayerName: raw.sub_player_name || null,
                            });
                        }
                    }
                    setSlots(storedSlots);
                } else {
                    setError(`Failed to load (${res.status})`);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Network error");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [teamId]);

    const columnDays = getColumnDays(tzOffset);

    if (loading) return <div style={{ padding: 20, color: "#fff" }}>Loading schedule...</div>;
    if (error) return <div style={{ padding: 20, color: "#f87171" }}>Error: {error}</div>;

    return (
        <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto", color: "#e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <Link href="/schedule" style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>← All Teams</Link>
                    <h1 style={{ fontSize: 24, fontWeight: "bold", margin: "8px 0 0", color: teamColor }}>
                        {teamName} Schedule
                    </h1>
                </div>
                <select value={tzOffset} onChange={e => setTzOffset(parseFloat(e.target.value))} style={{ padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                    {TIMEZONES.map(tz => <option key={tz.label} value={tz.offset}>{tz.label}</option>)}
                </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${columnDays.length}, 1fr)`, background: "#1e293b", borderRadius: 12, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ background: "#0f172a", padding: 12, fontWeight: "bold", textAlign: "center", borderTop: "1px solid #334155" }}>Time</div>
                {columnDays.map(day => <div key={day} style={{ background: "#0f172a", padding: 12, fontWeight: "bold", textAlign: "center", borderLeft: "1px solid #334155", borderTop: "1px solid #334155" }}>Dec {day}</div>)}

                {/* Grid */}
                {Array.from({ length: 24 }).map((_, hour) => (
                    <div key={hour} style={{ display: "contents" }}>
                        <div style={{ padding: 8, textAlign: "right", fontSize: 12, color: "#94a3b8", borderTop: "1px solid #334155" }}>{hour.toString().padStart(2, '0')}:00</div>
                        {columnDays.map(day => {
                            const hourIndex = getHourIndexForLocal(day, hour, tzOffset);
                            const isInEvent = hourIndex >= 0 && hourIndex <= 68;
                            const slot = slots.find(s => s.hourIndex === hourIndex);

                            return (
                                <div
                                    key={`${day}-${hour}`}
                                    style={{
                                        borderTop: "1px solid #334155",
                                        borderLeft: "1px solid #334155",
                                        minHeight: 40,
                                        background: isInEvent ? (slot ? getPlayerColor(slot.mainPlayerName) : "#1e293b") : "#080b10",
                                        position: "relative",
                                        padding: slot ? 4 : 0,
                                        opacity: isInEvent ? 1 : 0.4,
                                        backgroundImage: isInEvent ? undefined : "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.3) 5px, rgba(0,0,0,0.3) 10px)",
                                    }}
                                >
                                    {slot && (
                                        <>
                                            <div style={{ fontSize: 11, fontWeight: "bold", color: "#000" }}>{slot.mainPlayerName}</div>
                                            {slot.subPlayerName && <div style={{ fontSize: 9, color: "#1e293b" }}>(Sub: {slot.subPlayerName})</div>}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
