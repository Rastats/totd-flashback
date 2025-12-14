// src/lib/timezones.ts

export const COMMON_TIMEZONES = [
    { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
    { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
    { value: 'Europe/Madrid', label: 'Europe/Madrid (CET/CEST)' },
    { value: 'Europe/Rome', label: 'Europe/Rome (CET/CEST)' },
    { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET/CEST)' },
    { value: 'Europe/Brussels', label: 'Europe/Brussels (CET/CEST)' },
    { value: 'Europe/Warsaw', label: 'Europe/Warsaw (CET/CEST)' },
    { value: 'Europe/Stockholm', label: 'Europe/Stockholm (CET/CEST)' },
    { value: 'Europe/Helsinki', label: 'Europe/Helsinki (EET/EEST)' },
    { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK)' },
    { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
    { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
    { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
    { value: 'America/Toronto', label: 'America/Toronto (EST/EDT)' },
    { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
    { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST/NZDT)' },
];

export const LANGUAGES = [
    'English',
    'French',
    'German',
    'Spanish',
    'Portuguese',
    'Italian',
    'Dutch',
    'Polish',
    'Russian',
    'Swedish',
    'Norwegian',
    'Danish',
    'Finnish',
    'Japanese',
    'Korean',
    'Chinese',
    'Other',
];

// Event window in UTC
// Start: Dec 21, 2025 21:00 Paris = Dec 21, 2025 20:00 UTC
// End: Dec 24, 2025 18:00 Paris = Dec 24, 2025 17:00 UTC
export const EVENT_START_UTC = new Date('2025-12-21T20:00:00Z');
export const EVENT_END_UTC = new Date('2025-12-24T17:00:00Z');

// Get event days for availability picker, adjusted for user's timezone
export function getEventDays(timezone: string): { date: string; label: string; startHour: number; endHour: number }[] {
    if (!timezone) return [];

    const days: { date: string; label: string; startHour: number; endHour: number }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Convert event start/end to the user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
    });

    // Get the local date/time for event start and end
    const startParts = formatter.formatToParts(EVENT_START_UTC);
    const endParts = formatter.formatToParts(EVENT_END_UTC);

    const getPartValue = (parts: Intl.DateTimeFormatPart[], type: string) =>
        parts.find(p => p.type === type)?.value || '';

    const startYear = parseInt(getPartValue(startParts, 'year'));
    const startMonth = parseInt(getPartValue(startParts, 'month')) - 1;
    const startDay = parseInt(getPartValue(startParts, 'day'));
    const startHour = parseInt(getPartValue(startParts, 'hour'));

    const endYear = parseInt(getPartValue(endParts, 'year'));
    const endMonth = parseInt(getPartValue(endParts, 'month')) - 1;
    const endDay = parseInt(getPartValue(endParts, 'day'));
    const endHour = parseInt(getPartValue(endParts, 'hour'));

    // Create a date for each day in the event period
    const currentDate = new Date(startYear, startMonth, startDay);
    const lastDate = new Date(endYear, endMonth, endDay);

    while (currentDate <= lastDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const day = currentDate.getDate();
        const dayOfWeek = currentDate.getDay();

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const label = `${dayNames[dayOfWeek]} ${day} ${monthNames[month]}`;

        // Determine valid hours for this day
        let dayStartHour = 0;
        let dayEndHour = 24;

        if (day === startDay && month === startMonth) {
            dayStartHour = startHour; // First day starts at event start hour
        }
        if (day === endDay && month === endMonth) {
            dayEndHour = endHour; // Last day ends at event end hour
        }

        days.push({ date: dateStr, label, startHour: dayStartHour, endHour: dayEndHour });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
}

// Hours for dropdown (in 1h increments)
export function getHoursOptions(): { value: number; label: string }[] {
    const hours = [];
    for (let h = 0; h <= 24; h++) {
        hours.push({
            value: h,
            label: h === 24 ? '00:00 (next day)' : `${h.toString().padStart(2, '0')}:00`,
        });
    }
    return hours;
}
