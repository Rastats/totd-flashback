// src/components/AvailabilityGrid.tsx
// Reusable availability grid component for signup forms and admin editing

"use client";

import { useMemo } from "react";
import { EVENT_START_UTC, EVENT_DURATION_HOURS } from "@/lib/config";

interface AvailabilityGridProps {
    timezone: string;
    selectedHours: number[];  // Array of hour_index (0-68)
    onToggle: (hourIndex: number) => void;
    readOnly?: boolean;
}

/**
 * Check if timezone is in the Americas (uses MM/DD format)
 */
function isAmericanTimezone(tz: string): boolean {
    return tz.startsWith("America/") || tz.includes("US/");
}

/**
 * Get the days array for a given timezone
 * Returns dates in the user's local timezone that overlap with the event
 */
function getEventDaysForTimezone(timezone: string): { date: Date; dateStr: string }[] {
    const days: { date: Date; dateStr: string }[] = [];

    // Event spans from Dec 26 19:00 UTC to Dec 29 16:00 UTC (69 hours)
    // We need to find which local dates this covers in the user's timezone

    const eventStartMs = EVENT_START_UTC;
    const eventEndMs = EVENT_START_UTC + (EVENT_DURATION_HOURS * 3600 * 1000);

    // Get local date for event start
    const startDate = new Date(eventStartMs);
    const endDate = new Date(eventEndMs);

    // Format start and end in user's timezone to find date range
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const startLocalStr = dateFormatter.format(startDate);
    const endLocalStr = dateFormatter.format(endDate);

    // Parse dates and create range
    const [startYear, startMonth, startDay] = startLocalStr.split('-').map(Number);
    const [endYear, endMonth, endDay] = endLocalStr.split('-').map(Number);

    const currentDate = new Date(startYear, startMonth - 1, startDay);
    const lastDate = new Date(endYear, endMonth - 1, endDay);

    while (currentDate <= lastDate) {
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth() + 1;
        const d = currentDate.getDate();
        days.push({
            date: new Date(currentDate),
            dateStr: `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
}

/**
 * For a given local date and hour in user's timezone, get the hour_index (0-68)
 * Returns -1 if outside event range
 */
function localToHourIndex(date: string, hour: number, timezone: string): number {
    try {
        const [year, month, day] = date.split('-').map(Number);

        // Create a date object representing this local time
        // We need to find the UTC timestamp for this local time
        const localDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:00:00`;

        // Use a reference approach to find the offset
        const refUTC = Date.UTC(year, month - 1, day, hour, 0, 0);
        const refDate = new Date(refUTC);

        // Get what hour it shows in user's timezone at this UTC time
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            hour: '2-digit',
            day: '2-digit',
            hour12: false,
        });
        const parts = formatter.formatToParts(refDate);
        const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
        const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);

        // Calculate offset between what we want and what UTC reference shows
        const hourDiff = hour - tzHour;
        let dayDiff = day - tzDay;

        // Adjust for day boundary crossings
        if (dayDiff > 15) dayDiff -= 30; // Month boundary backwards
        if (dayDiff < -15) dayDiff += 30; // Month boundary forwards

        // The actual UTC time the user means
        const actualUTC = refUTC + (hourDiff * 3600 * 1000) + (dayDiff * 24 * 3600 * 1000);

        // Calculate hour index from event start
        const diffMs = actualUTC - EVENT_START_UTC;
        const hourIndex = Math.floor(diffMs / (3600 * 1000));

        if (hourIndex < 0 || hourIndex >= EVENT_DURATION_HOURS) {
            return -1;
        }

        return hourIndex;
    } catch (e) {
        console.error(`Error converting ${date} ${hour}:00 in ${timezone}:`, e);
        return -1;
    }
}

/**
 * Format date label based on timezone (DD/MM for most, MM/DD for Americas)
 */
function formatDateLabel(date: Date, isAmerican: boolean): string {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    return isAmerican ? `${m}/${d}` : `${d}/${m}`;
}

export default function AvailabilityGrid({
    timezone,
    selectedHours,
    onToggle,
    readOnly = false
}: AvailabilityGridProps) {
    const isAmerican = isAmericanTimezone(timezone);
    const days = useMemo(() => getEventDaysForTimezone(timezone), [timezone]);

    // Build grid data: for each day, for each hour 0-23, calculate hour_index
    const gridData = useMemo(() => {
        return days.map(({ date, dateStr }) => {
            const hours = [];
            for (let h = 0; h < 24; h++) {
                const hourIndex = localToHourIndex(dateStr, h, timezone);
                hours.push({
                    hour: h,
                    hourIndex, // -1 if outside event
                    isDisabled: hourIndex < 0,
                    isSelected: hourIndex >= 0 && selectedHours.includes(hourIndex)
                });
            }
            return {
                date,
                dateStr,
                label: formatDateLabel(date, isAmerican),
                hours
            };
        });
    }, [days, timezone, selectedHours, isAmerican]);

    const cellSize = 28;
    const cellGap = 1;  // marginRight of each cell
    const labelWidth = 50;

    return (
        <div style={{ overflowX: 'auto' }}>
            {/* Hour labels row - positioned at intersections */}
            <div style={{ display: 'flex', marginLeft: labelWidth, marginBottom: 2 }}>
                {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} style={{
                        width: cellSize + cellGap,
                        fontSize: 10,
                        color: '#94a3b8',
                        textAlign: 'center',
                        position: 'relative',
                        left: -(cellSize / 2),
                    }}>
                        {i}
                    </div>
                ))}
            </div>

            {/* Grid rows */}
            {gridData.map((day) => (
                <div key={day.dateStr} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                    {/* Date label */}
                    <div style={{
                        width: labelWidth,
                        fontSize: 12,
                        color: '#e2e8f0',
                        textAlign: 'right',
                        paddingRight: 8,
                        fontWeight: 500,
                    }}>
                        {day.label}
                    </div>

                    {/* Hour cells */}
                    {day.hours.map((cell) => (
                        <div
                            key={`${day.dateStr}-${cell.hour}`}
                            onClick={() => {
                                if (!readOnly && !cell.isDisabled && cell.hourIndex >= 0) {
                                    onToggle(cell.hourIndex);
                                }
                            }}
                            style={{
                                width: cellSize,
                                height: cellSize,
                                border: '1px solid #334155',
                                borderRadius: 3,
                                marginRight: 1,
                                cursor: cell.isDisabled || readOnly ? 'default' : 'pointer',
                                backgroundColor: cell.isDisabled
                                    ? '#1e293b'
                                    : cell.isSelected
                                        ? '#22c55e'
                                        : '#0f172a',
                                opacity: cell.isDisabled ? 0.4 : 1,
                                transition: 'background-color 0.1s',
                            }}
                            title={cell.isDisabled
                                ? 'Outside event hours'
                                : `${day.label} ${cell.hour}:00-${cell.hour + 1}:00`
                            }
                        />
                    ))}
                </div>
            ))}

            {/* Legend */}
            <div style={{
                display: 'flex',
                gap: 16,
                marginTop: 12,
                marginLeft: labelWidth,
                fontSize: 11,
                color: '#94a3b8'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 14, height: 14, backgroundColor: '#22c55e', borderRadius: 2 }} />
                    Available
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 14, height: 14, backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 2 }} />
                    Not available
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 14, height: 14, backgroundColor: '#1e293b', opacity: 0.5, borderRadius: 2 }} />
                    Outside event
                </div>
            </div>
        </div>
    );
}
