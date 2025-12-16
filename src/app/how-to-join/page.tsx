// src/app/how-to-join/page.tsx

import Link from "next/link";

export default function HowToJoinPage() {
    return (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
            <Link href="/" style={{ opacity: 0.7, marginBottom: 16, display: "inline-block" }}>← Back to Home</Link>

            <h1 style={{ fontSize: 36, marginBottom: 8 }}>📋 How to Join</h1>
            <p style={{ opacity: 0.8, marginBottom: 32, lineHeight: 1.6 }}>
                Everything you need to know to participate in TOTD Flashback.
            </p>

            {/* Requirements */}
            <section style={{
                padding: 24,
                background: "#12121a",
                borderRadius: 12,
                border: "1px solid #2a3a4a",
                marginBottom: 24,
            }}>
                <h2 style={{ fontSize: 24, marginBottom: 16, color: "#60a5fa" }}>🎮 Requirements</h2>
                <ul style={{ lineHeight: 2, paddingLeft: 20 }}>
                    <li>
                        <strong>PC Only</strong> — The Openplanet plugin required for the event is not available on consoles
                    </li>
                    <li>
                        <strong>Trackmania Standard Access</strong> — You need access to TOTDs
                    </li>
                    <li>
                        <strong>Openplanet</strong> — Required for the TOTD Flashback plugin
                    </li>
                    <li>
                        <strong>Discord</strong> — For team coordination and staff communication
                    </li>
                    <li>
                        <strong>Reliable availability</strong> — The event runs 69 hours non-stop, coverage matters!
                    </li>
                </ul>
            </section>

            {/* Shift Rules */}
            <section style={{
                padding: 24,
                background: "#12121a",
                borderRadius: 12,
                border: "1px solid #3a3a2a",
                marginBottom: 24,
            }}>
                <h2 style={{ fontSize: 24, marginBottom: 16, color: "#facc15" }}>⏰ Shift & Rest Rules</h2>
                <ul style={{ lineHeight: 2, paddingLeft: 20 }}>
                    <li>
                        <strong>Max 3 hours per session</strong> — Anti-burnout protection
                    </li>
                    <li>
                        After 3 hours, <strong>hand off to a teammate</strong>
                    </li>
                    <li>
                        If no teammate available: <strong>minimum 10-minute break</strong> before starting a new session
                    </li>
                </ul>
            </section>

            {/* Streaming Rules */}
            <section style={{
                padding: 24,
                background: "#12121a",
                borderRadius: 12,
                border: "1px solid #4a2a4a",
                marginBottom: 24,
            }}>
                <h2 style={{ fontSize: 24, marginBottom: 16, color: "#a855f7" }}>📺 Streaming Rules</h2>
                <ul style={{ lineHeight: 2, paddingLeft: 20 }}>
                    <li>
                        Each team must have <strong>at least one Twitch POV live at all times</strong>
                    </li>
                    <li>
                        A few minutes of downtime is allowed for technical issues
                    </li>
                    <li>
                        You can play off-stream <strong>ONLY if a teammate streams your POV</strong> (relay/screen share)
                    </li>
                    <li>
                        Official restream with casters: <a href="https://twitch.tv/rastats" target="_blank" rel="noreferrer" style={{ color: "#a855f7" }}>twitch.tv/rastats</a>
                    </li>
                </ul>
            </section>

            {/* Teams */}
            <section style={{
                padding: 24,
                background: "#12121a",
                borderRadius: 12,
                border: "1px solid #2a4a3a",
                marginBottom: 24,
            }}>
                <h2 style={{ fontSize: 24, marginBottom: 16, color: "#4ade80" }}>👥 Team Assignment</h2>
                <ul style={{ lineHeight: 2, paddingLeft: 20 }}>
                    <li>
                        <strong>4 teams total</strong> (adjustable based on number of applicants)
                    </li>
                    <li>
                        Teams are <strong>formed by staff</strong> based on player affinities and availability to ensure full coverage
                    </li>
                    <li>
                        You can <strong>join with friends/as a group</strong>, but final assignment is staff-driven
                    </li>
                    <li>
                        <strong>Jokers</strong> are available to fill coverage gaps across any team
                    </li>
                </ul>
            </section>

            {/* Roles */}
            <section style={{
                padding: 24,
                background: "#12121a",
                borderRadius: 12,
                border: "1px solid #2a2a3a",
                marginBottom: 32,
            }}>
                <h2 style={{ fontSize: 24, marginBottom: 16 }}>🎭 Roles</h2>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    <div style={{ padding: 16, background: "#1a1a2e", borderRadius: 8 }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>🎮</div>
                        <h3 style={{ marginBottom: 8 }}>Player</h3>
                        <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>
                            Speedrun TOTDs for your team. Can stream or play while a teammate streams your POV.
                        </p>
                    </div>

                    <div style={{ padding: 16, background: "#1a1a2e", borderRadius: 8 }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>📺</div>
                        <h3 style={{ marginBottom: 8 }}>Streamer</h3>
                        <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>
                            Stream gameplay on Twitch. Can be the player or relay a teammate&apos;s POV.
                        </p>
                    </div>

                    <div style={{ padding: 16, background: "#1a1a2e", borderRadius: 8 }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>🃏</div>
                        <h3 style={{ marginBottom: 8 }}>Joker</h3>
                        <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>
                            Flexible player who can fill in for any team when there are coverage gaps.
                        </p>
                    </div>

                    <div style={{ padding: 16, background: "#1a1a2e", borderRadius: 8 }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>🎙️</div>
                        <h3 style={{ marginBottom: 8 }}>Caster</h3>
                        <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>
                            Provide live commentary on the official restream. No gameplay required.
                        </p>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section style={{
                textAlign: "center",
                padding: 32,
                background: "linear-gradient(135deg, #1a1a2e, #2a1a3a)",
                borderRadius: 12,
                border: "1px solid #4a2a5a",
            }}>
                <h2 style={{ fontSize: 24, marginBottom: 16 }}>Ready to join?</h2>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <Link href="/signup/player" style={{
                        padding: "14px 28px",
                        background: "linear-gradient(135deg, #60a5fa, #3b82f6)",
                        borderRadius: 8,
                        color: "#fff",
                        fontWeight: 600,
                        textDecoration: "none",
                    }}>
                        🎮 Apply as Player
                    </Link>
                    <Link href="/signup/caster" style={{
                        padding: "14px 28px",
                        background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                        borderRadius: 8,
                        color: "#fff",
                        fontWeight: 600,
                        textDecoration: "none",
                    }}>
                        🎙️ Apply as Caster
                    </Link>
                </div>
            </section>
        </main>
    );
}
