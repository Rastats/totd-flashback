"use client";

import { useState, useEffect } from "react";

const PENALTIES = [
    { cost: 5, name: "Russian Roulette", desc: "Play 1 random TOTD" },
    { cost: 10, name: "Camera Shuffle", desc: "Switch camera at each checkpoint" },
    { cost: 15, name: "Cursed Controller", desc: "Use a weird input device" },
    { cost: 25, name: "Clean Run Only", desc: "No respawn for 3 maps" },
    { cost: 35, name: "Pedal to the Metal", desc: "Full throttle only" },
    { cost: 50, name: "Tunnel Vision", desc: "2 blocks visibility" },
    { cost: 75, name: "Player Switch", desc: "Swap teammate + redo last 10 maps" },
    { cost: 100, name: "Can't Turn Right", desc: "No right steering input" },
    { cost: 200, name: "AT or Bust", desc: "AT required for 20 minutes" },
    { cost: 500, name: "Back to the Future", desc: "Redo last 50 maps" },
];

const ROTATION_INTERVAL = 5000; // 5 seconds

export default function OBSPenaltiesOverlay() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [fadeIn, setFadeIn] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setFadeIn(false);
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % PENALTIES.length);
                setFadeIn(true);
            }, 300); // Fade out duration
        }, ROTATION_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    const penalty = PENALTIES[currentIndex];

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}>
            <div style={{
                background: "rgba(0, 0, 0, 0.75)",
                borderRadius: 12,
                padding: "16px 28px",
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: fadeIn ? 1 : 0,
                transition: "opacity 0.3s ease-in-out",
                border: "2px solid rgba(255, 255, 255, 0.15)",
            }}>
                {/* Cost */}
                <div style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: "#22c55e",
                    textShadow: "0 2px 8px rgba(34, 197, 94, 0.4)",
                    minWidth: 80,
                    textAlign: "center",
                }}>
                    £{penalty.cost}
                </div>

                {/* Penalty Info */}
                <div>
                    <div style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: "#f59e0b",
                        marginBottom: 4,
                        textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                    }}>
                        {penalty.name}
                    </div>
                    <div style={{
                        fontSize: 16,
                        color: "#ffffff",
                        fontWeight: 500,
                    }}>
                        {penalty.desc}
                    </div>
                </div>
            </div>

            {/* Progress dots */}
            <div style={{
                position: "fixed",
                bottom: 20,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 6,
            }}>
                {PENALTIES.map((_, i) => (
                    <div
                        key={i}
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: i === currentIndex ? "#f59e0b" : "rgba(255,255,255,0.3)",
                            transition: "background 0.3s",
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
