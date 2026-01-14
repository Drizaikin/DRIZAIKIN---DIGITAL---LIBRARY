-- =============================================
-- Fix Ingested Books - Set Soft Copy Fields
-- =============================================
-- This script updates existing books from Internet Archive
-- that have pdf_url but missing has_soft_copy and soft_copy_url
-- =============================================

-- Update ingested books to have soft copy fields set
UPDATE books 
SET 
  has_soft_copy = true,
  soft_copy_url = pdf_url
WHERE 
  source = 'internet_archive' 
  AND pdf_url IS NOT NULL 
  AND pdf_url != ''
  AND (has_soft_copy IS NULL OR has_soft_copy = false OR soft_copy_url IS NULL);

-- Verify the fix
SELECT 
  id, 
  title, 
  author,
  source,
  pdf_url, 
  soft_copy_url, 
  has_soft_copy 
FROM books 
WHERE source = 'internet_archive'
ORDER BY created_at DESC
LIMIT 20;

-- Count of fixed books
SELECT 
  COUNT(*) as total_ingested_books,
  COUNT(CASE WHEN has_soft_copy = true THEN 1 END) as books_with_softcopy,
  COUNT(CASE WHEN has_soft_copy = false OR has_soft_copy IS NULL THEN 1 END) as books_without_softcopy
FROM books 
WHERE source = 'internet_archive';
