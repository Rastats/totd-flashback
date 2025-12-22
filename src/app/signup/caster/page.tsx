"use client";
// src/app/signup/caster/page.tsx

import { useState, FormEvent } from "react";
import Link from "next/link";
import { COMMON_TIMEZONES } from "@/lib/timezones";
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

export default function CasterSignupPage() {
    const [formData, setFormData] = useState({
        discordUsername: "",
        displayName: "",
        timezone: "",
        englishLevel: "Advanced",
        experienceLevel: 3,
        availabilityConstraints: "",
        canAppearOnMainStream: false,
        micQualityOk: false,
        twitchUsername: "",
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
            setError("Please select at least one availability slot.");
            setSubmitting(false);
            return;
        }

        try {
            const response = await fetch("/api/signup/caster", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    formData,
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
                    <h1 style={{ color: "#60a5fa", marginBottom: 16 }}>✅ Application Submitted!</h1>
                    <p style={{ marginBottom: 24 }}>Thank you for signing up as a caster. The staff will review your application.</p>
                    <Link href="/" style={{ color: "#60a5fa" }}>← Back to Home</Link>
                </div>
            </main>
        );
    }

    return (
        <main style={{ maxWidth: 850, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
            <Link href="/" style={{ opacity: 0.7, marginBottom: 16, display: "inline-block" }}>← Back to Home</Link>

            <h1 style={{ fontSize: 32, marginBottom: 8 }}>Sign Up as Caster</h1>
            <p style={{ opacity: 0.85, marginBottom: 32 }}>Apply to cast on the official TOTD Flashback stream.</p>


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
                        <label style={labelStyle}>Caster Name / Display Name *</label>
                        <input
                            type="text"
                            placeholder="How you want to be called on stream"
                            value={formData.displayName}
                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                            required
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Twitch Username (optional)</label>
                        <input
                            type="text"
                            placeholder="yourchannel"
                            value={formData.twitchUsername}
                            onChange={(e) => setFormData({ ...formData, twitchUsername: e.target.value })}
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
                                Click on the hours when you&apos;re available to cast.
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
                        </div>
                    )}

                    <div style={{ marginTop: 16 }}>
                        <label style={labelStyle}>Availability constraints (optional)</label>
                        <textarea
                            placeholder="Any specific constraints?"
                            value={formData.availabilityConstraints}
                            onChange={(e) => setFormData({ ...formData, availabilityConstraints: e.target.value })}
                            style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>English level</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {["Native", "Advanced", "Decent", "Poor"].map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, englishLevel: level })}
                                    style={{
                                        padding: "8px 16px",
                                        background: formData.englishLevel === level ? "#3b82f633" : "#1a1a2e",
                                        border: formData.englishLevel === level ? "2px solid #3b82f6" : "1px solid #333",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                        fontSize: 13,
                                        color: "#fff",
                                        fontWeight: formData.englishLevel === level ? 600 : 400,
                                    }}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* CASTING PROFILE */}
                <div style={sectionStyle}>
                    <h2 style={{ marginBottom: 16, fontSize: 20 }}>Casting Profile</h2>

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Experience level</label>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {[1, 2, 3, 4, 5].map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, experienceLevel: level })}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: "50%",
                                        background: formData.experienceLevel === level ? "#3b82f6" : "#1a1a2e",
                                        border: formData.experienceLevel === level ? "2px solid #60a5fa" : "1px solid #444",
                                        color: "#fff",
                                        fontSize: 16,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                    }}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>1 = first time, 5 = experienced caster</p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={formData.canAppearOnMainStream}
                                onChange={(e) => setFormData({ ...formData, canAppearOnMainStream: e.target.checked })}
                            />
                            I accept to appear on voice and on camera on twitch.tv/rastats
                        </label>

                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={formData.micQualityOk}
                                onChange={(e) => setFormData({ ...formData, micQualityOk: e.target.checked })}
                            />
                            My microphone quality is good
                        </label>
                    </div>

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
                            <span>I consent to display my name publicly *</span>
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    style={{
                        width: "100%",
                        padding: "16px 24px",
                        background: submitting ? "#333" : "#60a5fa",
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
        </main >
    );
}
