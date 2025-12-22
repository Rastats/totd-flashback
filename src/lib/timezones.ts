// src/lib/timezones.ts

// Ordered west to east - December (winter) UTC offsets only
export const COMMON_TIMEZONES = [
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8)' },
    { value: 'America/Denver', label: 'America/Denver (UTC-7)' },
    { value: 'America/Chicago', label: 'America/Chicago (UTC-6)' },
    { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
    { value: 'America/Toronto', label: 'America/Toronto (UTC-5)' },
    { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (UTC-3)' },
    { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1)' },
    { value: 'Europe/Moscow', label: 'Europe/Moscow (UTC+3)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (UTC+11)' },
    { value: 'Pacific/Auckland', label: 'Pacific/Auckland (UTC+13)' },
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

// Event window - import from central config for local use and re-export
// Start: Dec 26, 2025 20:00 CET = Dec 26, 2025 19:00 UTC
// End: Dec 29, 2025 17:00 CET = Dec 29, 2025 16:00 UTC
import { EVENT_START_UTC, EVENT_END_UTC } from '@/lib/config';
export { EVENT_START_UTC, EVENT_END_UTC };

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
