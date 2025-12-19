-- ============================================
-- BACKUP TABLES FOR CRITICAL DATA
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create backup tables (copies of main tables)

CREATE TABLE IF NOT EXISTS processed_donations_backup (
    LIKE processed_donations INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS team_pots_backup (
    LIKE team_pots INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS team_progress_backup (
    LIKE team_progress INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS team_status_backup (
    LIKE team_status INCLUDING ALL
);

-- Add backup timestamp column to each backup table
ALTER TABLE processed_donations_backup ADD COLUMN IF NOT EXISTS backup_timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE team_pots_backup ADD COLUMN IF NOT EXISTS backup_timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE team_progress_backup ADD COLUMN IF NOT EXISTS backup_timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE team_status_backup ADD COLUMN IF NOT EXISTS backup_timestamp TIMESTAMPTZ DEFAULT NOW();

-- 2. Create function to refresh backups
CREATE OR REPLACE FUNCTION refresh_critical_backups()
RETURNS void AS $$
BEGIN
    -- Clear and copy processed_donations
    TRUNCATE processed_donations_backup;
    INSERT INTO processed_donations_backup 
    SELECT *, NOW() as backup_timestamp FROM processed_donations;
    
    -- Clear and copy team_pots
    TRUNCATE team_pots_backup;
    INSERT INTO team_pots_backup 
    SELECT *, NOW() as backup_timestamp FROM team_pots;
    
    -- Clear and copy team_progress
    TRUNCATE team_progress_backup;
    INSERT INTO team_progress_backup 
    SELECT *, NOW() as backup_timestamp FROM team_progress;
    
    -- Clear and copy team_status
    TRUNCATE team_status_backup;
    INSERT INTO team_status_backup 
    SELECT *, NOW() as backup_timestamp FROM team_status;
    
    RAISE NOTICE 'Backup completed at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enable pg_cron extension (if not already enabled)
-- Note: You may need to enable this in Supabase Dashboard > Database > Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 4. Schedule backup job to run every 5 minutes
-- First, remove any existing job with the same name
SELECT cron.unschedule('backup-critical-tables');

-- Schedule the backup to run every 5 minutes
SELECT cron.schedule(
    'backup-critical-tables',      -- Job name
    '*/5 * * * *',                 -- Cron expression: every 5 minutes
    'SELECT refresh_critical_backups()'
);

-- 5. Run initial backup
SELECT refresh_critical_backups();

-- ============================================
-- VERIFICATION & RESTORE
-- ============================================
-- Check scheduled jobs:
-- SELECT * FROM cron.job;
-- 
-- Check job history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- Manual backup:
-- SELECT refresh_critical_backups();
--
-- ============================================
-- RESTORE FUNCTIONS (run manually when needed)
-- ============================================

-- Restore ALL tables from backup
CREATE OR REPLACE FUNCTION restore_all_from_backup()
RETURNS void AS $$
BEGIN
    -- Restore processed_donations
    TRUNCATE processed_donations;
    INSERT INTO processed_donations 
    SELECT donation_id, tiltify_id, donor_name, amount, currency, message, 
           created_at, processed_at, penalty_type, penalty_target_team, 
           pot_target_team, penalty_applied, penalty_completed, penalty_completed_at,
           pot_incremented
    FROM processed_donations_backup;
    
    -- Restore team_pots
    TRUNCATE team_pots;
    INSERT INTO team_pots 
    SELECT id, team_id, pot_amount, updated_at
    FROM team_pots_backup;
    
    -- Restore team_progress
    TRUNCATE team_progress;
    INSERT INTO team_progress 
    SELECT id, team_id, completed_ids, updated_at
    FROM team_progress_backup;
    
    -- Restore team_status
    TRUNCATE team_status;
    INSERT INTO team_status 
    SELECT team_id, player_name, account_id, active_player, waiting_player, 
           joker_used, current_map_id, current_map_name, current_map_author,
           current_map_status, maps_completed, maps_total, redo_remaining,
           penalties_active, penalties_waitlist, shield_active, shield_type,
           shield_remaining_ms, shield_cooldown_ms, mode, updated_at
    FROM team_status_backup;
    
    RAISE NOTICE 'ALL tables restored from backup at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore individual tables
CREATE OR REPLACE FUNCTION restore_processed_donations()
RETURNS void AS $$
BEGIN
    TRUNCATE processed_donations;
    INSERT INTO processed_donations 
    SELECT donation_id, tiltify_id, donor_name, amount, currency, message, 
           created_at, processed_at, penalty_type, penalty_target_team, 
           pot_target_team, penalty_applied, penalty_completed, penalty_completed_at,
           pot_incremented
    FROM processed_donations_backup;
    RAISE NOTICE 'processed_donations restored at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION restore_team_pots()
RETURNS void AS $$
BEGIN
    TRUNCATE team_pots;
    INSERT INTO team_pots 
    SELECT id, team_id, pot_amount, updated_at
    FROM team_pots_backup;
    RAISE NOTICE 'team_pots restored at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION restore_team_progress()
RETURNS void AS $$
BEGIN
    TRUNCATE team_progress;
    INSERT INTO team_progress 
    SELECT id, team_id, completed_ids, updated_at
    FROM team_progress_backup;
    RAISE NOTICE 'team_progress restored at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION restore_team_status()
RETURNS void AS $$
BEGIN
    TRUNCATE team_status;
    INSERT INTO team_status 
    SELECT team_id, player_name, account_id, active_player, waiting_player, 
           joker_used, current_map_id, current_map_name, current_map_author,
           current_map_status, maps_completed, maps_total, redo_remaining,
           penalties_active, penalties_waitlist, shield_active, shield_type,
           shield_remaining_ms, shield_cooldown_ms, mode, updated_at
    FROM team_status_backup;
    RAISE NOTICE 'team_status restored at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- USAGE:
-- SELECT restore_all_from_backup();        -- Restore ALL tables
-- SELECT restore_processed_donations();    -- Restore only donations
-- SELECT restore_team_pots();              -- Restore only pots
-- SELECT restore_team_progress();          -- Restore only progress
-- SELECT restore_team_status();            -- Restore only status
-- ============================================
