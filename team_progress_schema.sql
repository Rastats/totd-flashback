-- Team Progress table for storing completed map IDs per team
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS team_progress (
    team_id INTEGER PRIMARY KEY CHECK (team_id >= 1 AND team_id <= 4),
    completed_ids INTEGER[] DEFAULT '{}',
    maps_completed INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT
);

-- Insert initial rows for all 4 teams
INSERT INTO team_progress (team_id, completed_ids, maps_completed)
VALUES 
    (1, '{}', 0),
    (2, '{}', 0),
    (3, '{}', 0),
    (4, '{}', 0)
ON CONFLICT (team_id) DO NOTHING;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_progress_team_id ON team_progress(team_id);

-- Add RLS policy (public read, authenticated write)
ALTER TABLE team_progress ENABLE ROW LEVEL SECURITY;

-- Allow read for everyone
CREATE POLICY "Allow public read" ON team_progress
    FOR SELECT USING (true);

-- Allow write for authenticated (or use service key)
CREATE POLICY "Allow service key write" ON team_progress
    FOR ALL USING (true);
