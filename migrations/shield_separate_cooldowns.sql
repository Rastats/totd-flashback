-- Add separate cooldown columns for small and big shields
-- Run this in Supabase SQL Editor

-- Rename existing column to small cooldown
ALTER TABLE team_server_state 
RENAME COLUMN shield_cooldown_expires_at TO shield_small_cooldown_expires_at;

-- Add big cooldown column
ALTER TABLE team_server_state 
ADD COLUMN shield_big_cooldown_expires_at TIMESTAMPTZ;
