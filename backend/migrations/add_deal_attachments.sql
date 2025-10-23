ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attachments_deal_id ON attachments(deal_id);