import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateApiKey } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export interface EventLogEntry {
    id: string;
    event_type: 'donation' | 'penalty_applied' | 'penalty_completed' | 'shield_activated' | 'shield_expired' | 'milestone' | 'month_finished' | 'penalty_active' | 'shield_active' | 'player_switch';
    team_id: number | null;
    message: string;
    metadata: Record<string, unknown>;
    created_at: string;
}

// GET /api/event-log?limit=20
// Returns recent event log entries
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const teamId = searchParams.get('team_id');

        // Only show these event types in public live feed
        const allowedTypes = ['donation', 'penalty_applied', 'shield_activated', 'milestone', 'month_finished', 'player_switch'];

        let query = supabaseAdmin
            .from('event_log')
            .select('*')
            .in('event_type', allowedTypes)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 100));

        if (teamId) {
            query = query.eq('team_id', parseInt(teamId, 10));
        }

        const { data, error } = await query;

        // Filter out admin actions (metadata.admin_action = true)
        const filteredData = data?.filter((event: any) => {
            return !event.metadata?.admin_action;
        }) || [];

        if (error) {
            // Table might not exist yet, return empty array
            if (error.code === '42P01') {
                console.warn('[EventLog] Table does not exist yet');
                return NextResponse.json({ events: [], message: 'Event log table not configured' });
            }
            console.error('[EventLog] Query error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            events: filteredData,
            count: filteredData.length
        });

    } catch (error) {
        console.error('[EventLog] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/event-log
// Creates a new event log entry
// Body: { event_type, team_id?, message, metadata?, player_name?, details? }
// Requires X-API-Key header from plugin
export async function POST(request: Request) {
    try {
        // Validate API key (plugin authentication)
        if (!validateApiKey(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        let { event_type, team_id, message, metadata, player_name, details } = body;

        // Build message from plugin data if not provided
        if (!message && details) {
            message = details;
        }

        if (!event_type || !message) {
            return NextResponse.json(
                { error: 'Missing event_type or message/details' },
                { status: 400 }
            );
        }

        const validTypes = [
            'donation', 'penalty_applied', 'penalty_completed',
            'shield_activated', 'shield_expired', 'milestone', 'month_finished',
            'penalty_active', 'shield_active', 'player_switch'  // Plugin event types
        ];
        if (!validTypes.includes(event_type)) {
            return NextResponse.json(
                { error: `Invalid event_type. Must be one of: ${validTypes.join(', ')}` },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('event_log')
            .insert({
                event_type,
                team_id: team_id || null,
                message,
                metadata: {
                    ...metadata,
                    player_name: player_name || null,
                },
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('[EventLog] Insert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            event: data
        });

    } catch (error) {
        console.error('[EventLog] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
