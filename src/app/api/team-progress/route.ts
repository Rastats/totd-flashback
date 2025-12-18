import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateApiKey } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// POST /api/team-progress
// Sync completed map IDs for a team
// Body: { team_id: number, completed_ids: number[], account_id: string }
export async function POST(request: Request) {
    try {
        // Validate API key
        if (!validateApiKey(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await request.json();
        const { team_id, completed_ids, account_id } = data;

        if (!team_id || team_id < 1 || team_id > 4) {
            return NextResponse.json({ error: 'Invalid team_id' }, { status: 400 });
        }

        if (!Array.isArray(completed_ids)) {
            return NextResponse.json({ error: 'completed_ids must be an array' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Verify player is in roster
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('trackmania_name, team_assignment')
            .or(`trackmania_id.eq.${account_id},trackmania_name.eq.${account_id}`)
            .eq('status', 'approved')
            .single();

        if (playerError || !player) {
            return NextResponse.json({ success: false, reason: 'not_in_roster' });
        }

        // Get existing progress for this team
        const { data: existing } = await supabase
            .from('team_progress')
            .select('completed_ids')
            .eq('team_id', team_id)
            .single();

        // Merge: union of existing and new IDs
        const existingIds: number[] = existing?.completed_ids || [];
        const mergedIds = [...new Set([...existingIds, ...completed_ids])];
        mergedIds.sort((a, b) => a - b);

        // Upsert the merged progress
        const { error: upsertError } = await supabase
            .from('team_progress')
            .upsert({
                team_id: team_id,
                completed_ids: mergedIds,
                maps_completed: mergedIds.length,
                updated_at: new Date().toISOString(),
                updated_by: player.trackmania_name
            }, {
                onConflict: 'team_id'
            });

        if (upsertError) {
            console.error('[TeamProgress] Upsert error:', upsertError);
            return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        console.log(`[TeamProgress] Team ${team_id} updated by ${player.trackmania_name}: ${mergedIds.length} maps`);

        return NextResponse.json({
            success: true,
            team_id: team_id,
            maps_completed: mergedIds.length,
            completed_ids: mergedIds
        });

    } catch (error) {
        console.error('[TeamProgress] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET /api/team-progress?team_id=N
// Get completed map IDs for a team
export async function GET(request: Request) {
    try {
        // Validate API key
        if (!validateApiKey(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const teamIdStr = searchParams.get('team_id');

        const supabase = getSupabaseAdmin();

        // If team_id specified, get just that team
        if (teamIdStr) {
            const teamId = parseInt(teamIdStr, 10);
            if (teamId < 1 || teamId > 4) {
                return NextResponse.json({ error: 'Invalid team_id' }, { status: 400 });
            }

            const { data, error } = await supabase
                .from('team_progress')
                .select('*')
                .eq('team_id', teamId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json(data || {
                team_id: teamId,
                completed_ids: [],
                maps_completed: 0
            });
        }

        // Return all teams
        const { data: allTeams, error } = await supabase
            .from('team_progress')
            .select('*')
            .order('team_id');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(allTeams || []);

    } catch (error) {
        console.error('[TeamProgress] GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
