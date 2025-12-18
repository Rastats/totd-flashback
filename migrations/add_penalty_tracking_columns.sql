-- Migration: Add penalty tracking columns to processed_donations
-- Date: 2024-12-18
-- Purpose: Track penalty lifecycle: applied (by plugin) and completed (timer expired or maps done)

-- Add penalty_applied column (true when plugin has applied the penalty to the team)
ALTER TABLE processed_donations 
ADD COLUMN IF NOT EXISTS penalty_applied BOOLEAN DEFAULT false;

-- Add penalty_completed column (true when penalty is finished: timer expired or maps completed correctly)
ALTER TABLE processed_donations 
ADD COLUMN IF NOT EXISTS penalty_completed BOOLEAN DEFAULT false;

-- Add penalty_completed_at timestamp 
ALTER TABLE processed_donations 
ADD COLUMN IF NOT EXISTS penalty_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Set existing donations as fully completed (legacy data)
UPDATE processed_donations 
SET penalty_applied = true, penalty_completed = true 
WHERE penalty_applied IS NULL OR penalty_completed IS NULL;

-- Index for finding pending penalties per team
CREATE INDEX IF NOT EXISTS idx_processed_donations_pending_penalties 
ON processed_donations(penalty_team, penalty_applied, penalty_completed) 
WHERE penalty_applied = false OR penalty_completed = false;

-- Comments
COMMENT ON COLUMN processed_donations.penalty_applied IS 'True when plugin has received and added this penalty to the team queue';
COMMENT ON COLUMN processed_donations.penalty_completed IS 'True when penalty is finished (timer expired or maps completed correctly)';
COMMENT ON COLUMN processed_donations.penalty_completed_at IS 'Timestamp when the penalty was completed';
