import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

import { isAdmin } from '@/lib/auth';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const isUserAdmin = await isAdmin();
        if (!isUserAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const updateData: Record<string, unknown> = {};
        if (body.status) updateData.status = body.status;
        if (body.teamAssignment) updateData.team_assignment = body.teamAssignment;
        if (typeof body.isCaptain === 'boolean') updateData.is_captain = body.isCaptain;

        const { error } = await supabase
            .from('players')
            .update(updateData)
            .eq('id', id);

        if (error) {
            console.error('Update player error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
