// src/lib/types.ts

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type PreferenceLevel = 'unavailable' | 'ok' | 'preferred';
export type TeamAssignment = 'team1' | 'team2' | 'team3' | 'team4' | 'joker' | null;

export interface AvailabilitySlot {
    date: string; // ISO date string "2025-12-21"
    startHour: number; // 0-23 in user's timezone
    endHour: number; // 0-24 in user's timezone (24 = midnight next day)
    preference: PreferenceLevel;
}

export interface PlayerApplication {
    id: string;
    createdAt: string;
    status: ApplicationStatus;

    // Identity
    discordUsername: string;
    trackmaniaId: string; // Account ID from trackmania.io
    trackmaniaName: string;
    timezone: string; // IANA timezone
    languages: string[];
    fastLearnLevel: number; // 1-10
    pcConfirmed: boolean;

    // Team Building
    wantsCaptain: boolean;
    willingJoker: boolean;
    comingAsGroup: boolean;
    wantedTeammates: string; // comma-separated names
    staffNotes: string; // private notes from staff
    playerNotes: string; // notes for staff from player

    // Streaming
    canStream: boolean;
    twitchUrl: string;
    can720p30: boolean;
    canRelayTeammate: boolean;
    teammateWillStream: boolean; // if can't stream

    // Availability
    availability: AvailabilitySlot[];
    isFlexible: boolean;
    maxHoursPerDay: number;

    // Consents
    acceptedRules: boolean;
    consentPublicDisplay: boolean;

    // Staff fields
    teamAssignment: TeamAssignment;
    staffInternalNotes: string;
}

export interface CasterApplication {
    id: string;
    createdAt: string;
    status: ApplicationStatus;

    // Identity
    discordUsername: string;
    displayName: string; // caster name
    timezone: string;
    englishLevel: string; // "Native" | "Advanced" | "Decent" | "Poor"

    // Casting Profile
    experienceLevel: number; // 1-5
    availabilityConstraints: string;
    canAppearOnMainStream: boolean;
    micQualityOk: boolean;
    twitchUsername: string;

    // Availability
    availability: AvailabilitySlot[];

    // Consents
    acceptedRules: boolean;
    consentPublicDisplay: boolean;

    // Staff fields
    staffInternalNotes: string;
}

// For admin display
export interface ApplicationSummary {
    id: string;
    type: 'player' | 'caster';
    displayName: string;
    discordUsername: string;
    status: ApplicationStatus;
    createdAt: string;
    teamAssignment?: TeamAssignment;
}

// Team Planning
export interface TeamSlotAssignment {
    mainPlayerId: string | null;
    subPlayerId: string | null;
}

export interface TeamPlanning {
    teamId: string;
    slots: Record<number, TeamSlotAssignment>; // Key is hourIndex (0-68)
}
