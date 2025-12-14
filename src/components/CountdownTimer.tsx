"use client";

import { useState, useEffect } from "react";

// Event times in UTC
const EVENT_START = new Date("2025-12-21T20:00:00Z"); // 21:00 CET = 20:00 UTC
const EVENT_END = new Date("2025-12-24T17:00:00Z");   // 18:00 CET = 17:00 UTC

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
}

export default function CountdownTimer() {
    const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
    const [eventPhase, setEventPhase] = useState<"before" | "during" | "after">("before");

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date();

            if (now < EVENT_START) {
                // Before event - countdown to start
                setEventPhase("before");
                const diff = EVENT_START.getTime() - now.getTime();
                setTimeLeft({
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((diff / (1000 * 60)) % 60),
                    seconds: Math.floor((diff / 1000) % 60),
                    total: diff,
                });
            } else if (now >= EVENT_START && now < EVENT_END) {
                // During event - countdown to end
                setEventPhase("during");
                const diff = EVENT_END.getTime() - now.getTime();
                setTimeLeft({
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((diff / (1000 * 60)) % 60),
                    seconds: Math.floor((diff / 1000) % 60),
                    total: diff,
                });
            } else {
                // After event
                setEventPhase("after");
                setTimeLeft(null);
            }
        };

        calculateTime();
        const timer = setInterval(calculateTime, 1000);
        return () => clearInterval(timer);
    }, []);

    if (!timeLeft && eventPhase === "after") {
        return (
            <div style={{
                padding: 24,
                background: "linear-gradient(135deg, #22543d, #1a4a2a)",
                borderRadius: 12,
                textAlign: "center",
                border: "1px solid #4ade80",
            }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#4ade80" }}>
                    🎉 Event Complete!
                </div>
                <p style={{ opacity: 0.8, marginTop: 8 }}>Thank you for participating!</p>
            </div>
        );
    }

    if (!timeLeft) {
        return null; // Loading
    }

    const isLive = eventPhase === "during";
    const totalHoursLeft = Math.floor(timeLeft.total / (1000 * 60 * 60));

    return (
        <div style={{
            padding: 24,
            background: isLive
                ? "linear-gradient(135deg, #4a1a4a, #2a1a3a)"
                : "linear-gradient(135deg, #1a1a2e, #12121a)",
            borderRadius: 12,
            textAlign: "center",
            border: isLive ? "2px solid #a855f7" : "1px solid #2a2a3a",
            position: "relative",
            overflow: "hidden",
        }}>
            {isLive && (
                <div style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    padding: "4px 12px",
                    background: "#ef4444",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    animation: "pulse 2s infinite",
                }}>
                    🔴 LIVE
                </div>
            )}

            <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>
                {isLive ? "⏱️ Event ends in" : "🚀 Event starts in"}
            </div>

            {isLive && (
                <div style={{ fontSize: 32, fontWeight: 700, color: "#a855f7", marginBottom: 8 }}>
                    {totalHoursLeft}h remaining
                </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                {timeLeft.days > 0 && (
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 36, fontWeight: 700, color: "#60a5fa" }}>
                            {String(timeLeft.days).padStart(2, "0")}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>DAYS</div>
                    </div>
                )}
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 36, fontWeight: 700, color: "#60a5fa" }}>
                        {String(timeLeft.hours).padStart(2, "0")}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>HOURS</div>
                </div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 36, fontWeight: 700, color: "#a855f7" }}>
                        {String(timeLeft.minutes).padStart(2, "0")}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>MINUTES</div>
                </div>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 36, fontWeight: 700, color: "#f472b6" }}>
                        {String(timeLeft.seconds).padStart(2, "0")}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>SECONDS</div>
                </div>
            </div>
        </div>
    );
}
