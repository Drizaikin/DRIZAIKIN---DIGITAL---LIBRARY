-- =============================================
-- Fix Storage Bucket Size Limit
-- Run this in Supabase SQL Editor
-- =============================================

-- Update the book-pdfs bucket to allow 50MB files
UPDATE storage.buckets
SET file_size_limit = 52428800  -- 50MB in bytes
WHERE id = 'book-pdfs';

-- Verify the update
SELECT id, name, file_size_limit, file_size_limit / 1024 / 1024 as size_mb
FROM storage.buckets
WHERE id = 'book-pdfs';

-- Expected output: size_mb should be 50
