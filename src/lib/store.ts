// src/lib/store.ts
// Simple JSON file store for V1 development (no external database needed)

import { promises as fs } from 'fs';
import path from 'path';
import { PlayerApplication, CasterApplication } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const CASTERS_FILE = path.join(DATA_DIR, 'casters.json');

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// Generate unique ID
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// PLAYERS

export async function getPlayers(): Promise<PlayerApplication[]> {
    await ensureDataDir();
    try {
        const data = await fs.readFile(PLAYERS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function getPlayerById(id: string): Promise<PlayerApplication | null> {
    const players = await getPlayers();
    return players.find(p => p.id === id) || null;
}

export async function createPlayer(data: Omit<PlayerApplication, 'id' | 'createdAt' | 'status' | 'teamAssignment' | 'staffInternalNotes'>): Promise<PlayerApplication> {
    const players = await getPlayers();

    const newPlayer: PlayerApplication = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        teamAssignment: null,
        staffInternalNotes: '',
    };

    players.push(newPlayer);
    await fs.writeFile(PLAYERS_FILE, JSON.stringify(players, null, 2));
    return newPlayer;
}

export async function updatePlayer(id: string, updates: Partial<PlayerApplication>): Promise<PlayerApplication | null> {
    const players = await getPlayers();
    const index = players.findIndex(p => p.id === id);
    if (index === -1) return null;

    players[index] = { ...players[index], ...updates };
    await fs.writeFile(PLAYERS_FILE, JSON.stringify(players, null, 2));
    return players[index];
}

export async function deletePlayer(id: string): Promise<boolean> {
    const players = await getPlayers();
    const filtered = players.filter(p => p.id !== id);
    if (filtered.length === players.length) return false;

    await fs.writeFile(PLAYERS_FILE, JSON.stringify(filtered, null, 2));
    return true;
}

// CASTERS

export async function getCasters(): Promise<CasterApplication[]> {
    await ensureDataDir();
    try {
        const data = await fs.readFile(CASTERS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function getCasterById(id: string): Promise<CasterApplication | null> {
    const casters = await getCasters();
    return casters.find(c => c.id === id) || null;
}

export async function createCaster(data: Omit<CasterApplication, 'id' | 'createdAt' | 'status' | 'staffInternalNotes'>): Promise<CasterApplication> {
    const casters = await getCasters();

    const newCaster: CasterApplication = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        staffInternalNotes: '',
    };

    casters.push(newCaster);
    await fs.writeFile(CASTERS_FILE, JSON.stringify(casters, null, 2));
    return newCaster;
}

export async function updateCaster(id: string, updates: Partial<CasterApplication>): Promise<CasterApplication | null> {
    const casters = await getCasters();
    const index = casters.findIndex(c => c.id === id);
    if (index === -1) return null;

    casters[index] = { ...casters[index], ...updates };
    await fs.writeFile(CASTERS_FILE, JSON.stringify(casters, null, 2));
    return casters[index];
}

export async function deleteCaster(id: string): Promise<boolean> {
    const casters = await getCasters();
    const filtered = casters.filter(c => c.id !== id);
    if (filtered.length === casters.length) return false;

    await fs.writeFile(CASTERS_FILE, JSON.stringify(filtered, null, 2));
    return true;
}

// TEAMS PLANNING

const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');

import { TeamPlanning, TeamSlotAssignment } from './types';

export async function getTeamPlanning(teamId: string): Promise<TeamPlanning> {
    await ensureDataDir();
    try {
        const data = await fs.readFile(TEAMS_FILE, 'utf-8');
        const allTeams: TeamPlanning[] = JSON.parse(data);
        const team = allTeams.find(t => t.teamId === teamId);

        if (team) return team;

        // Return default empty structure if not found
        return { teamId, slots: {} };
    } catch {
        return { teamId, slots: {} };
    }
}

export async function updateTeamPlanning(teamId: string, slots: Record<number, TeamSlotAssignment>): Promise<TeamPlanning> {
    await ensureDataDir();
    let allTeams: TeamPlanning[] = [];
    try {
        const data = await fs.readFile(TEAMS_FILE, 'utf-8');
        allTeams = JSON.parse(data);
    } catch {
        allTeams = [];
    }

    const index = allTeams.findIndex(t => t.teamId === teamId);
    if (index !== -1) {
        allTeams[index] = { ...allTeams[index], slots };
    } else {
        allTeams.push({ teamId, slots });
    }

    await fs.writeFile(TEAMS_FILE, JSON.stringify(allTeams, null, 2));
    return allTeams.find(t => t.teamId === teamId)!;
}
