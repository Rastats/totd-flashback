// src/lib/timezones.ts

// Ordered west to east - December (winter) UTC offsets only
export const COMMON_TIMEZONES = [
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8)' },
    { value: 'America/Denver', label: 'America/Denver (UTC-7)' },
    { value: 'America/Chicago', label: 'America/Chicago (UTC-6)' },
    { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
    { value: 'America/Sao_Paulo', label: 'America/São Paulo (UTC-3)' },
    { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1)' },
    { value: 'Europe/Athens', label: 'Europe/Athens (UTC+2)' },
    { value: 'Europe/Istanbul', label: 'Europe/Istanbul (UTC+3)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
    { value: 'Asia/Jakarta', label: 'Asia/Jakarta (UTC+7)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
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
