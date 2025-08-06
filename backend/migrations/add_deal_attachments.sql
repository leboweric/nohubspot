-- Add deal_id column to attachments table for deal file attachments
ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attachments_deal_id ON attachments(deal_id);