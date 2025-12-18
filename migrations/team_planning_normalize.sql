-- Migration: Normalize team_planning table
-- This replaces the JSONB structure with proper relational data

-- 1. Create new normalized table
CREATE TABLE IF NOT EXISTS team_planning_slots (
    id SERIAL PRIMARY KEY,
    team_id TEXT NOT NULL CHECK (team_id IN ('team1', 'team2', 'team3', 'team4')),
    hour_index INTEGER NOT NULL CHECK (hour_index >= 0 AND hour_index < 72),
    main_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    sub_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Each team can only have one entry per hour
    UNIQUE (team_id, hour_index)
);

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_team_planning_slots_team ON team_planning_slots(team_id);
CREATE INDEX IF NOT EXISTS idx_team_planning_slots_hour ON team_planning_slots(hour_index);

-- 3. Enable RLS
ALTER TABLE team_planning_slots ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated (captains need to see)
CREATE POLICY "Allow read" ON team_planning_slots FOR SELECT USING (true);

-- Allow write for authenticated (captains need to update)
CREATE POLICY "Allow write" ON team_planning_slots FOR ALL USING (true);

-- 4. Migrate existing data from old JSONB structure (run once)
-- This extracts data from team_planning.slots JSONB into the new table
DO $$
DECLARE
    r RECORD;
    slot_key TEXT;
    slot_value JSONB;
    main_id UUID;
    sub_id UUID;
BEGIN
    FOR r IN SELECT team_id, slots FROM team_planning WHERE slots IS NOT NULL LOOP
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
                INSERT INTO team_planning_slots (team_id, hour_index, main_player_id, sub_player_id)
                VALUES (r.team_id, slot_key::INTEGER, main_id, sub_id)
                ON CONFLICT (team_id, hour_index) 
                DO UPDATE SET main_player_id = EXCLUDED.main_player_id, sub_player_id = EXCLUDED.sub_player_id;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 5. Drop old table (only after verifying migration worked!)
-- DROP TABLE team_planning;

-- Note: Keep the old table until you've verified the new one works
-- Then uncomment the DROP above or run it manually
