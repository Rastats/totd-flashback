"use client";
// src/app/signup/player/page.tsx

import { useState, FormEvent } from "react";
import Link from "next/link";
import { COMMON_TIMEZONES, LANGUAGES } from "@/lib/timezones";
import AvailabilityGrid from "@/components/AvailabilityGrid";


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

    const [selectedHourIndices, setSelectedHourIndices] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        // Validate availability - must have at least one hour selected
        if (selectedHourIndices.length === 0) {
            setError("Please select at least one availability slot. We need to know when you can play!");
            setSubmitting(false);
            return;
        }

        try {
            const response = await fetch("/api/signup/player", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    formData,
                    // Send hour_indices directly instead of legacy slots
                    hour_indices: selectedHourIndices.sort((a, b) => a - b),
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
            <main style={{ maxWidth: 850, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
                <div style={{ textAlign: "center", padding: 40 }}>
                    <h1 style={{ color: "#4ade80", marginBottom: 16 }}>✅ Application Submitted!</h1>
                    <p style={{ marginBottom: 24 }}>Thank you for signing up as a player. The staff will review your application.</p>
                    <Link href="/" style={{ color: "#60a5fa" }}>← Back to Home</Link>
                </div>
            </main>
        );
    }

    return (
        <main style={{ maxWidth: 850, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
            <Link href="/" style={{ opacity: 0.7, marginBottom: 16, display: "inline-block" }}>← Back to Home</Link>

            <h1 style={{ fontSize: 32, marginBottom: 8 }}>Sign up as player</h1>
            <p style={{ opacity: 0.85, marginBottom: 32 }}>Fill out this form to apply for TOTD Flashback.</p>


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

                        {error && (
                            <div style={{ padding: 12, background: "#4a1a1a", borderRadius: 6, marginTop: 8, color: "#f87171", fontSize: 13 }}>
                                {error}
                            </div>
                        )}
                    </div>

                    {/* AVAILABILITY GRID - Right after timezone */}
                    {formData.timezone && (
                        <div style={{ marginBottom: 16, padding: 16, background: "#0a0a12", borderRadius: 8, border: "1px solid #2a2a3a" }}>
                            <label style={labelStyle}>Availability (click to toggle) - {formData.timezone}</label>
                            <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
                                Click on the hours when you&apos;re available. Times are shown in your timezone.
                            </p>
                            <AvailabilityGrid
                                timezone={formData.timezone}
                                selectedHours={selectedHourIndices}
                                onToggle={(hourIndex) => {
                                    setSelectedHourIndices(prev =>
                                        prev.includes(hourIndex)
                                            ? prev.filter(h => h !== hourIndex)
                                            : [...prev, hourIndex]
                                    );
                                }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
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
                            onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("Please check this box to continue")}
                            onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")}
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
