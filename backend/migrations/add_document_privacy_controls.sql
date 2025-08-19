-- Add privacy controls to attachments table
ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS privacy_level VARCHAR(20) DEFAULT 'public',
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS uploaded_by_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS restricted_users JSON;

-- Add index for privacy queries
CREATE INDEX IF NOT EXISTS idx_attachments_privacy_level 
ON attachments(privacy_level);

CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by_id 
ON attachments(uploaded_by_id);

-- Add check constraint for valid privacy levels
ALTER TABLE attachments 
DROP CONSTRAINT IF EXISTS valid_privacy_level;

ALTER TABLE attachments 
ADD CONSTRAINT valid_privacy_level 
CHECK (privacy_level IN ('private', 'team', 'public', 'restricted'));

-- Update existing records to have public privacy by default
UPDATE attachments 
SET privacy_level = 'public' 
WHERE privacy_level IS NULL;