import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET: Get all team progression
export async function GET(request: Request) {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('team_server_state')
        .select('team_id, maps_completed, updated_at')
        .order('team_id');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ teams: data });
}

// PUT: Update maps_completed for team
// Adjusts completed_map_ids based on difference:
// - Increasing: Add highest uncompleted maps (closest to 2000)
// - Decreasing: Remove lowest completed maps (furthest from 2000)
export async function PUT(request: Request) {
    try {
        const { team_id, maps_completed } = await request.json();

        if (!team_id || maps_completed === undefined) {
            return NextResponse.json({ error: 'team_id and maps_completed required' }, { status: 400 });
        }

        if (maps_completed < 0 || maps_completed > 2000) {
            return NextResponse.json({ error: 'maps_completed must be between 0 and 2000' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get current state
        const { data: current } = await supabase
            .from('team_server_state')
            .select('maps_completed, completed_map_ids')
            .eq('team_id', team_id)
            .single();

        const currentCount = current?.maps_completed || 0;
        let completed_map_ids: number[] = [...(current?.completed_map_ids || [])];
        const diff = maps_completed - currentCount;

        if (diff > 0) {
            // INCREASING: Add highest uncompleted maps (closest to 2000)
            // Build set of already completed for quick lookup
            const completedSet = new Set(completed_map_ids);
            let added = 0;

            // Start from 2000 and go down, add uncompleted maps
            for (let mapId = 2000; mapId >= 1 && added < diff; mapId--) {
                if (!completedSet.has(mapId)) {
                    completed_map_ids.push(mapId);
                    completedSet.add(mapId);
                    added++;
                }
            }
        } else if (diff < 0) {
            // DECREASING: Remove lowest completed maps (furthest from 2000)
            const toRemove = Math.abs(diff);

            // Sort to find lowest values
            completed_map_ids.sort((a, b) => a - b);

            // Remove from the beginning (lowest values)
            completed_map_ids = completed_map_ids.slice(toRemove);
        }
        // If diff === 0, no change needed

        const { error } = await supabase
            .from('team_server_state')
            .upsert({
                team_id: team_id,
                maps_completed: completed_map_ids.length,
                completed_map_ids: completed_map_ids,
                updated_at: new Date().toISOString()
            }, { onConflict: 'team_id' });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Log the change
        await supabase.from('event_log').insert({
            event_type: 'milestone',
            team_id: team_id,
            message: `[Admin] Progression updated: ${currentCount} → ${completed_map_ids.length}`,
            metadata: {
                old_value: currentCount,
                new_value: completed_map_ids.length,
                admin_action: true
            }
        });

        return NextResponse.json({ success: true, completed_map_ids });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Validate all maps above current map ID (union without duplicates)
// Used by admin panel to quickly mark maps as completed
export async function PATCH(request: Request) {
    try {
        const { team_id, current_map_id } = await request.json();

        if (!team_id || current_map_id === undefined) {
            return NextResponse.json({ error: 'team_id and current_map_id required' }, { status: 400 });
        }

        if (current_map_id < 1 || current_map_id > 2000) {
            return NextResponse.json({ error: 'current_map_id must be between 1 and 2000' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get current completed_map_ids
        const { data: current } = await supabase
            .from('team_server_state')
            .select('completed_map_ids, maps_completed')
            .eq('team_id', team_id)
            .single();

        // Start with existing completed maps (or empty array)
        const existingIds: number[] = current?.completed_map_ids || [];
        const existingSet = new Set(existingIds);

        // Add all maps with ID > current_map_id (maps above current)
        // These are maps #(current_map_id + 1) up to #2000
        const mapsToAdd: number[] = [];
        for (let mapId = current_map_id + 1; mapId <= 2000; mapId++) {
            if (!existingSet.has(mapId)) {
                mapsToAdd.push(mapId);
                existingSet.add(mapId);
            }
        }

        // Merge into completed_map_ids
        const completed_map_ids = [...existingIds, ...mapsToAdd];
        const maps_completed = completed_map_ids.length;

        const { error } = await supabase
            .from('team_server_state')
            .update({
                maps_completed: maps_completed,
                completed_map_ids: completed_map_ids,
                updated_at: new Date().toISOString()
            })
            .eq('team_id', team_id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Log the change
        await supabase.from('event_log').insert({
            event_type: 'milestone',
            team_id: team_id,
            message: `[Admin] Validated all maps above #${current_map_id}: ${current?.maps_completed || 0} → ${maps_completed} (added ${mapsToAdd.length} maps)`,
            metadata: {
                old_value: current?.maps_completed,
                new_value: maps_completed,
                current_map_id: current_map_id,
                maps_added: mapsToAdd.length,
                admin_action: true
            }
        });

        return NextResponse.json({
            success: true,
            maps_completed,
            maps_added: mapsToAdd.length,
            completed_map_ids
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE: Reset team progression
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('team_id');

        if (!teamId) {
            return NextResponse.json({ error: 'team_id required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        const { error } = await supabase
            .from('team_server_state')
            .update({
                maps_completed: 0,
                completed_map_ids: [],  // Clear the array too
                updated_at: new Date().toISOString()
            })
            .eq('team_id', parseInt(teamId));

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Log the reset
        await supabase.from('event_log').insert({
            event_type: 'milestone',
            team_id: parseInt(teamId),
            message: `[Admin] Progression RESET to 0`,
            metadata: { admin_action: true, reset: true }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
