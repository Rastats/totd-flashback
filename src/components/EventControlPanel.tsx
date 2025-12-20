"use client";
// Event Control Panel - Admin component for managing penalties, shields, player switches, progression, versions, and event log

import { useState, useEffect, useCallback } from "react";
import { TEAMS } from "@/lib/config";

// Define penalty types
const PENALTY_TYPES = [
    "Pedal to the Metal",
    "Can't Turn Right", 
    "Russian Roulette",
    "Blind Mode",
    "Mirror Mode",
    "No HUD",
    "First Person Only"
];

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

const sectionStyle = {
    background: "#12121a",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    border: "1px solid #2a2a3a",
};

interface Penalty {
    id: string;
    penalty_team: number;
    penalty_name: string;
    donor_name: string;
    is_active: boolean;
    created_at: string;
}

interface Shield {
    team_id: number;
    active: boolean;
    type: string | null;
    remaining_ms: number;
    expires_at: string | null;
    cooldown_ms: number;
}

interface TeamInfo {
    team_id: number;
    active_player: string | null;
    waiting_player: string | null;
    maps_completed: number;
}

interface EventLogEntry {
    id: string;
    event_type: string;
    team_id: number | null;
    message: string;
    created_at: string;
}

export default function EventControlPanel() {
    const [penalties, setPenalties] = useState<Penalty[]>([]);
    const [shields, setShields] = useState<Shield[]>([]);
    const [teams, setTeams] = useState<TeamInfo[]>([]);
    const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
    const [allowedVersions, setAllowedVersions] = useState<string[]>([]);
    const [teamPots, setTeamPots] = useState<{ team_number: number, amount: number }[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Form states
    const [newPenalty, setNewPenalty] = useState({ team_id: 1, penalty_name: PENALTY_TYPES[0] });
    const [newEventMessage, setNewEventMessage] = useState({ message: "", event_type: "milestone", team_id: "" });
    const [newVersion, setNewVersion] = useState("");
    const [progressUpdate, setProgressUpdate] = useState<Record<number, string>>({});
    const [potCorrection, setPotCorrection] = useState<Record<number, string>>({});

    const fetchData = useCallback(async () => {
        try {
            const [penaltiesRes, shieldsRes, playerSwitchRes, progressRes, versionsRes, eventLogRes, potsRes] = await Promise.all([
                fetch("/api/admin/penalties"),
                fetch("/api/admin/shields"),
                fetch("/api/admin/player-switch"),
                fetch("/api/admin/progression"),
                fetch("/api/admin/versions"),
                fetch("/api/event-log?limit=20"),
                fetch("/api/admin/pots")
            ]);

            if (penaltiesRes.ok) {
                const data = await penaltiesRes.json();
                setPenalties(data.penalties || []);
            }
            if (shieldsRes.ok) {
                const data = await shieldsRes.json();
                setShields(data.shields || []);
            }
            if (playerSwitchRes.ok) {
                const data = await playerSwitchRes.json();
                // Merge with progression data
                const teamsData = data.teams || [];
                if (progressRes.ok) {
                    const progData = await progressRes.json();
                    const merged = teamsData.map((t: any) => ({
                        ...t,
                        maps_completed: progData.teams?.find((p: any) => p.team_id === t.team_id)?.maps_completed || 0
                    }));
                    setTeams(merged);
                } else {
                    setTeams(teamsData);
                }
            }
            if (versionsRes.ok) {
                const data = await versionsRes.json();
                setAllowedVersions(data.versions || []);
            }
            if (eventLogRes.ok) {
                const data = await eventLogRes.json();
                setEventLog(data.events || []);
            }
            if (potsRes.ok) {
                const data = await potsRes.json();
                setTeamPots(data || []);
            }
        } catch (err) {
            console.error("EventControl fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Real-time shield countdown - updates every second
    useEffect(() => {
        const timer = setInterval(() => {
            setShields(prev => prev.map(s => {
                if (s.active && s.remaining_ms > 0) {
                    return { ...s, remaining_ms: Math.max(0, s.remaining_ms - 1000) };
                }
                return s;
            }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // ============= PENALTIES =============
    const MAX_PENALTIES_PER_TEAM = 4; // 2 active + 2 waitlist
    
    const addPenalty = async () => {
        // Check if team has an active shield (blocks penalties)
        const teamShield = shields.find(s => s.team_id === newPenalty.team_id);
        if (teamShield?.active && teamShield.remaining_ms > 0) {
            alert(`Team ${newPenalty.team_id} has an active shield! Penalties are blocked.`);
            return;
        }
        
        // Check if team already has max penalties
        const teamPenalties = penalties.filter(p => p.penalty_team === newPenalty.team_id);
        if (teamPenalties.length >= MAX_PENALTIES_PER_TEAM) {
            alert(`Team ${newPenalty.team_id} already has ${MAX_PENALTIES_PER_TEAM} penalties (max 2 active + 2 waitlist)`);
            return;
        }
        
        const res = await fetch("/api/admin/penalties", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newPenalty)
        });
        if (res.ok) fetchData();
    };

    const removePenalty = async (id: string) => {
        const res = await fetch(`/api/admin/penalties?id=${id}`, { method: "DELETE" });
        if (res.ok) fetchData();
    };

    const togglePenaltyStatus = async (id: string, currentlyActive: boolean) => {
        const newStatus = !currentlyActive;
        const res = await fetch("/api/admin/penalties", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, is_active: newStatus })
        });
        if (res.ok) {
            fetchData();
        } else {
            const err = await res.json();
            alert(err.error || "Failed to toggle penalty status");
        }
    };

    // ============= SHIELDS =============
    const activateShield = async (team_id: number, type: "small" | "big") => {
        // Check if team already has an active shield
        const teamShield = shields.find(s => s.team_id === team_id);
        if (teamShield?.active) {
            alert(`Team ${team_id} already has a shield active! Deactivate it first.`);
            return;
        }
        
        const res = await fetch("/api/admin/shields", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ team_id, type })
        });
        
        if (res.ok) {
            // If Big Shield, clear all penalties for this team (matches plugin behavior)
            if (type === "big") {
                const teamPenaltyIds = penalties.filter(p => p.penalty_team === team_id).map(p => p.id);
                for (const id of teamPenaltyIds) {
                    await fetch(`/api/admin/penalties?id=${id}`, { method: "DELETE" });
                }
            }
            fetchData();
        }
    };

    const deactivateShield = async (team_id: number) => {
        const res = await fetch(`/api/admin/shields?team_id=${team_id}`, { method: "DELETE" });
        if (res.ok) fetchData();
    };

    // ============= PLAYER SWITCH =============
    const forceSwitch = async (team_id: number) => {
        const res = await fetch("/api/admin/player-switch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ team_id })
        });
        if (res.ok) fetchData();
    };

    // ============= PROGRESSION =============
    const updateProgression = async (team_id: number) => {
        const value = parseInt(progressUpdate[team_id] || "0");
        if (isNaN(value)) return alert("Invalid number");
        
        const res = await fetch("/api/admin/progression", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ team_id, maps_completed: value })
        });
        if (res.ok) {
            setProgressUpdate(prev => ({ ...prev, [team_id]: "" }));
            fetchData();
        }
    };

    // ============= POT CORRECTION =============
    const updatePot = async (team_number: number) => {
        const value = parseFloat(potCorrection[team_number] || "0");
        if (isNaN(value)) return alert("Invalid number");
        
        const res = await fetch("/api/admin/pots", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ team_number, amount: value, reason: "Admin correction" })
        });
        if (res.ok) {
            setPotCorrection(prev => ({ ...prev, [team_number]: "" }));
            fetchData();
        }
    };

    const resetProgression = async (team_id: number) => {
        if (!confirm(`Are you sure you want to RESET Team ${team_id} progression to 0?`)) return;
        const res = await fetch(`/api/admin/progression?team_id=${team_id}`, { method: "DELETE" });
        if (res.ok) fetchData();
    };

    // ============= EVENT LOG =============
    const addEventMessage = async () => {
        if (!newEventMessage.message) return;
        const res = await fetch("/api/event-log", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-api-key": "flashback2025"
            },
            body: JSON.stringify({
                event_type: newEventMessage.event_type,
                message: newEventMessage.message,
                team_id: newEventMessage.team_id ? parseInt(newEventMessage.team_id) : null
            })
        });
        if (res.ok) {
            setNewEventMessage({ message: "", event_type: "milestone", team_id: "" });
            fetchData();
        }
    };

    const formatTime = (ms: number) => {
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) return <div>Loading event control...</div>;

    return (
        <div>
            {/* ============= PENALTIES SECTION ============= */}
            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: 16, color: "#f87171" }}>⚠️ Penalties Management</h3>
                
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    <select
                        value={newPenalty.team_id}
                        onChange={(e) => setNewPenalty(prev => ({ ...prev, team_id: parseInt(e.target.value) }))}
                        style={inputStyle}
                    >
                        {TEAMS.map(t => <option key={t.number} value={t.number}>{t.name}</option>)}
                    </select>
                    <select
                        value={newPenalty.penalty_name}
                        onChange={(e) => setNewPenalty(prev => ({ ...prev, penalty_name: e.target.value }))}
                        style={{ ...inputStyle, minWidth: 180 }}
                    >
                        {PENALTY_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={addPenalty} style={{ ...buttonStyle, background: "#dc2626", color: "#fff" }}>
                        + Add Penalty
                    </button>
                </div>

                {/* Penalties per team grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {TEAMS.map(team => {
                        const teamPenalties = penalties.filter(p => p.penalty_team === team.number);
                        const activePenalties = teamPenalties.filter(p => p.is_active);
                        const waitlistPenalties = teamPenalties.filter(p => !p.is_active);
                        return (
                            <div key={team.number} style={{ 
                                padding: 12, 
                                background: "#1a1a2a", 
                                borderRadius: 6,
                                border: `1px solid ${team.color}`,
                                minHeight: 150
                            }}>
                                <div style={{ fontWeight: "bold", color: team.color, marginBottom: 8 }}>{team.name}</div>
                                
                                {/* Active Section */}
                                <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: 10, color: "#f87171", fontWeight: "bold", marginBottom: 4 }}>
                                        🔴 ACTIVE ({activePenalties.length}/2)
                                    </div>
                                    {activePenalties.length === 0 ? (
                                        <div style={{ fontSize: 10, opacity: 0.4, fontStyle: "italic" }}>None</div>
                                    ) : (
                                        activePenalties.map(p => (
                                            <div key={p.id} style={{ 
                                                display: "flex", alignItems: "center", gap: 4,
                                                padding: "2px 4px", background: "#2a1a1a", borderRadius: 3, marginBottom: 2, fontSize: 10
                                            }}>
                                                <span style={{ flex: 1, color: "#f87171" }}>{p.penalty_name}</span>
                                                <button onClick={() => togglePenaltyStatus(p.id, true)} 
                                                    style={{ ...buttonStyle, padding: "1px 4px", background: "#fbbf24", color: "#000", fontSize: 8 }}>↓</button>
                                                <button onClick={() => removePenalty(p.id)} 
                                                    style={{ ...buttonStyle, padding: "1px 4px", background: "#4a1a1a", color: "#f87171", fontSize: 8 }}>✕</button>
                                            </div>
                                        ))
                                    )}
                                </div>
                                
                                {/* Waitlist Section */}
                                <div>
                                    <div style={{ fontSize: 10, color: "#fbbf24", fontWeight: "bold", marginBottom: 4 }}>
                                        ⏳ WAITLIST ({waitlistPenalties.length}/2)
                                    </div>
                                    {waitlistPenalties.length === 0 ? (
                                        <div style={{ fontSize: 10, opacity: 0.4, fontStyle: "italic" }}>None</div>
                                    ) : (
                                        waitlistPenalties.map(p => (
                                            <div key={p.id} style={{ 
                                                display: "flex", alignItems: "center", gap: 4,
                                                padding: "2px 4px", background: "#1a1a1a", borderRadius: 3, marginBottom: 2, fontSize: 10
                                            }}>
                                                <span style={{ flex: 1, color: "#fbbf24" }}>{p.penalty_name}</span>
                                                <button onClick={() => togglePenaltyStatus(p.id, false)} 
                                                    style={{ ...buttonStyle, padding: "1px 4px", background: "#4ade80", color: "#000", fontSize: 8 }}
                                                    disabled={activePenalties.length >= 2}>↑</button>
                                                <button onClick={() => removePenalty(p.id)} 
                                                    style={{ ...buttonStyle, padding: "1px 4px", background: "#4a1a1a", color: "#f87171", fontSize: 8 }}>✕</button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ============= SHIELDS SECTION ============= */}
            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: 16, color: "#34d399" }}>🛡️ Shields Management</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {TEAMS.map(team => {
                        const shield = shields.find(s => s.team_id === team.number);
                        return (
                            <div key={team.number} style={{ 
                                padding: 12, 
                                background: "#1a1a2a", 
                                borderRadius: 6,
                                border: `1px solid ${team.color}`,
                                textAlign: "center"
                            }}>
                                <div style={{ fontWeight: "bold", color: team.color, marginBottom: 8 }}>{team.name}</div>
                                
                                {shield?.active ? (
                                    <div>
                                        <div style={{ color: "#34d399", marginBottom: 4 }}>
                                            {shield.type === "big" ? "🛡️ BIG" : "🛡️ Small"} Active
                                        </div>
                                        <div style={{ fontFamily: "monospace", marginBottom: 8 }}>
                                            {formatTime(shield.remaining_ms)}
                                        </div>
                                        <button 
                                            onClick={() => deactivateShield(team.number)}
                                            style={{ ...buttonStyle, background: "#4a2a2a", color: "#f87171", width: "100%" }}
                                        >
                                            Deactivate
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        {shield?.cooldown_ms && shield.cooldown_ms > 0 ? (
                                            <div style={{ marginBottom: 8 }}>
                                                <div style={{ color: "#fbbf24", fontSize: 11 }}>⏳ Cooldown</div>
                                                <div style={{ fontFamily: "monospace", color: "#fbbf24" }}>
                                                    {formatTime(shield.cooldown_ms)}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div style={{ display: "flex", gap: 4 }}>
                                            <button 
                                                onClick={() => activateShield(team.number, "small")}
                                                style={{ ...buttonStyle, background: "#1a3a2a", color: "#4ade80", flex: 1, fontSize: 11 }}
                                            >
                                                Small (10m)
                                            </button>
                                            <button 
                                                onClick={() => activateShield(team.number, "big")}
                                                style={{ ...buttonStyle, background: "#22543d", color: "#4ade80", flex: 1, fontSize: 11 }}
                                            >
                                                BIG (30m)
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ============= PLAYER MANAGEMENT SECTION ============= */}
            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: 16, color: "#60a5fa" }}>🎮 Player Management</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {TEAMS.map(team => {
                        const info = teams.find(t => t.team_id === team.number);
                        return (
                            <div key={team.number} style={{ 
                                padding: 12, 
                                background: "#1a1a2a", 
                                borderRadius: 6,
                                border: `1px solid ${team.color}`
                            }}>
                                <div style={{ fontWeight: "bold", color: team.color, marginBottom: 8 }}>{team.name}</div>
                                <div style={{ fontSize: 12, marginBottom: 4 }}>
                                    <span style={{ opacity: 0.6 }}>Active:</span> 
                                    <span style={{ color: "#4ade80", marginLeft: 4 }}>{info?.active_player || "None"}</span>
                                </div>
                                <div style={{ fontSize: 12, marginBottom: 8 }}>
                                    <span style={{ opacity: 0.6 }}>Waiting:</span>
                                    <span style={{ color: "#fbbf24", marginLeft: 4 }}>{info?.waiting_player || "None"}</span>
                                </div>
                                <button 
                                    onClick={() => forceSwitch(team.number)}
                                    style={{ ...buttonStyle, background: "#2a3a4a", color: "#60a5fa", width: "100%", fontSize: 11 }}
                                >
                                    🔄 Force Switch
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ============= PROGRESSION SECTION ============= */}
            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: 16, color: "#a78bfa" }}>📊 Progression Management</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {TEAMS.map(team => {
                        const info = teams.find(t => t.team_id === team.number);
                        return (
                            <div key={team.number} style={{ 
                                padding: 12, 
                                background: "#1a1a2a", 
                                borderRadius: 6,
                                border: `1px solid ${team.color}`
                            }}>
                                <div style={{ fontWeight: "bold", color: team.color, marginBottom: 8 }}>{team.name}</div>
                                <div style={{ fontSize: 20, fontWeight: "bold", marginBottom: 8 }}>
                                    {info?.maps_completed || 0} <span style={{ fontSize: 12, opacity: 0.5 }}>/ 2000</span>
                                </div>
                                <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                                    <input
                                        type="number"
                                        placeholder="New value"
                                        value={progressUpdate[team.number] || ""}
                                        onChange={(e) => setProgressUpdate(prev => ({ ...prev, [team.number]: e.target.value }))}
                                        style={{ ...inputStyle, width: 80 }}
                                    />
                                    <button 
                                        onClick={() => updateProgression(team.number)}
                                        style={{ ...buttonStyle, background: "#3a3a5a", color: "#a78bfa" }}
                                    >
                                        Set
                                    </button>
                                </div>
                                <button 
                                    onClick={() => resetProgression(team.number)}
                                    style={{ ...buttonStyle, background: "#4a1a1a", color: "#f87171", width: "100%", fontSize: 11 }}
                                >
                                    ⚠️ Reset to 0
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ============= VERSION CONTROL SECTION ============= */}
            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: 16, color: "#fbbf24" }}>🔐 Version Control</h3>
                
                <div style={{ marginBottom: 12 }}>
                    <span style={{ opacity: 0.7 }}>Currently allowed versions: </span>
                    {allowedVersions.length > 0 ? (
                        allowedVersions.map(v => (
                            <span key={v} style={{ 
                                padding: "2px 8px", 
                                background: "#2a3a2a", 
                                borderRadius: 4, 
                                marginLeft: 4,
                                color: "#4ade80"
                            }}>
                                {v}
                            </span>
                        ))
                    ) : (
                        <span style={{ color: "#fbbf24" }}>All versions allowed (no restriction)</span>
                    )}
                </div>
                
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                        type="text"
                        placeholder="e.g. 1.43.8,1.43.9"
                        value={newVersion}
                        onChange={(e) => setNewVersion(e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                    />
                    <button 
                        onClick={() => {
                            const versions = newVersion.split(",").map(v => v.trim()).filter(v => v);
                            fetch("/api/admin/versions", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ versions })
                            }).then(r => r.json()).then(data => {
                                alert(data.message);
                                setNewVersion("");
                            });
                        }}
                        style={{ ...buttonStyle, background: "#5a5a2a", color: "#fbbf24" }}
                    >
                        Update (Manual Vercel)
                    </button>
                </div>
                <p style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>
                    ⚠️ This only logs the request. Update ALLOWED_PLUGIN_VERSIONS in Vercel dashboard manually.
                </p>
            </div>

            {/* ============= POT CORRECTION SECTION ============= */}
            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: 16, color: "#fbbf24" }}>💰 Team Pots Correction</h3>
                <p style={{ fontSize: 11, opacity: 0.5, marginBottom: 12 }}>
                    Correct team pot amounts directly. No penalties will be triggered.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {TEAMS.map(team => {
                        const pot = teamPots.find(p => p.team_number === team.number);
                        const currentAmount = pot?.amount || 0;
                        return (
                            <div key={team.number} style={{ 
                                padding: 12, 
                                background: "#1a1a2a", 
                                borderRadius: 6,
                                border: `1px solid ${team.color}`
                            }}>
                                <div style={{ fontWeight: "bold", color: team.color, marginBottom: 8 }}>{team.name}</div>
                                <div style={{ fontSize: 12, marginBottom: 8 }}>
                                    Current: <strong>£{currentAmount.toFixed(2)}</strong>
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="New amount"
                                        value={potCorrection[team.number] || ""}
                                        onChange={(e) => setPotCorrection(prev => ({ ...prev, [team.number]: e.target.value }))}
                                        style={{ ...inputStyle, flex: 1, width: 80 }}
                                    />
                                    <button
                                        onClick={() => updatePot(team.number)}
                                        style={{ ...buttonStyle, background: "#fbbf24", color: "#000" }}
                                    >
                                        Set
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ============= EVENT LOG SECTION ============= */}
            <div style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: 16, color: "#f472b6" }}>📢 Event Log</h3>
                
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    <select
                        value={newEventMessage.event_type}
                        onChange={(e) => setNewEventMessage(prev => ({ ...prev, event_type: e.target.value }))}
                        style={inputStyle}
                    >
                        <option value="milestone">Milestone</option>
                        <option value="donation">Donation</option>
                        <option value="penalty_applied">Penalty</option>
                        <option value="shield_activated">Shield</option>
                    </select>
                    <select
                        value={newEventMessage.team_id}
                        onChange={(e) => setNewEventMessage(prev => ({ ...prev, team_id: e.target.value }))}
                        style={inputStyle}
                    >
                        <option value="">No team</option>
                        {TEAMS.map(t => <option key={t.number} value={t.number}>{t.name}</option>)}
                    </select>
                    <input
                        type="text"
                        placeholder="Message..."
                        value={newEventMessage.message}
                        onChange={(e) => setNewEventMessage(prev => ({ ...prev, message: e.target.value }))}
                        style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    />
                    <button onClick={addEventMessage} style={{ ...buttonStyle, background: "#7c3aed", color: "#fff" }}>
                        + Add Message
                    </button>
                </div>

                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                    {eventLog.length === 0 ? (
                        <p style={{ opacity: 0.5 }}>No events yet</p>
                    ) : (
                        eventLog.map(e => (
                            <div key={e.id} style={{ 
                                padding: "8px 12px", 
                                borderLeft: `3px solid ${e.team_id ? TEAMS.find(t => t.number === e.team_id)?.color : "#666"}`,
                                marginBottom: 8,
                                background: "#1a1a2a",
                                borderRadius: "0 4px 4px 0"
                            }}>
                                <div style={{ fontSize: 11, opacity: 0.5 }}>
                                    {new Date(e.created_at).toLocaleTimeString()} • {e.event_type}
                                </div>
                                <div style={{ fontSize: 13 }}>{e.message}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
