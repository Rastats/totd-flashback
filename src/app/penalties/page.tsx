// src/app/penalties/page.tsx

import Link from "next/link";

const penalties = [
    // LIGHT
    {
        name: "Russian Roulette",
        tier: "Light",
        cost: 5,
        color: "#4ade80",
        description: "Play 1 random TOTD that the team has NOT completed yet.",
        details: "After finishing it, resume on the highest uncompleted TOTD index. Counts as 1 active penalty while in effect.",
    },
    {
        name: "Camera Shuffle",
        tier: "Light",
        cost: 10,
        color: "#4ade80",
        description: "On each checkpoint, the player must manually switch camera.",
        details: "Allowed cameras: Cam 1, Alt Cam 1, Cam 2, Alt Cam 2, Cam 3, Cam 7. If 6+ checkpoints, use 6 different cameras. Applies to 1 map.",
    },
    {
        name: "Cursed Controller",
        tier: "Light",
        cost: 15,
        color: "#4ade80",
        description: "Play with the weirdest/cursed input device you own.",
        details: "Applies to 1 map. No max duration. Must finish the map with the cursed controller.",
    },
    // MEDIUM
    {
        name: "Clean Run Only",
        tier: "Medium",
        cost: 25,
        color: "#facc15",
        description: "No respawn rule — if you respawn, restart the map.",
        details: "Applies to 3 maps. Max 10 minutes total. After timeout, finish normally.",
    },
    {
        name: "Pedal to the Metal",
        tier: "Medium",
        cost: 35,
        color: "#facc15",
        description: "Always full throttle — no braking, no releasing accelerator.",
        details: "Turning is allowed. Applies to 3 maps. Max 10 minutes total. After timeout, finish normally.",
    },
    {
        name: "Tunnel Vision",
        tier: "Medium",
        cost: 50,
        color: "#facc15",
        description: "Visibility set to '2 blocks' using the Finetuner plugin.",
        details: "After 10 minutes without finish, visibility restored. Applies to 1 map.",
    },
    // HEAVY
    {
        name: "Player Switch",
        tier: "Heavy",
        cost: 75,
        color: "#f87171",
        description: "Immediate forced player swap + 10 maps un-completed.",
        details: "If no teammate available, 10-minute pause. The team's 10 most recently completed TOTDs must be re-finished in ascending order.",
    },
    {
        name: "Can't Turn Right",
        tier: "Heavy",
        cost: 100,
        color: "#f87171",
        description: "No right steering input allowed.",
        details: "Applies to 1 map. Max 10 minutes. After timeout, normal driving allowed.",
    },
    {
        name: "AT or Bust",
        tier: "Heavy",
        cost: 200,
        color: "#f87171",
        description: "Must beat Author Time to leave the map.",
        details: "Duration: 20 minutes. Penalty stays active on all maps during those 20 minutes. After timeout, penalty ends.",
    },
    {
        name: "Back to the Future",
        tier: "Heavy",
        cost: 500,
        color: "#dc2626",
        description: "50 most recently completed TOTDs become uncompleted!",
        details: "Must re-finish all 50 in ascending order. Big Shield can cancel this penalty early.",
    },
];

export default function PenaltiesPage() {
    return (
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 16px", fontFamily: "system-ui" }}>
            <Link href="/" style={{ opacity: 0.7, marginBottom: 16, display: "inline-block" }}>← Back to Home</Link>

            <h1 style={{ fontSize: 36, marginBottom: 8 }}>⚠️ Penalties</h1>
            <p style={{ opacity: 0.8, marginBottom: 32, lineHeight: 1.6 }}>
                Viewers can donate to trigger penalties against teams.
                Higher donation = stronger priority in the waitlist.
            </p>

            {/* Rules */}
            <section style={{
                padding: 20,
                background: "#1a1a2e",
                borderRadius: 8,
                border: "1px solid #3a2a2a",
                marginBottom: 32,
            }}>
                <h2 style={{ fontSize: 18, marginBottom: 12 }}>📋 Penalty Rules</h2>
                <ul style={{ lineHeight: 1.8, opacity: 0.9, paddingLeft: 20 }}>
                    <li>Each team can have <strong>max 2 active penalties</strong> at once</li>
                    <li>Extra penalties go to a <strong>waitlist</strong> (max 2 slots)</li>
                    <li>Waitlist is sorted by donation amount (higher = priority)</li>
                    <li>Penalties start on <strong>next map load</strong> (never mid-map)</li>
                    <li>If a <strong>shield is active</strong>, new penalties are blocked and lost</li>
                </ul>
            </section>

            {/* Penalties List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {penalties.map((p) => (
                    <div key={p.name} style={{
                        padding: 20,
                        background: "#12121a",
                        borderRadius: 8,
                        border: `1px solid ${p.color}33`,
                        borderLeft: `4px solid ${p.color}`,
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div>
                                <span style={{
                                    fontSize: 12,
                                    padding: "2px 8px",
                                    background: `${p.color}22`,
                                    color: p.color,
                                    borderRadius: 4,
                                    marginRight: 8,
                                }}>
                                    {p.tier}
                                </span>
                                <strong style={{ fontSize: 18 }}>{p.name}</strong>
                            </div>
                            <div style={{
                                fontSize: 20,
                                fontWeight: 600,
                                color: p.color,
                            }}>
                                £{p.cost}
                            </div>
                        </div>
                        <p style={{ marginBottom: 8, opacity: 0.9 }}>{p.description}</p>
                        <p style={{ fontSize: 13, opacity: 0.6 }}>{p.details}</p>
                    </div>
                ))}
            </div>
        </main>
    );
}
