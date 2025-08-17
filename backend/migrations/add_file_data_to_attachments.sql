-- Add file_data column to store files directly in PostgreSQL
-- Using simple ALTER TABLE with IF NOT EXISTS clause (PostgreSQL 9.6+)
ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS file_data BYTEA;

-- Note: BYTEA is PostgreSQL's binary data type for storing files
-- This allows storing files up to 1GB in size directly in the database
-- Files are stored as binary data and retrieved on demand