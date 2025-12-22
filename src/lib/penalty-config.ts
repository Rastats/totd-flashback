// Penalty configuration
// Used by API routes to manage penalty timers and map counts

export interface PenaltyConfig {
    id: number;
    name: string;
    maps: number | null;  // null = no map count (e.g., AT or Bust)
    timerMinutes: number | null;  // null = no timer
    showMaps: boolean;  // Show map counter in UI
    showTimer: boolean; // Show timer in UI
}

export const PENALTY_CONFIG: Record<number, PenaltyConfig> = {
    1: { id: 1, name: "Russian Roulette", maps: 1, timerMinutes: null, showMaps: false, showTimer: false },
    2: { id: 2, name: "Camera Shuffle", maps: 1, timerMinutes: null, showMaps: false, showTimer: false },
    3: { id: 3, name: "Cursed Controller", maps: 1, timerMinutes: null, showMaps: false, showTimer: false },
    4: { id: 4, name: "Clean Run Only", maps: 3, timerMinutes: 10, showMaps: true, showTimer: true },
    5: { id: 5, name: "Pedal to the Metal", maps: 3, timerMinutes: 10, showMaps: true, showTimer: true },
    6: { id: 6, name: "Tunnel Vision", maps: 1, timerMinutes: 10, showMaps: false, showTimer: true },
    7: { id: 7, name: "Player Switch", maps: 10, timerMinutes: null, showMaps: true, showTimer: false },
    8: { id: 8, name: "Can't Turn Right", maps: 1, timerMinutes: 10, showMaps: false, showTimer: true },
    9: { id: 9, name: "AT or Bust", maps: null, timerMinutes: 20, showMaps: false, showTimer: true },
    10: { id: 10, name: "Back to the Future", maps: 50, timerMinutes: null, showMaps: true, showTimer: false },
};

// Get penalty config by ID
export function getPenaltyConfig(penaltyId: number): PenaltyConfig | undefined {
    return PENALTY_CONFIG[penaltyId];
}

// Calculate timer_expires_at from now
export function calculateTimerExpiry(penaltyId: number): string | null {
    const config = PENALTY_CONFIG[penaltyId];
    if (!config?.timerMinutes) return null;
    return new Date(Date.now() + config.timerMinutes * 60 * 1000).toISOString();
}

// Get initial maps_remaining
export function getInitialMapsRemaining(penaltyId: number): number | null {
    const config = PENALTY_CONFIG[penaltyId];
    return config?.maps ?? null;
}
