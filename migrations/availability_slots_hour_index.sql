-- Migration: availability_slots → hour_index
-- Event: Dec 26, 2025 20:00 CET to Dec 29, 2025 17:00 CET (69 hours, indices 0-68)

-- Step 1: Add hour_index column
ALTER TABLE availability_slots ADD COLUMN IF NOT EXISTS hour_index INT;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_availability_slots_hour_index ON availability_slots(hour_index);

-- Step 3: Delete all existing data (old format incompatible)
-- Players/casters will need to re-submit their availability
TRUNCATE availability_slots;

-- Step 4: Drop old columns (after code deployment)
-- Run these AFTER confirming the new code is deployed:
ALTER TABLE availability_slots DROP COLUMN IF EXISTS date;
ALTER TABLE availability_slots DROP COLUMN IF EXISTS start_hour;
ALTER TABLE availability_slots DROP COLUMN IF EXISTS end_hour;

-- Verify the new structure
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'availability_slots';
