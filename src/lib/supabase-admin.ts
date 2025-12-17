import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Admin client with service_role key for server-side operations
// This bypasses RLS and should only be used in API routes (server-side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Lazy initialization to avoid build-time errors when env vars are not available
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
    if (!_supabaseAdmin) {
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables');
        }
        _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    }
    return _supabaseAdmin;
}

// For backward compatibility, but will throw at runtime if env vars missing
export const supabaseAdmin = {
    from: (table: string) => getSupabaseAdmin().from(table),
    rpc: (fn: string, params?: object) => getSupabaseAdmin().rpc(fn, params),
};
