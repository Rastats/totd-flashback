-- Migration: Add pot_incremented column to processed_donations
-- Date: 2024-12-18
-- Purpose: Track which donations have actually had their pots incremented vs just logged

-- Add pot_incremented column (defaults to false for existing records)
ALTER TABLE processed_donations 
ADD COLUMN IF NOT EXISTS pot_incremented BOOLEAN DEFAULT false;

-- Set existing donations to true (assume they were processed correctly before)
UPDATE processed_donations SET pot_incremented = true WHERE pot_incremented IS NULL;

-- Add index for efficient querying of unprocessed donations
CREATE INDEX IF NOT EXISTS idx_processed_donations_pot_incremented 
ON processed_donations(pot_incremented) WHERE pot_incremented = false;

-- Comment for clarity
COMMENT ON COLUMN processed_donations.pot_incremented IS 'True if the donation amount was added to team pot, false if just logged';
