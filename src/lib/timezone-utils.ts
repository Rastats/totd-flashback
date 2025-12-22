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

/**
 * Convert a range of hours (startHour to endHour) on a given date to an array of hour_indices
 * Used for signup where users select a slot range
 */
export function userSlotToHourIndices(
    date: string, 
    startHour: number, 
    endHour: number, 
    userTimezone: string
): number[] {
    const indices: number[] = [];
    
    // Handle overnight slots (e.g., 22:00 to 02:00)
    if (endHour <= startHour) {
        // First part: startHour to midnight on current day
        for (let h = startHour; h < 24; h++) {
            const idx = userTimeToHourIndex(date, h, userTimezone);
            if (idx >= 0 && idx < EVENT_DURATION_HOURS) {
                indices.push(idx);
            }
        }
        // Second part: midnight to endHour on next day
        const [year, month, day] = date.split('-').map(Number);
        const nextDay = new Date(year, month - 1, day + 1);
        const nextDateStr = nextDay.toISOString().split('T')[0];
        for (let h = 0; h < endHour; h++) {
            const idx = userTimeToHourIndex(nextDateStr, h, userTimezone);
            if (idx >= 0 && idx < EVENT_DURATION_HOURS) {
                indices.push(idx);
            }
        }
    } else {
        // Normal case: same day
        for (let h = startHour; h < endHour; h++) {
            const idx = userTimeToHourIndex(date, h, userTimezone);
            if (idx >= 0 && idx < EVENT_DURATION_HOURS) {
                indices.push(idx);
            }
        }
    }
    
    return indices;
}

/**
 * Legacy function - kept for backwards compatibility during migration
 * @deprecated Use userTimeToHourIndex instead
 */
export function convertToParisTime(date: string, hour: number, fromTimezone: string): { date: string; hour: number } {
    const [year, month, day] = date.split('-').map(Number);

    const parisFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
    });

    const sourceFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: fromTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
    });

    // Create a reference point in UTC
    const referenceUTC = new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00Z`);

    // Get what time it shows in each timezone
    const sourceParts = sourceFormatter.formatToParts(referenceUTC);
    const parisParts = parisFormatter.formatToParts(referenceUTC);

    const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
        parseInt(parts.find(p => p.type === type)?.value || '0');

    const sourceHour = getPart(sourceParts, 'hour');
    const parisHour = getPart(parisParts, 'hour');
    const sourceDay = getPart(sourceParts, 'day');
    const parisDay = getPart(parisParts, 'day');

    // Calculate the hour and day difference
    const hourDiff = parisHour - sourceHour;
    const dayDiff = parisDay - sourceDay;

    // Apply the difference to get Paris time
    let parisHourResult = hour + hourDiff;
    let resultDay = day + dayDiff;
    let resultMonth = month;
    let resultYear = year;

    // Handle hour overflow/underflow
    if (parisHourResult >= 24) {
        parisHourResult -= 24;
        resultDay += 1;
    } else if (parisHourResult < 0) {
        parisHourResult += 24;
        resultDay -= 1;
    }

    // Handle month boundaries
    const daysInMonth = new Date(resultYear, resultMonth, 0).getDate();
    if (resultDay > daysInMonth) {
        resultDay = 1;
        resultMonth += 1;
    } else if (resultDay < 1) {
        resultMonth -= 1;
        resultDay = new Date(resultYear, resultMonth, 0).getDate();
    }

    const resultDate = `${resultYear}-${resultMonth.toString().padStart(2, '0')}-${resultDay.toString().padStart(2, '0')}`;

    return { date: resultDate, hour: parisHourResult };
}
