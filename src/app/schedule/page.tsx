"use client";

import Link from "next/link";
import { TEAMS } from "@/lib/config";

export default function ScheduleIndex() {
    return (
        <div style={{ padding: 40, maxWidth: 800, margin: "0 auto", color: "#e2e8f0" }}>
            <h1 style={{ fontSize: 28, fontWeight: "bold", marginBottom: 8 }}>📅 Team Schedules</h1>
            <p style={{ color: "#94a3b8", marginBottom: 32 }}>
                View the player schedule for each team during TOTD Flashback.
            </p>

            <div style={{ display: "grid", gap: 16 }}>
                {TEAMS.map(team => (
                    <Link
                        key={team.id}
                        href={`/schedule/${team.id}`}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            padding: 20,
                            background: "#1e293b",
                            borderRadius: 12,
                            border: `2px solid ${team.color}40`,
                            textDecoration: "none",
                            color: "#e2e8f0",
                            transition: "all 0.2s",
                        }}
                    >
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            background: team.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 24,
                            fontWeight: "bold",
                            color: "#000"
                        }}>
                            {team.id.replace("team", "")}
                        </div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: "bold", color: team.color }}>{team.name}</div>
                            <div style={{ fontSize: 13, color: "#94a3b8" }}>View schedule →</div>
                        </div>
                    </Link>
                ))}
            </div>

            <div style={{ marginTop: 40, textAlign: "center" }}>
                <Link href="/" style={{ color: "#60a5fa" }}>← Back to Home</Link>
            </div>
        </div>
    );
}
