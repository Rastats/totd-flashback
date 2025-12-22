// src/lib/config.ts
// Centralized configuration for TOTD Flashback event

// Event Dates (UTC)
export const EVENT_START_UTC = new Date('2025-12-26T19:00:00Z'); // Dec 26, 2025 20:00 CET
export const EVENT_END_UTC = new Date('2025-12-29T16:00:00Z');   // Dec 29, 2025 17:00 CET

// Teams Configuration
export const TEAMS = [
    { id: 'team1', number: 1, name: 'Team Speedrun', color: '#f87171' },
    { id: 'team2', number: 2, name: 'Team B2', color: '#60a5fa' },
    { id: 'team3', number: 3, name: 'Team BITM', color: '#4ade80' },
    { id: 'team4', number: 4, name: 'Team 4', color: '#facc15' },
] as const;

export const JOKER_TEAM = { id: 'joker', name: 'Jokers', color: '#4c1d95' } as const;

// All team IDs for type safety
export const TEAM_IDS = ['team1', 'team2', 'team3', 'team4', 'joker'] as const;

// Currency Exchange Rates (Updated: 2025-12-18)
export const CURRENCY_RATES = {
    GBP_TO_EUR: 1.1417,
    GBP_TO_USD: 1.3386,
} as const;

// Event Dates for Display (must match EVENT_START_UTC and EVENT_END_UTC)
export const EVENT_INFO = {
    startDate: 'Dec 26, 2025',
    startTime: '20:00 CET',
    endDate: 'Dec 29, 2025',
    endTime: '17:00 CET',
    duration: '69 hours',
} as const;

