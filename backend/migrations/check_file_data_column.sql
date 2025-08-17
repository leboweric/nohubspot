-- Check if file_data column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attachments' 
AND column_name = 'file_data'