"use client";

import { useState } from "react";

interface TwitchEmbedProps {
    channel?: string;
    isVisible?: boolean;
}

export default function TwitchEmbed({ channel = "rastats", isVisible = false }: TwitchEmbedProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Hidden during development
    if (!isVisible) {
        return null;
    }

    return (
        <div style={{
            background: "#12121a",
            borderRadius: 12,
            border: "1px solid #2a2a3a",
            overflow: "hidden",
        }}>
            <div
                style={{
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    background: "#1a1a2e",
                }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 20 }}>📺</span>
                    <span style={{ fontWeight: 600 }}>Watch Live Stream</span>
                    <span style={{
                        padding: "4px 8px",
                        background: "#9147ff",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                    }}>
                        twitch.tv/{channel}
                    </span>
                </div>
                <span style={{ fontSize: 20, transition: "transform 0.3s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>
                    ▼
                </span>
            </div>

            {isExpanded && (
                <div style={{ aspectRatio: "16/9", position: "relative" }}>
                    <iframe
                        src={`https://player.twitch.tv/?channel=${channel}&parent=localhost&parent=totd-flashback.vercel.app`}
                        width="100%"
                        height="100%"
                        allowFullScreen
                        style={{ border: "none" }}
                    />
                </div>
            )}
        </div>
    );
}
