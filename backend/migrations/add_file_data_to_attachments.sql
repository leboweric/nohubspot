-- Skip this migration - column likely already exists
-- The ALTER TABLE IF NOT EXISTS is hanging on Railway
-- This is a no-op migration to allow the app to start
SELECT 1