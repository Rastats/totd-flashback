// src/lib/timezone-utils.ts

/**
 * Event timing constants
 * Event: Dec 26, 2025 20:00 CET to Dec 29, 2025 17:00 CET
 * Duration: 69 hours (indices 0-68)
 */
export const EVENT_START_UTC = Date.UTC(2025, 11, 26, 19, 0, 0); // Dec 26, 19:00 UTC = 20:00 CET
export const EVENT_DURATION_HOURS = 69; // 0-68

/**
 * Convert hour_index (0-68) to Paris/CET date and hour
 */
export function hourIndexToDateTime(hourIndex: number): { date: string; hour: number } {
    const targetMs = EVENT_START_UTC + (hourIndex * 3600 * 1000);
    const targetDate = new Date(targetMs);
    
    // Format in Paris timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    
    const hourFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        hour12: false,
    });
    
    const dateParts = formatter.formatToParts(targetDate);
    const year = dateParts.find(p => p.type === 'year')?.value;
    const month = dateParts.find(p => p.type === 'month')?.value;
    const day = dateParts.find(p => p.type === 'day')?.value;
    
    const hourParts = hourFormatter.formatToParts(targetDate);
    let hour = parseInt(hourParts.find(p => p.type === 'hour')?.value || '0', 10);
    if (hour === 24) hour = 0;
    
    return {
        date: `${year}-${month}-${day}`,
        hour
    };
}

/**
 * Convert Paris/CET date and hour to hour_index (0-68)
 * Returns -1 if outside event range
 */
export function dateTimeToHourIndex(date: string, hour: number): number {
    // Create a date in Paris timezone
    const [year, month, day] = date.split('-').map(Number);
    
    // Create UTC date representing that Paris time
    // Paris is UTC+1 in winter (Dec), so subtract 1 hour to get UTC
    const utcDate = Date.UTC(year, month - 1, day, hour - 1, 0, 0);
    
    const diffMs = utcDate - EVENT_START_UTC;
    const hourIndex = Math.floor(diffMs / (3600 * 1000));
    
    if (hourIndex < 0 || hourIndex >= EVENT_DURATION_HOURS) {
        return -1;
    }
    
    return hourIndex;
}

/**
 * Convert user's local date+hour in their timezone to hour_index (0-68)
 * This is the main function for signup - converts user's local time to universal hour_index
 */
export function userTimeToHourIndex(date: string, hour: number, userTimezone: string): number {
    try {
        const [year, month, day] = date.split('-').map(Number);
        
        // Create a reference date in UTC
        const referenceUTC = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
        
        // Get what hour it shows in user's timezone at this UTC time
        const userFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: userTimezone,
            hour: '2-digit',
            hour12: false,
        });
        const userHourAtRef = parseInt(userFormatter.formatToParts(referenceUTC).find(p => p.type === 'hour')?.value || '0', 10);
        
        // Calculate offset: how many hours ahead is the user's input hour vs what UTC shows in their TZ
        // If user selected 14:00 and UTC reference shows 14:00 in their TZ, offset is 0
        // If user selected 14:00 but UTC reference shows 19:00 in their TZ, the user is UTC-5
        const offsetHours = hour - userHourAtRef;
        
        // Adjust UTC time by the offset to get the actual UTC moment the user meant
        const actualUTC = referenceUTC.getTime() + (offsetHours * 3600 * 1000);
        
        // Calculate hour index from event start
        const diffMs = actualUTC - EVENT_START_UTC;
        const hourIndex = Math.floor(diffMs / (3600 * 1000));
        
        if (hourIndex < 0 || hourIndex >= EVENT_DURATION_HOURS) {
            return -1;
        }
        
        return hourIndex;
    } catch (e) {
        console.error(`Timezone conversion error for ${userTimezone}:`, e);
        return -1;
    }
}
