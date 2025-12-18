-- Migration: Normalize team_planning table
-- This replaces the JSONB structure with proper relational data

-- 1. Backup and drop old table first
ALTER TABLE IF EXISTS team_planning RENAME TO team_planning_old;

-- 2. Create new normalized table (same name: team_planning)
CREATE TABLE team_planning (
    id SERIAL PRIMARY KEY,
    team_id TEXT NOT NULL CHECK (team_id IN ('team1', 'team2', 'team3', 'team4')),
    hour_index INTEGER NOT NULL CHECK (hour_index >= 0 AND hour_index < 72),
    main_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    sub_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Each team can only have one entry per hour
    UNIQUE (team_id, hour_index)
);

-- 3. Create index for fast lookups
CREATE INDEX idx_team_planning_team ON team_planning(team_id);
CREATE INDEX idx_team_planning_hour ON team_planning(hour_index);

-- 4. Enable RLS
ALTER TABLE team_planning ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated (captains need to see)
CREATE POLICY "Allow read" ON team_planning FOR SELECT USING (true);

-- Allow write for authenticated (captains need to update)
CREATE POLICY "Allow write" ON team_planning FOR ALL USING (true);

-- 5. Migrate existing data from old JSONB structure
DO $$
DECLARE
    r RECORD;
    slot_key TEXT;
    slot_value JSONB;
    main_id UUID;
    sub_id UUID;
BEGIN
    FOR r IN SELECT team_id, slots FROM team_planning_old WHERE slots IS NOT NULL LOOP
        FOR slot_key, slot_value IN SELECT * FROM jsonb_each(r.slots) LOOP
            main_id := NULL;
            sub_id := NULL;
            
            IF slot_value->>'mainPlayerId' IS NOT NULL AND slot_value->>'mainPlayerId' != 'null' THEN
                main_id := (slot_value->>'mainPlayerId')::UUID;
            END IF;
            
            IF slot_value->>'subPlayerId' IS NOT NULL AND slot_value->>'subPlayerId' != 'null' THEN
                sub_id := (slot_value->>'subPlayerId')::UUID;
            END IF;
            
            -- Only insert if there's at least one player assigned
            IF main_id IS NOT NULL OR sub_id IS NOT NULL THEN
                INSERT INTO team_planning (team_id, hour_index, main_player_id, sub_player_id)
                VALUES (r.team_id, slot_key::INTEGER, main_id, sub_id)
                ON CONFLICT (team_id, hour_index) 
                DO UPDATE SET main_player_id = EXCLUDED.main_player_id, sub_player_id = EXCLUDED.sub_player_id;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 6. Drop old table after verifying migration worked
-- DROP TABLE team_planning_old;
-- Uncomment above line after confirming data migrated correctly

