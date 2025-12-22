// src/lib/totdCache.ts
// Cached TOTD lookups for O(1) access by UID or index

import { totds } from '@/data/totds';

// Build lookup maps once at module load
const totdsByUid = new Map<string, typeof totds[0]>();
const totdsByIndex = new Map<number, typeof totds[0]>();

// Populate caches
totds.forEach((totd, index) => {
    totdsByUid.set(totd.mapUid, totd);
    totdsByIndex.set(index + 1, totd); // 1-indexed
});

/**
 * Get TOTD by UID - O(1) lookup
 */
export function getTotdByUid(uid: string) {
    return totdsByUid.get(uid) || null;
}

/**
 * Get TOTD by index (1-based) - O(1) lookup
 */
export function getTotdByIndex(index: number) {
    return totdsByIndex.get(index) || null;
}

/**
 * Check if UID is a valid TOTD - O(1) lookup
 */
export function isTotd(uid: string): boolean {
    return totdsByUid.has(uid);
}

/**
 * Get total number of TOTDs
 */
export function getTotdCount(): number {
    return totds.length;
}

// Re-export totds array for cases where full array is needed
export { totds };
