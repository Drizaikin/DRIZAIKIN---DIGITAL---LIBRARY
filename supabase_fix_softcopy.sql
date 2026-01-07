-- =============================================
-- Fix books that have soft_copy_url but has_soft_copy is false
-- =============================================

-- Update has_soft_copy to true for all books that have a soft_copy_url
UPDATE books 
SET has_soft_copy = true 
WHERE soft_copy_url IS NOT NULL 
  AND soft_copy_url != '' 
  AND (has_soft_copy IS NULL OR has_soft_copy = false);

-- Verify the fix
SELECT id, title, soft_copy_url, has_soft_copy 
FROM books 
WHERE soft_copy_url IS NOT NULL AND soft_copy_url != '';
