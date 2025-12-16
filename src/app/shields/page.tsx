// src/app/shields/page.tsx

import Link from "next/link";

export default function ShieldsPage() {
    return (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
            <Link href="/" style={{ opacity: 0.7, marginBottom: 16, display: "inline-block" }}>← Back to Home</Link>

            <h1 style={{ fontSize: 36, marginBottom: 8 }}>🛡️ Shields</h1>
            <p style={{ opacity: 0.8, marginBottom: 32, lineHeight: 1.6 }}>
                Shields are automatic milestone rewards for the team you donate to.
                They trigger when the team&apos;s fundraising total crosses milestones.
            </p>

            {/* Shields */}
            <div style={{ display: "grid", gap: 24, marginBottom: 32 }}>
                {/* Small Shield */}
                <section style={{
                    padding: 24,
                    background: "#12121a",
                    borderRadius: 12,
                    border: "1px solid #3b82f6",
                    borderTop: "4px solid #3b82f6",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h2 style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 32 }}>🛡️</span> Small Shield
                        </h2>
                        <span style={{
                            fontSize: 24,
                            fontWeight: 600,
                            color: "#3b82f6",
                        }}>
                            £100
                        </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 16 }}>
                        <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 6 }}>
                            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 4 }}>Duration</div>
                            <div style={{ fontWeight: 500 }}>10 minutes</div>
                        </div>
                        <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 6 }}>
                            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 4 }}>Cooldown</div>
                            <div style={{ fontWeight: 500 }}>1 hour</div>
                        </div>
                        <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 6 }}>
                            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 4 }}>Trigger</div>
                            <div style={{ fontWeight: 500 }}>Every £100 milestone</div>
                        </div>
                    </div>

                    <h3 style={{ fontSize: 16, marginBottom: 8, color: "#3b82f6" }}>Effect</h3>
                    <ul style={{ lineHeight: 1.8, opacity: 0.9, paddingLeft: 20 }}>
                        <li><strong>Blocks ALL new penalties</strong> during its duration</li>
                        <li>Does NOT cancel currently active penalties</li>
                        <li>Does NOT clear the penalty waitlist</li>
                    </ul>
                </section>

                {/* Big Shield */}
                <section style={{
                    padding: 24,
                    background: "#12121a",
                    borderRadius: 12,
                    border: "1px solid #a855f7",
                    borderTop: "4px solid #a855f7",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h2 style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 32 }}>⭐</span> Big Shield
                        </h2>
                        <span style={{
                            fontSize: 24,
                            fontWeight: 600,
                            color: "#a855f7",
                        }}>
                            £500
                        </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 16 }}>
                        <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 6 }}>
                            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 4 }}>Duration</div>
                            <div style={{ fontWeight: 500 }}>30 minutes</div>
                        </div>
                        <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 6 }}>
                            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 4 }}>Cooldown</div>
                            <div style={{ fontWeight: 500 }}>4 hours</div>
                        </div>
                        <div style={{ padding: 12, background: "#1a1a2e", borderRadius: 6 }}>
                            <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 4 }}>Trigger</div>
                            <div style={{ fontWeight: 500 }}>Every £500 milestone</div>
                        </div>
                    </div>

                    <h3 style={{ fontSize: 16, marginBottom: 8, color: "#a855f7" }}>Effect</h3>
                    <ul style={{ lineHeight: 1.8, opacity: 0.9, paddingLeft: 20 }}>
                        <li><strong>Blocks ALL new penalties</strong> during its duration</li>
                        <li><strong>Cancels ALL currently active penalties</strong></li>
                        <li><strong>Clears the penalty waitlist</strong></li>
                    </ul>
                </section>
            </div>

            {/* Rules */}
            <section style={{
                padding: 20,
                background: "#1a1a2e",
                borderRadius: 8,
                border: "1px solid #2a2a3a",
                marginBottom: 24,
            }}>
                <h2 style={{ fontSize: 18, marginBottom: 12 }}>📋 Shield Rules</h2>
                <ul style={{ lineHeight: 1.8, opacity: 0.9, paddingLeft: 20 }}>
                    <li>Shields do <strong>NOT stack</strong> and do <strong>NOT queue</strong></li>
                    <li>At 500€ multiples, <strong>Big Shield overrides Small Shield</strong></li>
                    <li>If a milestone is crossed during cooldown, it does not trigger</li>
                    <li>When shielded, new penalties are <strong>blocked and lost</strong> (not queued)</li>
                </ul>
            </section>

            {/* Special Interaction */}
            <section style={{
                padding: 20,
                background: "linear-gradient(135deg, #1a1a2e, #2a1a3a)",
                borderRadius: 8,
                border: "1px solid #4a2a5a",
            }}>
                <h2 style={{ fontSize: 18, marginBottom: 12 }}>⚡ Special: Big Shield vs Back to the Future</h2>
                <p style={{ lineHeight: 1.6, opacity: 0.9 }}>
                    If Big Shield triggers while <strong>Back to the Future</strong> is ongoing:
                </p>
                <ul style={{ lineHeight: 1.8, opacity: 0.9, paddingLeft: 20, marginTop: 8 }}>
                    <li>All maps that were invalidated by the Back to the Future penalty are re-validated as completed</li>
                    <li>The Back to the Future penalty is cancelled</li>
                    <li>The team resumes on the highest uncompleted TOTD index</li>
                </ul>
            </section>
        </main>
    );
}
