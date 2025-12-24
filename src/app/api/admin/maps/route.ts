import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { insertSortedDesc, calculateHighestUnfinished } from '@/lib/progress-utils';

export const dynamic = 'force-dynamic';

// GET: Get completed maps for a team
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');

    if (!teamId) {
        return NextResponse.json({ error: 'team_id required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('team_server_state')
        .select('completed_map_ids, maps_completed')
        .eq('team_id', parseInt(teamId))
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        team_id: parseInt(teamId),
        completed_map_ids: data?.completed_map_ids || [],
        maps_completed: data?.maps_completed || 0
    });
}

// POST: Validate (add) a map to completed_map_ids
export async function POST(request: Request) {
    try {
        const { team_id, map_id } = await request.json();

        if (!team_id || !map_id) {
            return NextResponse.json({ error: 'team_id and map_id required' }, { status: 400 });
        }

        if (map_id < 1 || map_id > 2000) {
            return NextResponse.json({ error: 'map_id must be 1-2000' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get current state
        const { data: state, error: fetchError } = await supabase
            .from('team_server_state')
            .select('completed_map_ids')
            .eq('team_id', team_id)
            .single();

        if (fetchError) {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        const currentIds = state?.completed_map_ids || [];

        // Check if already completed
        if (currentIds.includes(map_id)) {
            return NextResponse.json({
                error: `Map ${map_id} is already completed for this team`
            }, { status: 400 });
        }

        // Add map to completed list using sorted insert (O(log n))
        const newIds = insertSortedDesc(currentIds, map_id);
        const highest_unfinished_id = calculateHighestUnfinished(newIds);

        const { error: updateError } = await supabase
            .from('team_server_state')
            .update({
                completed_map_ids: newIds,
                maps_completed: newIds.length,
                highest_unfinished_id: highest_unfinished_id,
                updated_at: new Date().toISOString()
            })
            .eq('team_id', team_id);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Log action
        await supabase.from('event_log').insert({
            event_type: 'map_validated',
            team_id: team_id,
            message: `[Admin] Validated map #${map_id}`,
            metadata: { map_id, admin_action: true }
        });

        return NextResponse.json({
            success: true,
            message: `Map ${map_id} validated`,
            maps_completed: newIds.length
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE: Invalidate (remove) a map from completed_map_ids
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('team_id');
        const mapId = searchParams.get('map_id');

        if (!teamId || !mapId) {
            return NextResponse.json({ error: 'team_id and map_id required' }, { status: 400 });
        }

        const teamIdNum = parseInt(teamId);
        const mapIdNum = parseInt(mapId);

        if (mapIdNum < 1 || mapIdNum > 2000) {
            return NextResponse.json({ error: 'map_id must be 1-2000' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get current state
        const { data: state, error: fetchError } = await supabase
            .from('team_server_state')
            .select('completed_map_ids')
            .eq('team_id', teamIdNum)
            .single();

        if (fetchError) {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        const currentIds: number[] = state?.completed_map_ids || [];

        // Check if map is in completed list
        if (!currentIds.includes(mapIdNum)) {
            return NextResponse.json({
                error: `Map ${mapIdNum} is not in completed list for this team`
            }, { status: 400 });
        }

        // Remove map from completed list (filter preserves order)
        const newIds = currentIds.filter(id => id !== mapIdNum);
        const highest_unfinished_id = calculateHighestUnfinished(newIds);

        const { error: updateError } = await supabase
            .from('team_server_state')
            .update({
                completed_map_ids: newIds,
                maps_completed: newIds.length,
                highest_unfinished_id: highest_unfinished_id,
                updated_at: new Date().toISOString()
            })
            .eq('team_id', teamIdNum);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Log action
        await supabase.from('event_log').insert({
            event_type: 'map_invalidated',
            team_id: teamIdNum,
            message: `[Admin] Invalidated map #${mapIdNum}`,
            metadata: { map_id: mapIdNum, admin_action: true }
        });

        return NextResponse.json({
            success: true,
            message: `Map ${mapIdNum} invalidated`,
            maps_completed: newIds.length
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
