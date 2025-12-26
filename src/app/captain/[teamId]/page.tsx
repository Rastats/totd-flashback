"use client";

import { useEffect, useState } from "react";
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
// Event: Dec 26 21:00 CET to Dec 29 18:00 CET (69 hours, indices 0-68)
// CET = UTC+1

// Convert hourIndex (0-68) to local day and hour
const getLocalTimeForHourIndex = (hourIndex: number, tzOffset: number): { day: number; hour: number } => {
    // hourIndex 0 = Dec 26 21:00 CET
    const cetTotalHours = 26 * 24 + 21 + hourIndex; // Day 26, hour 21 + index
    const cetDay = Math.floor(cetTotalHours / 24);
    const cetHour = cetTotalHours % 24;

    // Convert CET to target timezone using proper modular arithmetic
    const offsetDiff = tzOffset - 1; // CET is +1
    const totalLocalHours = cetDay * 24 + cetHour + offsetDiff;
    const localDay = Math.floor(totalLocalHours / 24);
    const localHour = ((totalLocalHours % 24) + 24) % 24; // Handle negative correctly

    return { day: localDay, hour: localHour };
};

// Convert local day+hour back to hourIndex
const getHourIndexForLocal = (localDay: number, localHour: number, tzOffset: number): number => {
    // Convert to CET using proper modular arithmetic
    const offsetDiff = tzOffset - 1;
    const totalLocalHours = localDay * 24 + localHour;
    const totalCetHours = totalLocalHours - offsetDiff;

    // Calculate hourIndex
    const startTotalHours = 26 * 24 + 21; // Dec 26, 21:00 CET
    return totalCetHours - startTotalHours;
};

// Get column days for timezone
const getColumnDays = (tzOffset: number): number[] => {
    const start = getLocalTimeForHourIndex(0, tzOffset);
    const end = getLocalTimeForHourIndex(68, tzOffset);
    const days: number[] = [];
    for (let d = start.day; d <= end.day; d++) days.push(d);
    return days;
};

// =============== AVAILABILITY CHECK ===============
const isPlayerAvailable = (player: PlayerSummary, hourIndex: number): boolean => {
    let dateStr = "";
    let hour = 0;
    if (hourIndex < 3) {
        dateStr = "2025-12-26";
        hour = 21 + hourIndex;
    } else {
        const offsetIndex = hourIndex - 3;
        const dayOffset = Math.floor(offsetIndex / 24);
        hour = offsetIndex % 24;
        dateStr = ["2025-12-27", "2025-12-28", "2025-12-29"][dayOffset] || "2025-12-29";
    }
    return !!player.availability.find(s => s.date === dateStr && hour >= s.startHour && hour < s.endHour);
};

// =============== MODAL COMPONENT ===============
interface SlotModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { startHour: number; endHour: number; mainPlayerId: string; subPlayerId: string | null }) => void;
    onDelete?: () => void;
    players: PlayerSummary[];
    day: number;
    initialStartHour: number;
    initialEndHour?: number;
    initialMainPlayerId?: string;
    initialSubPlayerId?: string | null;
    isEdit?: boolean;
    tzOffset: number;
}

function SlotModal({ isOpen, onClose, onSave, onDelete, players, day, initialStartHour, initialEndHour, initialMainPlayerId, initialSubPlayerId, isEdit, tzOffset }: SlotModalProps) {
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

    // Find valid hours for this day
    const validHours: number[] = [];
    for (let h = 0; h < 24; h++) {
        const idx = getHourIndexForLocal(day, h, tzOffset);
        if (idx >= 0 && idx <= 68) validHours.push(h);
    }

    const checkHourIdx = getHourIndexForLocal(day, startHour, tzOffset);

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
            <div style={{ background: "#1e293b", borderRadius: 12, padding: 24, minWidth: 380, border: "1px solid #475569" }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#e2e8f0" }}>
                    {isEdit ? "Edit Slot" : "Add Slot"} - Dec {day}
                </h3>

                <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Start</label>
                            <select value={startHour} onChange={e => setStartHour(parseInt(e.target.value))} style={{ width: "100%", padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                                {validHours.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>End</label>
                            <select value={endHour} onChange={e => setEndHour(parseInt(e.target.value))} style={{ width: "100%", padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                                {validHours.filter(h => h > startHour).map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Active Player</label>
                        <select value={mainPlayerId} onChange={e => setMainPlayerId(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                            <option value="">-- Select --</option>
                            {players.map(p => (
                                <option key={p.id} value={p.id}>
                                    {isPlayerAvailable(p, checkHourIdx) ? "🟢" : "🔴"} {p.name} {p.teamAssignment === 0 ? "(Joker)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Sub Player</label>
                        <select value={subPlayerId} onChange={e => setSubPlayerId(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                            <option value="">-- None --</option>
                            {players.filter(p => p.id !== mainPlayerId).map(p => (
                                <option key={p.id} value={p.id}>
                                    {isPlayerAvailable(p, checkHourIdx) ? "🟢" : "🔴"} {p.name} {p.teamAssignment === 0 ? "(Joker)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
                    {isEdit && onDelete && (
                        <button onClick={onDelete} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", marginRight: "auto" }}>🗑️ Delete</button>
                    )}
                    <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #475569", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => mainPlayerId && onSave({ startHour, endHour, mainPlayerId, subPlayerId: subPlayerId || null })} disabled={!mainPlayerId} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: mainPlayerId ? "#2563eb" : "#475569", color: "#fff", cursor: mainPlayerId ? "pointer" : "not-allowed" }}>Save</button>
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
    const [tzOffset, setTzOffset] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalDay, setModalDay] = useState(26);
    const [modalStartHour, setModalStartHour] = useState(0);
    const [editingSlot, setEditingSlot] = useState<CalendarSlot | null>(null);
    const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/captain/${teamId}`);
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

    const handleCellClick = (day: number, hour: number) => {
        const hourIndex = getHourIndexForLocal(day, hour, tzOffset);
        if (hourIndex < 0 || hourIndex > 68) return;
        const existing = slots.find(s => s.hourIndex === hourIndex);
        setEditingSlot(existing || null);
        setModalDay(day);
        setModalStartHour(hour);
        setModalOpen(true);
    };

    const handleSaveSlot = (data: { startHour: number; endHour: number; mainPlayerId: string; subPlayerId: string | null }) => {
        const player = players.find(p => p.id === data.mainPlayerId);
        const subPlayer = data.subPlayerId ? players.find(p => p.id === data.subPlayerId) : null;

        const newSlots: CalendarSlot[] = [];
        for (let h = data.startHour; h < data.endHour; h++) {
            const hourIndex = getHourIndexForLocal(modalDay, h, tzOffset);
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

        setSlots(prev => {
            const idxs = newSlots.map(s => s.hourIndex);
            return [...prev.filter(s => !idxs.includes(s.hourIndex)), ...newSlots];
        });
        setModalOpen(false);
        setEditingSlot(null);
    };

    const handleDeleteSlot = () => {
        if (editingSlot) setSlots(prev => prev.filter(s => s.hourIndex !== editingSlot.hourIndex));
        setModalOpen(false);
        setEditingSlot(null);
    };

    const saveToServer = async () => {
        setSaving(true);
        try {
            // Fetch current server state to check for conflicts
            const checkRes = await fetch(`/api/captain/${teamId}`);
            if (checkRes.ok) {
                const serverData = await checkRes.json();
                const serverSlots = serverData.planning?.slots || {};

                // Find conflicting slots (different mainPlayerId for same hourIndex)
                const conflicts: number[] = [];
                for (const slot of slots) {
                    const serverSlot = serverSlots[slot.hourIndex];
                    if (serverSlot?.mainPlayerId && serverSlot.mainPlayerId !== slot.mainPlayerId) {
                        conflicts.push(slot.hourIndex);
                    }
                }

                if (conflicts.length > 0) {
                    const proceed = confirm(
                        `⚠️ Conflict detected!\n\n` +
                        `${conflicts.length} slot(s) were modified by another captain.\n` +
                        `Overwrite server changes?`
                    );
                    if (!proceed) {
                        setSaving(false);
                        // Reload to get latest
                        window.location.reload();
                        return;
                    }
                }
            }

            const slotsObj: Record<number, TeamSlotAssignment> = {};
            for (const slot of slots) {
                slotsObj[slot.hourIndex] = { mainPlayerId: slot.mainPlayerId, subPlayerId: slot.subPlayerId };
            }
            await fetch(`/api/captain/${teamId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots: slotsObj }) });
            alert("Saved!");
        } catch { alert("Failed to save"); }
        finally { setSaving(false); }
    };

    if (loading) return <CaptainAuth teamId={teamId}><div style={{ padding: 20, color: "#fff" }}>Loading...</div></CaptainAuth>;
    if (error) return <CaptainAuth teamId={teamId}><div style={{ padding: 20, color: "#f87171" }}>Error: {error}</div></CaptainAuth>;

    return (
        <CaptainAuth teamId={teamId}>
            <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto", color: "#e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <h1 style={{ fontSize: 24, fontWeight: "bold", margin: 0 }}>
                        Captain Dashboard - {teamId === "0" ? "🃏 Jokers" : `Team ${teamId.replace("team", "")}`}
                    </h1>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <select value={tzOffset} onChange={e => setTzOffset(parseFloat(e.target.value))} style={{ padding: 8, borderRadius: 6, background: "#334155", color: "#fff", border: "1px solid #475569" }}>
                            {TIMEZONES.map(tz => <option key={tz.label} value={tz.offset}>{tz.label}</option>)}
                        </select>
                        <button onClick={saveToServer} disabled={saving} style={{ padding: "10px 20px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", fontWeight: "bold", cursor: saving ? "wait" : "pointer" }}>
                            {saving ? "Saving..." : "💾 Save Changes"}
                        </button>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${columnDays.length}, 1fr)`, background: "#1e293b", borderRadius: 12, overflow: "hidden" }}>
                    {/* Play Time Stats */}
                    <div style={{ gridColumn: `1 / span ${columnDays.length + 1}`, padding: "16px", background: "#0f172a", borderBottom: "1px solid #334155" }}>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontSize: 13, fontWeight: "bold", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Play Time Stats:</span>
                            {players.filter(p => {
                                // Show if:
                                // 1. Belongs to this team
                                // 2. OR is showing on the schedule (even if Joker)
                                const isActive = slots.some(s => s.mainPlayerId === p.id || s.subPlayerId === p.id);
                                return p.teamAssignment === parseInt(teamId) || isActive;
                            }).map(p => {
                                const activeCount = slots.filter(s => s.mainPlayerId === p.id).length;
                                const subCount = slots.filter(s => s.subPlayerId === p.id).length;
                                const color = getPlayerColor(p.name);

                                return (
                                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                                        <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{p.name}:</span>
                                        <span style={{ color: "#fff", fontWeight: "bold" }}>{activeCount}h</span>
                                        <span style={{ color: "#64748b" }}>(Sub: {subCount}h)</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ background: "#0f172a", padding: 12, fontWeight: "bold", textAlign: "center", borderTop: "1px solid #334155" }}>Time</div>
                    {columnDays.map(day => <div key={day} style={{ background: "#0f172a", padding: 12, fontWeight: "bold", textAlign: "center", borderLeft: "1px solid #334155", borderTop: "1px solid #334155" }}>Dec {day}</div>)}

                    {Array.from({ length: 24 }).map((_, hour) => (
                        <div key={hour} style={{ display: "contents" }}>
                            <div style={{ padding: 8, textAlign: "right", fontSize: 12, color: "#94a3b8", borderTop: "1px solid #334155" }}>{hour.toString().padStart(2, '0')}:00</div>
                            {columnDays.map(day => {
                                const hourIndex = getHourIndexForLocal(day, hour, tzOffset);
                                const isInEvent = hourIndex >= 0 && hourIndex <= 68;
                                const slot = slots.find(s => s.hourIndex === hourIndex);
                                const isHovered = hoveredSlot === hourIndex;

                                // Check availability status
                                const availablePlayers = isInEvent ? players.filter(p => isPlayerAvailable(p, hourIndex)) : [];
                                const anyPlayerAvailable = availablePlayers.length > 0;
                                const twoOrMoreAvailable = availablePlayers.length >= 2;
                                const mainPlayerUnavailable = slot && !players.find(p => p.id === slot.mainPlayerId && isPlayerAvailable(p, hourIndex));
                                const subPlayerUnavailable = slot?.subPlayerId && !players.find(p => p.id === slot.subPlayerId && isPlayerAvailable(p, hourIndex));

                                // Indicators:
                                // 🟡 = empty slot but players available
                                // 🔵 = has active but no sub, and 2+ players available  
                                // ⚠️ = player scheduled outside their availability
                                const showEmptyWarning = isInEvent && !slot && anyPlayerAvailable;
                                const showMissingSubWarning = isInEvent && slot && !slot.subPlayerId && twoOrMoreAvailable;

                                return (
                                    <div
                                        key={`${day}-${hour}`}
                                        onClick={() => isInEvent && handleCellClick(day, hour)}
                                        onMouseEnter={() => slot && setHoveredSlot(hourIndex)}
                                        onMouseLeave={() => setHoveredSlot(null)}
                                        style={{
                                            borderTop: "1px solid #334155",
                                            borderLeft: "1px solid #334155",
                                            minHeight: 40,
                                            background: isInEvent ? (slot ? getPlayerColor(slot.mainPlayerName) : "#1e293b") : "#080b10",
                                            cursor: isInEvent ? "pointer" : "default",
                                            position: "relative",
                                            padding: slot ? 4 : 0,
                                            opacity: isInEvent ? 1 : 0.4,
                                            backgroundImage: isInEvent ? undefined : "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.3) 5px, rgba(0,0,0,0.3) 10px)",
                                        }}
                                    >
                                        {/* Empty slot but players available indicator */}
                                        {showEmptyWarning && (
                                            <div style={{
                                                position: "absolute",
                                                top: "50%",
                                                left: "50%",
                                                transform: "translate(-50%, -50%)",
                                                fontSize: 16,
                                                opacity: 0.6
                                            }} title="Empty slot - players available">
                                                🟡
                                            </div>
                                        )}
                                        {slot && (
                                            <>
                                                <div style={{ fontSize: 11, fontWeight: "bold", color: "#000" }}>
                                                    {slot.mainPlayerName}
                                                    {mainPlayerUnavailable && <span title="Main player unavailable"> ⚠️</span>}
                                                </div>
                                                {slot.subPlayerName ? (
                                                    <div style={{ fontSize: 9, color: "#1e293b" }}>
                                                        (Sub: {slot.subPlayerName}{subPlayerUnavailable && " ⚠️"})
                                                    </div>
                                                ) : showMissingSubWarning && (
                                                    <div style={{ fontSize: 9, color: "#1e3a5f" }} title="No sub assigned but 2+ players available">
                                                        +{availablePlayers.length - 1} dispo 🔵
                                                    </div>
                                                )}
                                                {isHovered && (
                                                    <button onClick={e => { e.stopPropagation(); setSlots(prev => prev.filter(s => s.hourIndex !== hourIndex)); }} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: 12, color: "#fff" }}>🗑️</button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <SlotModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditingSlot(null); }} onSave={handleSaveSlot} onDelete={editingSlot ? handleDeleteSlot : undefined} players={players} day={modalDay} initialStartHour={modalStartHour} initialEndHour={editingSlot ? modalStartHour + 1 : undefined} initialMainPlayerId={editingSlot?.mainPlayerId} initialSubPlayerId={editingSlot?.subPlayerId} isEdit={!!editingSlot} tzOffset={tzOffset} />
            </div>
        </CaptainAuth>
    );
}
