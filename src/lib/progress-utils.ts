/**
 * Progress Utilities
 * 
 * Helper functions for managing completed_map_ids:
 * - Sorted insert (descending order)
 * - Calculate highest unfinished ID
 */

/**
 * Insert a map ID into a sorted array (descending order) at the correct position.
 * Uses binary search for O(log n) position finding.
 * Returns the new array (does not mutate input).
 */
export function insertSortedDesc(sortedArray: number[], newId: number): number[] {
    // If ID already exists, return unchanged
    if (sortedArray.includes(newId)) {
        return sortedArray;
    }

    const result = [...sortedArray];

    // Binary search for insertion position (descending order)
    let left = 0;
    let right = result.length;

    while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (result[mid] > newId) {
            left = mid + 1;
        } else {
            right = mid;
        }
    }

    // Insert at found position
    result.splice(left, 0, newId);
    return result;
}

/**
 * Calculate the highest unfinished map ID from a sorted (descending) completed_map_ids array.
 * Walks from left to right, returns first missing ID.
 * 
 * @param sortedDescArray - Array sorted in descending order (e.g., [2000, 1999, 1998, 1995, ...])
 * @param maxMapId - Maximum possible map ID (default 2000)
 * @returns The highest unfinished map ID, or 0 if all maps are completed
 */
export function calculateHighestUnfinished(sortedDescArray: number[], maxMapId: number = 2000): number {
    if (sortedDescArray.length === 0) {
        return maxMapId; // No maps completed, highest unfinished is max
    }

    let expected = maxMapId;

    for (const id of sortedDescArray) {
        if (id !== expected) {
            // Found a gap - expected is the highest unfinished
            return expected;
        }
        expected--;
    }

    // No gaps found in the array
    // Return the next expected (which is after the last completed)
    // If expected is 0, all maps 1-2000 are completed
    return expected > 0 ? expected : 0;
}

/**
 * Sort an array in descending order (for migration of existing unsorted data)
 */
export function sortDescending(array: number[]): number[] {
    return [...array].sort((a, b) => b - a);
}
