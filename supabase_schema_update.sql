-- Add is_captain column to players table if it doesn't exist
alter table public.players 
add column if not exists is_captain boolean default false;

-- Policy to allow admins to update is_captain (if using RLS)
-- Assuming you rely on service_role key in API, this might not be strictly needed for the API rout,
-- but good to have if you switch to user-based RLS.
