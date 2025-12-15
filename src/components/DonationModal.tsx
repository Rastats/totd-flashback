"use client";

import { useState, useMemo, useEffect, useRef } from "react";

const TEAMS = [
    { id: 0, name: "Random", color: "#9ca3af" },
    { id: 1, name: "Team 1", color: "#f87171" },
    { id: 2, name: "Team 2", color: "#60a5fa" },
    { id: 3, name: "Team 3", color: "#4ade80" },
    { id: 4, name: "Team 4", color: "#facc15" },
];

const PENALTIES = [
    { name: "Russian Roulette", cost: 5, tier: "Light", tooltip: "Play 1 random TOTD" },
    { name: "Camera Shuffle", cost: 10, tier: "Light", tooltip: "Switch camera at each checkpoint for 1 map" },
    { name: "Cursed Controller", cost: 15, tier: "Light", tooltip: "Use a weird input device for 1 map" },
    { name: "Clean Run Only", cost: 25, tier: "Medium", tooltip: "No respawn for 3 maps" },
    { name: "Pedal to the Metal", cost: 35, tier: "Medium", tooltip: "Full throttle only for 3 maps" },
    { name: "Tunnel Vision", cost: 50, tier: "Medium", tooltip: "2 blocks visibility for 1 map" },
    { name: "Player Switch", cost: 75, tier: "Heavy", tooltip: "Forced teammate swap + redo last 10 maps" },
    { name: "Can't Turn Right", cost: 100, tier: "Heavy", tooltip: "No right steering input for 1 map" },
    { name: "AT or Bust", cost: 200, tier: "Heavy", tooltip: "Must beat Author Time for 20min" },
    { name: "Back to the Future", cost: 500, tier: "Heavy", tooltip: "Redo last 50 maps" },
];

interface DonationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
    const [baseAmount, setBaseAmount] = useState<number>(5);
    const [supportTeam, setSupportTeam] = useState<number>(1); // 0 = random, 1-4 = team
    const [penalizeTeam, setPenalizeTeam] = useState<number>(2); // 0 = random, 1-4 = team
    const [selectedPenalty, setSelectedPenalty] = useState<string>("Russian Roulette");
    const [hoveredPenalty, setHoveredPenalty] = useState<string | null>(null);
    const penaltyRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

    // Auto-select the most expensive affordable penalty when baseAmount changes
    useEffect(() => {
        const affordablePenalties = PENALTIES.filter((p) => p.cost <= baseAmount);
        if (affordablePenalties.length > 0) {
            // Select the most expensive one (last in sorted list)
            const mostExpensive = affordablePenalties[affordablePenalties.length - 1];
            setSelectedPenalty(mostExpensive.name);

            // Scroll to the selected penalty
            setTimeout(() => {
                const ref = penaltyRefs.current[mostExpensive.name];
                if (ref) {
                    ref.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }, 50);
        }
    }, [baseAmount]);

    // Calculate cents based on team selections
    // Format: XX.SP where S = support team (1-4), P = penalize team (1-4), 0 = random
    const finalAmount = useMemo(() => {
        // Support team -> second to last digit (tens of cents)
        // 0 = random, 1-4 = specific team
        const supportDigit = supportTeam;

        // Penalize team -> last digit (units of cents)
        // 0 = random, 1-4 = specific team
        const penalizeDigit = penalizeTeam;

        // Combine: supportDigit * 10 + penalizeDigit = cents
        const cents = supportDigit * 10 + penalizeDigit;

        return baseAmount + cents / 100;
    }, [baseAmount, supportTeam, penalizeTeam]);

    if (!isOpen) return null;


    const availablePenalties = PENALTIES.filter((p) => p.cost <= baseAmount);

    // Conversion rates
    const GBP_TO_EUR = 1.13902;
    const GBP_TO_USD = 1.27; // approximate

    const handleDonate = () => {
        // Build Tiltify URL or redirect
        const tiltifyBaseUrl = "https://donate.tiltify.com/0ce3def0-c80a-4581-b888-a8c89c1d16c9/details";
        window.open(tiltifyBaseUrl, "_blank");
        onClose();
    };

    const formatGBP = (amount: number) => {
        return "£" + amount.toFixed(2);
    };

    const formatEUR = (amountGBP: number) => {
        return (amountGBP * GBP_TO_EUR).toFixed(2).replace(".", ",") + "€";
    };

    const formatUSD = (amountGBP: number) => {
        return "$" + (amountGBP * GBP_TO_USD).toFixed(2);
    };

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0, 0, 0, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: 16,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "#1a1a2e",
                    borderRadius: 12,
                    padding: 20,
                    maxWidth: 480,
                    width: "100%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    border: "1px solid #3a3a4a",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 style={{ fontSize: 20, marginBottom: 16, textAlign: "center" }}>
                    💰 Make a Donation to Save the Children UK
                </h2>

                {/* Base Amount */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
                        Base Amount (£)
                    </label>
                    <input
                        type="number"
                        min={1}
                        value={baseAmount}
                        onChange={(e) => setBaseAmount(parseInt(e.target.value) || 1)}
                        style={{
                            width: "100%",
                            padding: "12px 16px",
                            background: "#0a0a12",
                            border: "1px solid #3a3a4a",
                            borderRadius: 8,
                            color: "#fff",
                            fontSize: 18,
                            textAlign: "center",
                        }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {[5, 10, 25, 50, 100, 200, 500].map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setBaseAmount(preset)}
                                style={{
                                    padding: "6px 12px",
                                    background: baseAmount === preset ? "#f59e0b" : "#2a2a3a",
                                    border: "none",
                                    borderRadius: 4,
                                    color: "#fff",
                                    cursor: "pointer",
                                    fontSize: 13,
                                }}
                            >
                                £{preset}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Support Team */}
                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
                        🛡️ Team to Support (for shields)
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                        {TEAMS.map((team) => (
                            <button
                                key={team.id}
                                type="button"
                                onClick={() => {
                                    setSupportTeam(team.id);
                                    // If this would create a conflict, auto-switch penalize to Random
                                    if (team.id !== 0 && team.id === penalizeTeam) {
                                        setPenalizeTeam(0); // Random
                                    }
                                }}
                                style={{
                                    padding: "10px 6px",
                                    background: supportTeam === team.id ? `${team.color}33` : "#0a0a12",
                                    border: supportTeam === team.id ? `2px solid ${team.color}` : "1px solid #3a3a4a",
                                    borderRadius: 8,
                                    color: "#fff",
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontWeight: supportTeam === team.id ? 600 : 400,
                                }}
                            >
                                {team.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Penalize Team */}
                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
                        ⚠️ Team to Penalize
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                        {TEAMS.map((team) => {
                            const isSameAsSupport = team.id !== 0 && team.id === supportTeam;
                            return (
                                <button
                                    key={team.id}
                                    type="button"
                                    onClick={() => !isSameAsSupport && setPenalizeTeam(team.id)}
                                    style={{
                                        padding: "10px 6px",
                                        background: penalizeTeam === team.id ? `${team.color}33` : "#0a0a12",
                                        border: penalizeTeam === team.id ? `2px solid ${team.color}` : "1px solid #3a3a4a",
                                        borderRadius: 8,
                                        color: "#fff",
                                        cursor: isSameAsSupport ? "not-allowed" : "pointer",
                                        fontSize: 12,
                                        fontWeight: penalizeTeam === team.id ? 600 : 400,
                                        opacity: isSameAsSupport ? 0.4 : 1,
                                    }}
                                    disabled={isSameAsSupport}
                                >
                                    {team.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Team Summary */}
                <div style={{
                    padding: 8,
                    background: "#0a0a12",
                    borderRadius: 6,
                    marginBottom: 14,
                    fontSize: 12,
                    textAlign: "center",
                }}>
                    Support{" "}
                    <strong style={{ color: TEAMS.find(t => t.id === supportTeam)?.color }}>
                        {supportTeam === 0 ? "Random team" : `Team ${supportTeam}`}
                    </strong>
                    {" • "}
                    Penalize{" "}
                    <strong style={{ color: TEAMS.find(t => t.id === penalizeTeam)?.color }}>
                        {penalizeTeam === 0 ? "Random team" : `Team ${penalizeTeam}`}
                    </strong>
                </div>

                {/* Penalty that will be triggered */}
                {(() => {
                    const affordablePenalties = PENALTIES.filter((p) => p.cost <= baseAmount);
                    const triggeredPenalty = affordablePenalties.length > 0
                        ? affordablePenalties[affordablePenalties.length - 1]
                        : null;

                    if (!triggeredPenalty) {
                        return (
                            <div style={{
                                padding: 16,
                                background: "#2a2a3a",
                                borderRadius: 8,
                                marginBottom: 24,
                                textAlign: "center",
                                border: "1px solid #4a4a5a",
                            }}>
                                <div style={{ fontSize: 14, opacity: 0.7 }}>
                                    Minimum donation: £5 to trigger a penalty
                                </div>
                            </div>
                        );
                    }

                    const tierColors: Record<string, string> = {
                        Light: "#4ade80",
                        Medium: "#facc15",
                        Heavy: "#f87171"
                    };

                    return (
                        <div style={{
                            padding: 12,
                            background: `${tierColors[triggeredPenalty.tier]}11`,
                            borderRadius: 8,
                            marginBottom: 14,
                            textAlign: "center",
                            border: `1px solid ${tierColors[triggeredPenalty.tier]}44`,
                        }}>
                            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                                Penalty triggered:
                            </div>
                            <div style={{
                                fontSize: 20,
                                fontWeight: 700,
                                color: tierColors[triggeredPenalty.tier],
                                marginBottom: 4,
                            }}>
                                🎯 {triggeredPenalty.name}
                            </div>
                            <div style={{
                                fontSize: 13,
                                opacity: 0.8,
                                marginBottom: 8,
                            }}>
                                {triggeredPenalty.tooltip}
                            </div>
                            <div style={{
                                fontSize: 11,
                                padding: "4px 8px",
                                background: `${tierColors[triggeredPenalty.tier]}22`,
                                borderRadius: 4,
                                display: "inline-block",
                            }}>
                                <span style={{ color: tierColors[triggeredPenalty.tier] }}>
                                    {triggeredPenalty.tier}
                                </span>
                                {" • "}
                                Min £{triggeredPenalty.cost}
                            </div>
                        </div>
                    );
                })()}

                {/* Final Amount Display */}
                <div style={{
                    padding: 12,
                    background: "linear-gradient(135deg, #f59e0b22, #d9770622)",
                    borderRadius: 8,
                    marginBottom: 12,
                    textAlign: "center",
                    border: "1px solid #f59e0b44",
                }}>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Amount to donate on Tiltify:</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: "#f59e0b" }}>
                        {formatGBP(finalAmount)}
                    </div>
                    <div style={{ fontSize: 14, opacity: 0.85, marginTop: 6, color: "#a5b4fc" }}>
                        ≈ {formatEUR(finalAmount)} • {formatUSD(finalAmount)}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            navigator.clipboard.writeText(finalAmount.toFixed(2));
                            alert("Amount copied: " + finalAmount.toFixed(2));
                        }}
                        style={{
                            marginTop: 12,
                            padding: "8px 16px",
                            background: "#2a2a3a",
                            border: "1px solid #4a4a5a",
                            borderRadius: 6,
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 13,
                        }}
                    >
                        📋 Copy amount
                    </button>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                        Pence encode: .{supportTeam}{penalizeTeam} ({supportTeam === 0 ? "Random" : `Team ${supportTeam}`} / {penalizeTeam === 0 ? "Random" : `Team ${penalizeTeam}`})
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 12 }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: "12px 20px",
                            background: "#2a2a3a",
                            border: "1px solid #3a3a4a",
                            borderRadius: 8,
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 14,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDonate}
                        style={{
                            flex: 2,
                            padding: "12px 20px",
                            background: "linear-gradient(135deg, #f59e0b, #d97706)",
                            border: "none",
                            borderRadius: 8,
                            color: "#fff",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: 14,
                            boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
                        }}
                    >
                        ❤️ Continue to Tiltify
                    </button>
                </div>
            </div>
        </div>
    );
}
