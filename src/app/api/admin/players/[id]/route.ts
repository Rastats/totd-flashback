import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ADMIN_KEY = "totd-admin-2025";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const adminKey = request.headers.get("x-admin-key");
        if (adminKey !== ADMIN_KEY) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const updateData: Record<string, unknown> = {};
        if (body.status) updateData.status = body.status;
        if (body.teamAssignment) updateData.team_assignment = body.teamAssignment;

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
