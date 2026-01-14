-- =============================================
-- Update Ingested Books - Check Descriptions
-- =============================================
-- This script helps identify books that need AI-generated descriptions
-- =============================================

-- Check books from Internet Archive without descriptions
SELECT 
  id, 
  title, 
  author,
  source,
  CASE 
    WHEN description IS NULL THEN 'NULL'
    WHEN description = '' THEN 'EMPTY'
    WHEN LENGTH(description) < 50 THEN 'TOO SHORT'
    ELSE 'HAS DESCRIPTION'
  END as description_status,
  LENGTH(description) as description_length,
  created_at
FROM books 
WHERE source = 'internet_archive'
ORDER BY created_at DESC
LIMIT 50;

-- Count of books by description status
SELECT 
  CASE 
    WHEN description IS NULL THEN 'NULL'
    WHEN description = '' THEN 'EMPTY'
    WHEN LENGTH(description) < 50 THEN 'TOO SHORT'
    WHEN LENGTH(description) < 150 THEN 'SHORT'
    ELSE 'ADEQUATE'
  END as description_status,
  COUNT(*) as count
FROM books 
WHERE source = 'internet_archive'
GROUP BY description_status
ORDER BY count DESC;

-- Note: AI description generation is now integrated into the ingestion pipeline
-- New books will automatically get AI-generated descriptions
-- To regenerate descriptions for existing books, you would need to:
-- 1. Create a separate script that calls the AI API
-- 2. Update the books table with the new descriptions
-- This is not included here to avoid accidental API costs
