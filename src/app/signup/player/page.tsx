"use client";
// src/app/signup/player/page.tsx

import { useState, useMemo, FormEvent, useEffect, useRef } from "react";
import Link from "next/link";
import { COMMON_TIMEZONES, LANGUAGES, getEventDays, getHoursOptions, EVENT_START_UTC, EVENT_END_UTC } from "@/lib/timezones";
import type { AvailabilitySlot, PreferenceLevel } from "@/lib/types";

interface AvailabilityEntry {
    id: string;
    date: string;
    startHour: number;
    endHour: number;
    preference: PreferenceLevel;
}

const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #444",
    background: "#1a1a2e",
    color: "#fff",
    fontSize: 14,
};

const labelStyle = {
    display: "block",
    marginBottom: 6,
    fontWeight: 500 as const,
    fontSize: 14,
};

const sectionStyle = {
    marginBottom: 32,
    padding: 20,
    background: "#12121a",
    borderRadius: 8,
    border: "1px solid #2a2a3a",
};

export default function PlayerSignupPage() {
    const [formData, setFormData] = useState({
        discordUsername: "",
        trackmaniaId: "",
        trackmaniaName: "",
        timezone: "",
        languages: ["English"],
        fastLearnLevel: 5,
        pcConfirmed: false,
        wantsCaptain: false,
        willingJoker: false,
        comingAsGroup: false,
        wantedTeammates: "",
        playerNotes: "",
        canStream: false,
        twitchUsername: "",
        can720p30: false,
        canRelayTeammate: false,
        teammateWillStream: false,
        isFlexible: false,
        maxHoursPerDay: 4,
        acceptedRules: false,
        consentPublicDisplay: false,
    });

    const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const eventDays = useMemo(() => getEventDays(formData.timezone), [formData.timezone]);
    const hoursOptions = getHoursOptions();
    const previousTimezone = useRef<string>("");

    // Convert availability slots when timezone changes (with proper day-crossing support)
    useEffect(() => {
        const oldTz = previousTimezone.current;
        const newTz = formData.timezone;

        if (oldTz && newTz && oldTz !== newTz && availability.length > 0) {
            const newEventDays = getEventDays(newTz);

            // Convert each slot's date+hours from old timezone to new timezone
            const convertedSlots: AvailabilityEntry[] = [];

            for (const slot of availability) {
                const [year, month, day] = slot.date.split('-').map(Number);

                // Create a "wall clock" time in the old timezone and find its UTC equivalent
                // We do this by finding what UTC time displays as the slot's start hour in oldTz
                // Approach: create a Date, format it in oldTz, and adjust until it matches

                // Step 1: Estimate UTC time for this slot's start hour in old timezone
                // Create a date at midnight UTC for this day
                const baseUtc = new Date(Date.UTC(year, month - 1, day, slot.startHour, 0, 0));

                // Get what hour this UTC time shows in the old timezone
                const oldTzFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: oldTz,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    hour12: false,
                });

                // Parse the old timezone display to find the offset
                const oldParts = oldTzFormatter.formatToParts(baseUtc);
                const oldDisplayHour = parseInt(oldParts.find(p => p.type === 'hour')?.value || '0');
                const oldDisplayDay = parseInt(oldParts.find(p => p.type === 'day')?.value || '1');

                // Calculate hours difference: if oldTz shows 12 when we set UTC to slot.startHour,
                // we need to adjust by (slot.startHour - oldDisplayHour)
                const hourAdjustment = slot.startHour - oldDisplayHour;
                const dayAdjustment = day - oldDisplayDay;

                // Create the actual UTC time that corresponds to this slot in the old timezone
                const startUtc = new Date(baseUtc.getTime() + (hourAdjustment + dayAdjustment * 24) * 60 * 60 * 1000);
                const endUtc = new Date(startUtc.getTime() + (slot.endHour - slot.startHour) * 60 * 60 * 1000);

                // Now convert this UTC time to the new timezone
                const newTzFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: newTz,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    hour12: false,
                });

                const startParts = newTzFormatter.formatToParts(startUtc);
                const endParts = newTzFormatter.formatToParts(endUtc);

                const newStartYear = parseInt(startParts.find(p => p.type === 'year')?.value || '2025');
                const newStartMonth = parseInt(startParts.find(p => p.type === 'month')?.value || '1');
                const newStartDay = parseInt(startParts.find(p => p.type === 'day')?.value || '1');
                const newStartHour = parseInt(startParts.find(p => p.type === 'hour')?.value || '0');

                const newEndYear = parseInt(endParts.find(p => p.type === 'year')?.value || '2025');
                const newEndMonth = parseInt(endParts.find(p => p.type === 'month')?.value || '1');
                const newEndDay = parseInt(endParts.find(p => p.type === 'day')?.value || '1');
                const newEndHour = parseInt(endParts.find(p => p.type === 'hour')?.value || '0');

                const newStartDate = `${newStartYear}-${String(newStartMonth).padStart(2, '0')}-${String(newStartDay).padStart(2, '0')}`;
                const newEndDate = `${newEndYear}-${String(newEndMonth).padStart(2, '0')}-${String(newEndDay).padStart(2, '0')}`;

                // Check if this slot still falls within the event days for the new timezone
                const startDayInfo = newEventDays.find(d => d.date === newStartDate);

                if (startDayInfo) {
                    // If end is on a different day than start, we need to split or clamp
                    if (newStartDate === newEndDate) {
                        // Same day - simple case
                        convertedSlots.push({
                            ...slot,
                            date: newStartDate,
                            startHour: Math.max(startDayInfo.startHour, newStartHour),
                            endHour: Math.min(startDayInfo.endHour, newEndHour === 0 ? 24 : newEndHour),
                        });
                    } else {
                        // Slot crosses midnight in new timezone - clamp to end of start day
                        convertedSlots.push({
                            ...slot,
                            date: newStartDate,
                            startHour: Math.max(startDayInfo.startHour, newStartHour),
                            endHour: startDayInfo.endHour, // End at midnight
                        });

                        // Add continuation on new day if it exists in event days
                        const endDayInfo = newEventDays.find(d => d.date === newEndDate);
                        if (endDayInfo && newEndHour > endDayInfo.startHour) {
                            convertedSlots.push({
                                id: `${slot.id}-cont`,
                                date: newEndDate,
                                startHour: endDayInfo.startHour,
                                endHour: Math.min(endDayInfo.endHour, newEndHour === 0 ? 24 : newEndHour),
                                preference: slot.preference,
                            });
                        }
                    }
                }
            }

            // Filter out invalid slots (where end <= start)
            const validSlots = convertedSlots.filter(s => s.endHour > s.startHour);

            setAvailability(validSlots);
        }

        previousTimezone.current = newTz;
    }, [formData.timezone]);

    const addAvailabilitySlot = (date: string) => {
        // Find the day to get valid start/end hours
        const day = eventDays.find(d => d.date === date);
        if (!day) return;

        const slotsOnDay = availability.filter(s => s.date === date).sort((a, b) => a.startHour - b.startHour);

        // Find the next available slot that doesn't overlap
        let newStart = day.startHour;
        let newEnd = Math.min(newStart + 3, day.endHour);

        // If there are existing slots, try to find a gap or start after the last one
        if (slotsOnDay.length > 0) {
            // Try to find a gap between slots or after the last slot
            let foundSlot = false;

            // First, check if we can fit before the first slot
            if (slotsOnDay[0].startHour >= day.startHour + 1) {
                newStart = day.startHour;
                newEnd = Math.min(newStart + 3, slotsOnDay[0].startHour);
                if (newEnd > newStart) {
                    foundSlot = true;
                }
            }

            // Check gaps between slots
            if (!foundSlot) {
                for (let i = 0; i < slotsOnDay.length - 1; i++) {
                    const gapStart = slotsOnDay[i].endHour;
                    const gapEnd = slotsOnDay[i + 1].startHour;
                    if (gapEnd - gapStart >= 1) {
                        newStart = gapStart;
                        newEnd = Math.min(gapStart + 3, gapEnd);
                        foundSlot = true;
                        break;
                    }
                }
            }

            // If no gap found, try after the last slot
            if (!foundSlot) {
                const lastSlot = slotsOnDay[slotsOnDay.length - 1];
                if (lastSlot.endHour < day.endHour) {
                    newStart = lastSlot.endHour;
                    newEnd = Math.min(newStart + 3, day.endHour);
                } else {
                    setError("No more available time on this day");
                    return;
                }
            }
        }

        // Final check for overlap (shouldn't happen now, but safety check)
        const hasOverlap = slotsOnDay.some(s =>
            (newStart < s.endHour && newEnd > s.startHour)
        );

        if (hasOverlap || newEnd <= newStart) {
            setError("No more available time on this day");
            return;
        }

        setError("");
        setAvailability([
            ...availability,
            {
                id: `${Date.now()}-${Math.random()}`,
                date,
                startHour: newStart,
                endHour: newEnd,
                preference: "ok",
            },
        ]);
    };

    const updateSlot = (id: string, field: keyof AvailabilityEntry, value: number | string) => {
        let updatedSlots = availability.map((s) => (s.id === id ? { ...s, [field]: value } : s));

        // If changing startHour, ensure endHour is still valid (> startHour)
        const updatedSlot = updatedSlots.find(s => s.id === id)!;
        if (field === "startHour" && updatedSlot.endHour <= (value as number)) {
            updatedSlots = updatedSlots.map(s =>
                s.id === id ? { ...s, endHour: (value as number) + 1 } : s
            );
        }
        // If changing endHour, ensure it's > startHour
        if (field === "endHour" && (value as number) <= updatedSlot.startHour) {
            setError("End hour must be after start hour");
            return;
        }

        // Check for overlaps after update
        const finalSlot = updatedSlots.find(s => s.id === id)!;
        const otherSlotsOnDay = updatedSlots.filter(s => s.date === finalSlot.date && s.id !== id);
        const hasOverlap = otherSlotsOnDay.some(s =>
            (finalSlot.startHour < s.endHour && finalSlot.endHour > s.startHour)
        );

        if (hasOverlap) {
            setError("This slot overlaps with another slot on the same day");
            return; // Block the update
        }

        setError("");
        setAvailability(updatedSlots);
    };

    const removeSlot = (id: string) => {
        setError("");
        setAvailability(availability.filter((s) => s.id !== id));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const response = await fetch("/api/signup/player", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    formData,
                    availability: availability.map(({ date, startHour, endHour, preference }) => ({
                        date,
                        startHour,
                        endHour,
                        preference,
                    })),
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to submit application");
            }

            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <main style={{ maxWidth: 700, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
                <div style={{ textAlign: "center", padding: 40 }}>
                    <h1 style={{ color: "#4ade80", marginBottom: 16 }}>✅ Application Submitted!</h1>
                    <p style={{ marginBottom: 24 }}>Thank you for signing up as a player. The staff will review your application.</p>
                    <Link href="/" style={{ color: "#60a5fa" }}>← Back to Home</Link>
                </div>
            </main>
        );
    }

    return (
        <main style={{ maxWidth: 700, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
            <Link href="/" style={{ opacity: 0.7, marginBottom: 16, display: "inline-block" }}>← Back to Home</Link>

            <h1 style={{ fontSize: 32, marginBottom: 8 }}>Sign up as player</h1>
            <p style={{ opacity: 0.85, marginBottom: 32 }}>Fill out this form to apply for TOTD Flashback.</p>

            {error && (
                <div style={{ padding: 16, background: "#4a1a1a", borderRadius: 8, marginBottom: 24, color: "#f87171" }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* IDENTITY */}
                <div style={sectionStyle}>
                    <h2 style={{ marginBottom: 16, fontSize: 20 }}>Identity</h2>

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Discord Username *</label>
                        <input
                            type="text"
                            placeholder="username#1234 or just username"
                            value={formData.discordUsername}
                            onChange={(e) => setFormData({ ...formData, discordUsername: e.target.value })}
                            required
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>
                            Trackmania Account ID *
                            <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 8 }}>(from trackmania.io profile URL)</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. f85820ca-7b64-4aea-b2dc-ce22621d4620"
                            value={formData.trackmaniaId}
                            onChange={(e) => setFormData({ ...formData, trackmaniaId: e.target.value })}
                            required
                            style={inputStyle}
                        />
                        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                            Find it at trackmania.io → your profile → copy ID from URL
                        </p>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>In-game Name</label>
                        <input
                            type="text"
                            placeholder="Your Trackmania display name"
                            value={formData.trackmaniaName}
                            onChange={(e) => setFormData({ ...formData, trackmaniaName: e.target.value })}
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Timezone *</label>
                        <select
                            value={formData.timezone}
                            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                            required
                            style={inputStyle}
                        >
                            <option value="">Select your timezone</option>
                            {COMMON_TIMEZONES.map((tz) => (
                                <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* AVAILABILITY - Right after timezone */}
                    {formData.timezone && (
                        <div style={{ marginBottom: 16, padding: 16, background: "#0a0a12", borderRadius: 8, border: "1px solid #2a2a3a" }}>
                            <label style={labelStyle}>Availability (in your timezone: {formData.timezone})</label>
                            {eventDays.map((day) => (
                                <div key={day.date} style={{ marginBottom: 16 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <strong style={{ fontSize: 14 }}>{day.label}</strong>
                                        <button
                                            type="button"
                                            onClick={() => addAvailabilitySlot(day.date)}
                                            style={{
                                                padding: "4px 10px",
                                                background: "#2a3a4a",
                                                border: "1px solid #3a4a5a",
                                                borderRadius: 4,
                                                color: "#fff",
                                                cursor: "pointer",
                                                fontSize: 12,
                                            }}
                                        >
                                            + Add slot
                                        </button>
                                    </div>
                                    {availability
                                        .filter((s) => s.date === day.date)
                                        .map((slot) => (
                                            <div key={slot.id} style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                                                <select
                                                    value={slot.startHour}
                                                    onChange={(e) => updateSlot(slot.id, "startHour", parseInt(e.target.value))}
                                                    style={{ ...inputStyle, width: "auto", padding: "6px 8px", fontSize: 13 }}
                                                >
                                                    {hoursOptions.filter(h => h.value >= day.startHour && h.value < day.endHour).map((h) => (
                                                        <option key={h.value} value={h.value}>{h.label}</option>
                                                    ))}
                                                </select>
                                                <span>→</span>
                                                <select
                                                    value={slot.endHour}
                                                    onChange={(e) => updateSlot(slot.id, "endHour", parseInt(e.target.value))}
                                                    style={{ ...inputStyle, width: "auto", padding: "6px 8px", fontSize: 13 }}
                                                >
                                                    {hoursOptions.filter(h => h.value > slot.startHour && h.value <= day.endHour).map((h) => (
                                                        <option key={h.value} value={h.value}>{h.label}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={slot.preference}
                                                    onChange={(e) => updateSlot(slot.id, "preference", e.target.value)}
                                                    style={{ ...inputStyle, width: "auto", padding: "6px 8px", fontSize: 13 }}
                                                >
                                                    <option value="ok">OK</option>
                                                    <option value="preferred">Preferred</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => removeSlot(slot.id)}
                                                    style={{
                                                        padding: "4px 8px",
                                                        background: "#4a2a2a",
                                                        border: "1px solid #6a3a3a",
                                                        borderRadius: 4,
                                                        color: "#f87171",
                                                        cursor: "pointer",
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    {availability.filter((s) => s.date === day.date).length === 0 && (
                                        <p style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>No slots added</p>
                                    )}
                                </div>
                            ))}
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.isFlexible}
                                        onChange={(e) => setFormData({ ...formData, isFlexible: e.target.checked })}
                                    />
                                    I&apos;m flexible / on-call
                                </label>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <label style={{ ...labelStyle, fontSize: 13, marginBottom: 0 }}>Max hours/day:</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={12}
                                        value={formData.maxHoursPerDay}
                                        onChange={(e) => setFormData({ ...formData, maxHoursPerDay: parseInt(e.target.value) || 1 })}
                                        style={{ ...inputStyle, width: 60, textAlign: "center" }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Languages spoken</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {LANGUAGES.map((lang) => (
                                <label
                                    key={lang}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "6px 12px",
                                        background: formData.languages.includes(lang) ? "#3b82f633" : "#1a1a2e",
                                        border: formData.languages.includes(lang) ? "1px solid #3b82f6" : "1px solid #333",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                        fontSize: 13,
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.languages.includes(lang)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setFormData({ ...formData, languages: [...formData.languages, lang] });
                                            } else {
                                                const newLangs = formData.languages.filter((l) => l !== lang);
                                                setFormData({ ...formData, languages: newLangs.length > 0 ? newLangs : ["English"] });
                                            }
                                        }}
                                        style={{ display: "none" }}
                                    />
                                    {lang}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Fast-learning level (1-10)</label>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, fastLearnLevel: level })}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        border: formData.fastLearnLevel === level ? "2px solid #3b82f6" : "1px solid #444",
                                        background: formData.fastLearnLevel === level ? "#3b82f6" : "#1a1a2e",
                                        color: "#fff",
                                        fontWeight: formData.fastLearnLevel === level ? 600 : 400,
                                        cursor: "pointer",
                                        fontSize: 14,
                                    }}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>How quickly do you adapt to new or forgotten tracks?</p>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                            type="checkbox"
                            checked={formData.pcConfirmed}
                            onChange={(e) => setFormData({ ...formData, pcConfirmed: e.target.checked })}
                            required
                        />
                        <span>I confirm I play Trackmania on PC *</span>
                    </label>
                </div>

                {/* TEAM BUILDING */}
                <div style={sectionStyle}>
                    <h2 style={{ marginBottom: 16, fontSize: 20 }}>Team Building</h2>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={formData.wantsCaptain}
                                onChange={(e) => setFormData({ ...formData, wantsCaptain: e.target.checked })}
                            />
                            I want to be team captain
                        </label>

                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={formData.willingJoker}
                                onChange={(e) => setFormData({ ...formData, willingJoker: e.target.checked })}
                            />
                            I&apos;m willing to be a Joker/Substitute (no fixed team)
                        </label>

                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={formData.comingAsGroup}
                                onChange={(e) => setFormData({ ...formData, comingAsGroup: e.target.checked })}
                            />
                            I&apos;m coming as a group with friends
                        </label>
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <label style={labelStyle}>People I want to team with (Trackmania usernames)</label>
                        <input
                            type="text"
                            placeholder="comma-separated: Player1, Player2"
                            value={formData.wantedTeammates}
                            onChange={(e) => setFormData({ ...formData, wantedTeammates: e.target.value })}
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <label style={labelStyle}>Notes for staff</label>
                        <textarea
                            placeholder="Anything else we should know?"
                            value={formData.playerNotes}
                            onChange={(e) => setFormData({ ...formData, playerNotes: e.target.value })}
                            style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                        />
                    </div>
                </div>

                {/* STREAMING */}
                <div style={sectionStyle}>
                    <h2 style={{ marginBottom: 16, fontSize: 20 }}>Streaming</h2>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <input
                            type="checkbox"
                            checked={formData.canStream}
                            onChange={(e) => setFormData({ ...formData, canStream: e.target.checked })}
                        />
                        I can stream during my shifts
                    </label>

                    {formData.canStream && (
                        <>
                            <div style={{ marginBottom: 16 }}>
                                <label style={labelStyle}>Twitch Username *</label>
                                <input
                                    type="text"
                                    placeholder="yourchannel"
                                    value={formData.twitchUsername}
                                    onChange={(e) => setFormData({ ...formData, twitchUsername: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.can720p30}
                                        onChange={(e) => setFormData({ ...formData, can720p30: e.target.checked })}
                                    />
                                    I can stream at minimum 720p30 quality
                                </label>

                                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.canRelayTeammate}
                                        onChange={(e) => setFormData({ ...formData, canRelayTeammate: e.target.checked })}
                                    />
                                    I can relay a teammate&apos;s POV (screen share / restream)
                                </label>
                            </div>
                        </>
                    )}

                    {!formData.canStream && (
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={formData.teammateWillStream}
                                onChange={(e) => setFormData({ ...formData, teammateWillStream: e.target.checked })}
                            />
                            A teammate will stream my POV
                        </label>
                    )}
                </div>

                {/* CONSENTS */}
                <div style={sectionStyle}>
                    <h2 style={{ marginBottom: 16, fontSize: 20 }}>Consents</h2>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <label style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={formData.acceptedRules}
                                onChange={(e) => setFormData({ ...formData, acceptedRules: e.target.checked })}
                                required
                                style={{ marginTop: 4 }}
                            />
                            <span>I accept the event rules *</span>
                        </label>

                        <label style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={formData.consentPublicDisplay}
                                onChange={(e) => setFormData({ ...formData, consentPublicDisplay: e.target.checked })}
                                required
                                style={{ marginTop: 4 }}
                            />
                            <span>I consent to display my nickname, team, and Twitch publicly *</span>
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    style={{
                        width: "100%",
                        padding: "16px 24px",
                        background: submitting ? "#333" : "#4ade80",
                        border: "none",
                        borderRadius: 8,
                        color: submitting ? "#888" : "#000",
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: submitting ? "not-allowed" : "pointer",
                    }}
                >
                    {submitting ? "Submitting..." : "Submit Application"}
                </button>
            </form>
        </main>
    );
}
