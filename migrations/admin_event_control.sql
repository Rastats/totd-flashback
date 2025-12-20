-- Admin Event Control Migration
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. CREATE pending_penalties TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS pending_penalties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    penalty_team INTEGER NOT NULL CHECK (penalty_team >= 1 AND penalty_team <= 4),
    penalty_name TEXT NOT NULL,
    donation_id TEXT,
    donor_name TEXT DEFAULT 'Anonymous',
    amount DECIMAL DEFAULT 0,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster team lookups
CREATE INDEX IF NOT EXISTS idx_pending_penalties_team ON pending_penalties(penalty_team);

-- RLS policies
ALTER TABLE pending_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read pending_penalties" ON pending_penalties
    FOR SELECT USING (true);

CREATE POLICY "Allow service key write pending_penalties" ON pending_penalties
    FOR ALL USING (true);

-- =============================================
-- 2. ADD MISSING COLUMNS TO team_status
-- =============================================
-- Shield columns
ALTER TABLE team_status ADD COLUMN IF NOT EXISTS shield_active BOOLEAN DEFAULT false;
ALTER TABLE team_status ADD COLUMN IF NOT EXISTS shield_type TEXT;
ALTER TABLE team_status ADD COLUMN IF NOT EXISTS shield_expires_at TIMESTAMP WITH TIME ZONE;

-- Ensure maps_completed column exists
ALTER TABLE team_status ADD COLUMN IF NOT EXISTS maps_completed INTEGER DEFAULT 0;

-- =============================================
-- 3. CREATE event_log TABLE IF NOT EXISTS
-- =============================================
CREATE TABLE IF NOT EXISTS event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    team_id INTEGER,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);

-- RLS policies
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read event_log" ON event_log
    FOR SELECT USING (true);

CREATE POLICY "Allow service key write event_log" ON event_log
    FOR ALL USING (true);

-- =============================================
-- 4. VERIFY EVERYTHING
-- =============================================
SELECT 'pending_penalties created' WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pending_penalties');
SELECT 'event_log created' WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'event_log');
SELECT column_name FROM information_schema.columns WHERE table_name = 'team_status' AND column_name IN ('shield_active', 'shield_type', 'shield_expires_at', 'maps_completed');
