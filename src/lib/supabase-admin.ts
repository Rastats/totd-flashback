import { createClient } from '@supabase/supabase-js';

// Admin client with service_role key for server-side operations
// This bypasses RLS and should only be used in API routes (server-side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
