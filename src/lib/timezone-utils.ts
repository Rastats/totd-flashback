// src/lib/timezone-utils.ts

/**
 * Convert a date+hour from user's timezone to Paris timezone.
 * This ensures all availability slots are stored in Paris time for consistent display.
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
