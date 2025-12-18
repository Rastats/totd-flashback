import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export interface EventLogEntry {
    id: string;
    event_type: 'donation' | 'penalty_applied' | 'penalty_completed' | 'shield_activated' | 'shield_expired' | 'milestone' | 'month_finished';
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

        let query = supabaseAdmin
            .from('event_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(Math.min(limit, 100));

        if (teamId) {
            query = query.eq('team_id', parseInt(teamId, 10));
        }

        const { data, error } = await query;

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
            events: data || [],
            count: data?.length || 0
        });

    } catch (error) {
        console.error('[EventLog] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/event-log
// Creates a new event log entry
// Body: { event_type, team_id?, message, metadata? }
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { event_type, team_id, message, metadata } = body;

        if (!event_type || !message) {
            return NextResponse.json(
                { error: 'Missing event_type or message' },
                { status: 400 }
            );
        }

        const validTypes = ['donation', 'penalty_applied', 'penalty_completed', 'shield_activated', 'shield_expired', 'milestone', 'month_finished'];
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
                metadata: metadata || {},
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
