-- Add file_data column to store files directly in PostgreSQL
-- Using simple ALTER TABLE with IF NOT EXISTS clause (PostgreSQL 9.6+)
ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS file_data BYTEA