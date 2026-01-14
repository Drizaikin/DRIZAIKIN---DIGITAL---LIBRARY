-- Verify the latest ingested book has AI description and soft copy fields
SELECT 
  id,
  title,
  author,
  source,
  LENGTH(description) as description_length,
  SUBSTRING(description, 1, 200) as description_preview,
  has_soft_copy,
  soft_copy_url IS NOT NULL as has_soft_copy_url,
  pdf_url IS NOT NULL as has_pdf_url,
  genres,
  subgenre,
  created_at
FROM books 
WHERE source = 'internet_archive'
ORDER BY created_at DESC
LIMIT 1;
