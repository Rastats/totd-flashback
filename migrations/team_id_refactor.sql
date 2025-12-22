-- Migration: Rename team_assignment to team_id and convert to integer
-- Run this in Supabase SQL Editor

-- Step 1: Add new integer column
ALTER TABLE players ADD COLUMN team_id INTEGER;

-- Step 2: Migrate data from old column to new
UPDATE players SET team_id = CASE
    WHEN team_assignment = 'team1' OR team_assignment = '1' THEN 1
    WHEN team_assignment = 'team2' OR team_assignment = '2' THEN 2
    WHEN team_assignment = 'team3' OR team_assignment = '3' THEN 3
    WHEN team_assignment = 'team4' OR team_assignment = '4' THEN 4
    WHEN team_assignment = 'joker' THEN 0
    ELSE NULL
END;

-- Step 3: Drop old column
ALTER TABLE players DROP COLUMN team_assignment;

-- Verify:
-- SELECT id, team_id FROM players;
