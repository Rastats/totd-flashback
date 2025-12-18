"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { TeamSlotAssignment, AvailabilitySlot, TeamAssignment } from "@/lib/types";
import CaptainAuth from "@/components/CaptainAuth";

// =============== TYPES ===============
interface PlayerSummary {
    id: string;
    name: string;
    teamAssignment: TeamAssignment;
    availability: AvailabilitySlot[];
}

interface CalendarSlot {
    hourIndex: number;      // 0-68 (stored)
    mainPlayerId: string;
    mainPlayerName: string;
    subPlayerId: string | null;
    subPlayerName: string | null;
}

// =============== CONSTANTS ===============
const TIMEZONES = [
    { label: "CET (Paris, UTC+1)", offset: 1 },
    { label: "GMT (London, UTC+0)", offset: 0 },
    { label: "EST (New York, UTC-5)", offset: -5 },
    { label: "PST (Los Angeles, UTC-8)", offset: -8 },
    { label: "AEST (Sydney, UTC+11)", offset: 11 },
    { label: "JST (Tokyo, UTC+9)", offset: 9 },
];

// Event runs Dec 21 21:00 CET to Dec 24 18:00 CET (69 hours)
const EVENT_START_UTC = new Date("2025-12-21T20:00:00Z"); // 21:00 CET = 20:00 UTC

const PLAYER_COLORS = [
    "#60a5fa", "#fbbf24", "#f472b6", "#34d399",
    "#a78bfa", "#fb923c", "#2dd4bf", "#f87171"
];

const getPlayerColor = (name: string): string => {
    const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return PLAYER_COLORS[hash % PLAYER_COLORS.length];
};

// =============== TIME UTILITIES ===============
const getLocalDateForHourIndex = (hourIndex: number, tzOffset: number) => {
    const utcTime = new Date(EVENT_START_UTC.getTime() + hourIndex * 60 * 60 * 1000);
    const localTime = new Date(utcTime.getTime() + tzOffset * 60 * 60 * 1000);
    return localTime;
};

const getColumnDates = (tzOffset: number): Date[] => {
    const dates: Date[] = [];
    const startLocal = getLocalDateForHourIndex(0, tzOffset);
    const endLocal = getLocalDateForHourIndex(68, tzOffset);

    const startDay = new Date(startLocal.getFullYear(), startLocal.getMonth(), startLocal.getDate());
    const endDay = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate());

    const current = new Date(startDay);
    while (current <= endDay) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
};

const formatDate = (date: Date): string => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}`;
};

// =============== AVAILABILITY CHECK ===============
const isPlayerAvailable = (player: PlayerSummary, hourIndex: number): boolean => {
    // Convert hourIndex to date + hour (CET-based for availability matching)
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

    const slot = player.availability.find(s =>
        s.date === dateStr && hour >= s.startHour && hour < s.endHour
    );
    return !!slot;
};

// =============== MODAL COMPONENT ===============
interface SlotModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { startHour: number; endHour: number; mainPlayerId: string; subPlayerId: string | null }) => void;
    onDelete?: () => void;
    players: PlayerSummary[];
    dayDate: Date;
    initialStartHour: number;
    initialEndHour?: number;
    initialMainPlayerId?: string;
    initialSubPlayerId?: string | null;
    isEdit?: boolean;
    existingSlots: { startHour: number; endHour: number }[];
    tzOffset: number;
}

function SlotModal({
    isOpen, onClose, onSave, onDelete, players, dayDate,
    initialStartHour, initialEndHour, initialMainPlayerId, initialSubPlayerId,
    isEdit, existingSlots, tzOffset
}: SlotModalProps) {
    const [startHour, setStartHour] = useState(initialStartHour);
    const [endHour, setEndHour] = useState(initialEndHour || initialStartHour + 1);
    const [mainPlayerId, setMainPlayerId] = useState(initialMainPlayerId || "");
    const [subPlayerId, setSubPlayerId] = useState(initialSubPlayerId || "");

    useEffect(() => {
        setStartHour(initialStartHour);
        setEndHour(initialEndHour || initialStartHour + 1);
        setMainPlayerId(initialMainPlayerId || "");
        setSubPlayerId(initialSubPlayerId || "");
    }, [initialStartHour, initialEndHour, initialMainPlayerId, initialSubPlayerId]);

    if (!isOpen) return null;

    // Get hourIndex for availability check
    const getHourIndexForLocalHour = (dayDate: Date, hour: number): number => {
        // Convert local hour back to hourIndex
        const localTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour);
        const utcTime = new Date(localTime.getTime() - tzOffset * 60 * 60 * 1000);
        const diffMs = utcTime.getTime() - EVENT_START_UTC.getTime();
        return Math.floor(diffMs / (60 * 60 * 1000));
    };

    const availableHours: number[] = [];
    for (let h = 0; h < 24; h++) {
        const idx = getHourIndexForLocalHour(dayDate, h);
        if (idx >= 0 && idx <= 68) {
            availableHours.push(h);
        }
    }

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000
        }} onClick={onClose}>
            <div style={{
                background: "#1e293b", borderRadius: 12, padding: 24, minWidth: 350,
                border: "1px solid #334155"
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#e2e8f0" }}>
                    {isEdit ? "Edit Slot" : "Add Slot"} - {formatDate(dayDate)}
                </h3>

                <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Start</label>
                            <select value={startHour} onChange={e => setStartHour(parseInt(e.target.value))}
                                style={{ width: "100%", padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                                {availableHours.map(h => (
                                    <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>End</label>
                            <select value={endHour} onChange={e => setEndHour(parseInt(e.target.value))}
                                style={{ width: "100%", padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                                {availableHours.filter(h => h > startHour).map(h => (
                                    <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                                ))}
                                {availableHours[availableHours.length - 1] < 24 && (
                                    <option value={24}>24:00</option>
                                )}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Active Player</label>
                        <select value={mainPlayerId} onChange={e => setMainPlayerId(e.target.value)}
                            style={{ width: "100%", padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                            <option value="">-- Select --</option>
                            {players.map(p => {
                                const hourIdx = getHourIndexForLocalHour(dayDate, startHour);
                                const available = isPlayerAvailable(p, hourIdx);
                                return (
                                    <option key={p.id} value={p.id}>
                                        {available ? "🟢" : "🔴"} {p.name} {p.teamAssignment === "joker" ? "(Joker)" : ""}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Sub Player</label>
                        <select value={subPlayerId} onChange={e => setSubPlayerId(e.target.value)}
                            style={{ width: "100%", padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                            <option value="">-- None --</option>
                            {players.filter(p => p.id !== mainPlayerId).map(p => {
                                const hourIdx = getHourIndexForLocalHour(dayDate, startHour);
                                const available = isPlayerAvailable(p, hourIdx);
                                return (
                                    <option key={p.id} value={p.id}>
                                        {available ? "🟢" : "🔴"} {p.name} {p.teamAssignment === "joker" ? "(Joker)" : ""}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
                    {isEdit && onDelete && (
                        <button onClick={onDelete} style={{
                            padding: "8px 16px", borderRadius: 6, border: "none",
                            background: "#dc2626", color: "#fff", cursor: "pointer", marginRight: "auto"
                        }}>
                            🗑️ Delete
                        </button>
                    )}
                    <button onClick={onClose} style={{
                        padding: "8px 16px", borderRadius: 6, border: "1px solid #475569",
                        background: "transparent", color: "#94a3b8", cursor: "pointer"
                    }}>
                        Cancel
                    </button>
                    <button onClick={() => {
                        if (mainPlayerId) {
                            onSave({ startHour, endHour, mainPlayerId, subPlayerId: subPlayerId || null });
                        }
                    }} disabled={!mainPlayerId} style={{
                        padding: "8px 16px", borderRadius: 6, border: "none",
                        background: mainPlayerId ? "#2563eb" : "#475569", color: "#fff", cursor: mainPlayerId ? "pointer" : "not-allowed"
                    }}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

// =============== MAIN COMPONENT ===============
export default function CaptainPage() {
    const params = useParams();
    const teamId = params.teamId as string;

    const [players, setPlayers] = useState<PlayerSummary[]>([]);
    const [slots, setSlots] = useState<CalendarSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tzOffset, setTzOffset] = useState(1); // Default CET

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalDayDate, setModalDayDate] = useState<Date>(new Date());
    const [modalStartHour, setModalStartHour] = useState(0);
    const [editingSlot, setEditingSlot] = useState<CalendarSlot | null>(null);

    // Hover state for delete button
    const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/captain/${teamId}`);
                if (res.ok) {
                    const json = await res.json();
                    setPlayers(json.players || []);

                    // Convert old format to CalendarSlot[]
                    const storedSlots: CalendarSlot[] = [];
                    const rawSlots = json.planning?.slots || {};

                    // Group consecutive hourIndexes by player
                    let currentSlot: CalendarSlot | null = null;

                    for (let i = 0; i <= 68; i++) {
                        const raw = rawSlots[i];
                        if (raw && raw.mainPlayerId) {
                            const playerName = players.find(p => p.id === raw.mainPlayerId)?.name || raw.main_player_name || "Unknown";
                            const subName = raw.subPlayerId ? (players.find(p => p.id === raw.subPlayerId)?.name || raw.sub_player_name) : null;

                            storedSlots.push({
                                hourIndex: i,
                                mainPlayerId: raw.mainPlayerId,
                                mainPlayerName: playerName,
                                subPlayerId: raw.subPlayerId || null,
                                subPlayerName: subName,
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

    const columnDates = getColumnDates(tzOffset);

    const getHourIndexForLocalTime = (dayDate: Date, hour: number): number => {
        const localTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour);
        const utcTime = new Date(localTime.getTime() - tzOffset * 60 * 60 * 1000);
        const diffMs = utcTime.getTime() - EVENT_START_UTC.getTime();
        return Math.floor(diffMs / (60 * 60 * 1000));
    };

    const getLocalHourForIndex = (hourIndex: number): { date: Date; hour: number } => {
        const localTime = getLocalDateForHourIndex(hourIndex, tzOffset);
        return { date: localTime, hour: localTime.getHours() };
    };

    const handleCellClick = (dayDate: Date, hour: number) => {
        const hourIndex = getHourIndexForLocalTime(dayDate, hour);
        if (hourIndex < 0 || hourIndex > 68) return;

        // Check if slot exists
        const existing = slots.find(s => s.hourIndex === hourIndex);
        if (existing) {
            setEditingSlot(existing);
        } else {
            setEditingSlot(null);
        }
        setModalDayDate(dayDate);
        setModalStartHour(hour);
        setModalOpen(true);
    };

    const handleSaveSlot = (data: { startHour: number; endHour: number; mainPlayerId: string; subPlayerId: string | null }) => {
        const newSlots: CalendarSlot[] = [];
        const player = players.find(p => p.id === data.mainPlayerId);
        const subPlayer = data.subPlayerId ? players.find(p => p.id === data.subPlayerId) : null;

        for (let h = data.startHour; h < data.endHour; h++) {
            const hourIndex = getHourIndexForLocalTime(modalDayDate, h);
            if (hourIndex >= 0 && hourIndex <= 68) {
                newSlots.push({
                    hourIndex,
                    mainPlayerId: data.mainPlayerId,
                    mainPlayerName: player?.name || "Unknown",
                    subPlayerId: data.subPlayerId,
                    subPlayerName: subPlayer?.name || null,
                });
            }
        }

        // Remove old slots in this range and add new ones
        setSlots(prev => {
            const hourIndexes = newSlots.map(s => s.hourIndex);
            const filtered = prev.filter(s => !hourIndexes.includes(s.hourIndex));
            return [...filtered, ...newSlots];
        });

        setModalOpen(false);
        setEditingSlot(null);
    };

    const handleDeleteSlot = () => {
        if (editingSlot) {
            setSlots(prev => prev.filter(s => s.hourIndex !== editingSlot.hourIndex));
        }
        setModalOpen(false);
        setEditingSlot(null);
    };

    const saveToServer = async () => {
        setSaving(true);
        try {
            // Convert back to old format
            const slotsObj: Record<number, TeamSlotAssignment> = {};
            for (const slot of slots) {
                slotsObj[slot.hourIndex] = {
                    mainPlayerId: slot.mainPlayerId,
                    subPlayerId: slot.subPlayerId,
                };
            }

            await fetch(`/api/captain/${teamId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slots: slotsObj })
            });
            alert("Saved!");
        } catch {
            alert("Failed to save");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <CaptainAuth teamId={teamId}><div style={{ padding: 20, color: "#fff" }}>Loading...</div></CaptainAuth>;
    if (error) return <CaptainAuth teamId={teamId}><div style={{ padding: 20, color: "#f87171" }}>Error: {error}</div></CaptainAuth>;

    return (
        <CaptainAuth teamId={teamId}>
            <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto", color: "#e2e8f0" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <h1 style={{ fontSize: 24, fontWeight: "bold", margin: 0 }}>
                        Captain Dashboard - {teamId === "joker" ? "🃏 Jokers" : `Team ${teamId.replace("team", "")}`}
                    </h1>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <select value={tzOffset} onChange={e => setTzOffset(parseInt(e.target.value))}
                            style={{ padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                            {TIMEZONES.map(tz => (
                                <option key={tz.offset} value={tz.offset}>{tz.label}</option>
                            ))}
                        </select>
                        <button onClick={saveToServer} disabled={saving} style={{
                            padding: "10px 20px", borderRadius: 6, border: "none",
                            background: "#2563eb", color: "#fff", fontWeight: "bold", cursor: saving ? "wait" : "pointer"
                        }}>
                            {saving ? "Saving..." : "💾 Save Changes"}
                        </button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${columnDates.length}, 1fr)`, background: "#1e293b", borderRadius: 12, overflow: "hidden" }}>
                    {/* Header row */}
                    <div style={{ background: "#0f172a", padding: 12, fontWeight: "bold", textAlign: "center" }}>Time</div>
                    {columnDates.map((date, i) => (
                        <div key={i} style={{ background: "#0f172a", padding: 12, fontWeight: "bold", textAlign: "center", borderLeft: "1px solid #334155" }}>
                            {formatDate(date)}
                        </div>
                    ))}

                    {/* Hour rows */}
                    {Array.from({ length: 24 }).map((_, hour) => (
                        <>
                            <div key={`hour-${hour}`} style={{ padding: 8, textAlign: "right", fontSize: 12, color: "#94a3b8", borderTop: "1px solid #334155" }}>
                                {hour.toString().padStart(2, '0')}:00
                            </div>
                            {columnDates.map((date, dayIdx) => {
                                const hourIndex = getHourIndexForLocalTime(date, hour);
                                const isInEvent = hourIndex >= 0 && hourIndex <= 68;
                                const slot = slots.find(s => s.hourIndex === hourIndex);
                                const isHovered = hoveredSlot === hourIndex;

                                return (
                                    <div
                                        key={`${dayIdx}-${hour}`}
                                        onClick={() => isInEvent && handleCellClick(date, hour)}
                                        onDoubleClick={() => slot && handleCellClick(date, hour)}
                                        onMouseEnter={() => slot && setHoveredSlot(hourIndex)}
                                        onMouseLeave={() => setHoveredSlot(null)}
                                        style={{
                                            borderTop: "1px solid #334155",
                                            borderLeft: "1px solid #334155",
                                            minHeight: 40,
                                            background: isInEvent ? (slot ? getPlayerColor(slot.mainPlayerName) : "#1e293b") : "#0f172a",
                                            cursor: isInEvent ? "pointer" : "default",
                                            position: "relative",
                                            padding: slot ? 4 : 0,
                                            opacity: isInEvent ? 1 : 0.3,
                                        }}
                                    >
                                        {slot && (
                                            <>
                                                <div style={{ fontSize: 12, fontWeight: "bold", color: "#000" }}>{slot.mainPlayerName}</div>
                                                {slot.subPlayerName && (
                                                    <div style={{ fontSize: 10, color: "#1e293b" }}>(Sub: {slot.subPlayerName})</div>
                                                )}
                                                {isHovered && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSlots(prev => prev.filter(s => s.hourIndex !== hourIndex)); }}
                                                        style={{
                                                            position: "absolute", top: 2, right: 2,
                                                            background: "rgba(0,0,0,0.5)", border: "none", borderRadius: 4,
                                                            padding: "2px 6px", cursor: "pointer", fontSize: 12
                                                        }}
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    ))}
                </div>

                {/* Modal */}
                <SlotModal
                    isOpen={modalOpen}
                    onClose={() => { setModalOpen(false); setEditingSlot(null); }}
                    onSave={handleSaveSlot}
                    onDelete={editingSlot ? handleDeleteSlot : undefined}
                    players={players}
                    dayDate={modalDayDate}
                    initialStartHour={modalStartHour}
                    initialEndHour={editingSlot ? modalStartHour + 1 : undefined}
                    initialMainPlayerId={editingSlot?.mainPlayerId}
                    initialSubPlayerId={editingSlot?.subPlayerId}
                    isEdit={!!editingSlot}
                    existingSlots={[]}
                    tzOffset={tzOffset}
                />
            </div>
        </CaptainAuth>
    );
}
