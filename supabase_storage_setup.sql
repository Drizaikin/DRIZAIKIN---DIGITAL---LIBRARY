-- =============================================
-- Supabase Storage Setup for PDF Books
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create a storage bucket for book PDFs
-- Go to Supabase Dashboard > Storage > Create a new bucket

-- Bucket Settings:
-- Name: book-pdfs
-- Public: Yes (so users can read without authentication)
-- File size limit: 52428800 bytes (50MB)
-- Allowed MIME types: application/pdf

-- 2. Set up storage policies (run in SQL Editor)

-- Allow anyone to read PDFs (public access for reading)
CREATE POLICY "Public Access for Reading PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-pdfs');

-- Allow service role to upload PDFs (for ingestion)
CREATE POLICY "Service Upload PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'book-pdfs' AND (auth.role() = 'service_role' OR auth.role() = 'authenticated'));

-- Allow service role to update PDFs
CREATE POLICY "Service Update PDFs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'book-pdfs' AND (auth.role() = 'service_role' OR auth.role() = 'authenticated'));

-- Allow service role to delete PDFs
CREATE POLICY "Service Delete PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'book-pdfs' AND (auth.role() = 'service_role' OR auth.role() = 'authenticated'));

-- 3. Update bucket size limit (if bucket already exists)
UPDATE storage.buckets
SET file_size_limit = 52428800  -- 50MB in bytes
WHERE id = 'book-pdfs';

-- =============================================
-- MANUAL STEPS IN SUPABASE DASHBOARD:
-- =============================================
-- 
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: book-pdfs
-- 4. Toggle "Public bucket" ON
-- 5. Set "File size limit": 52428800 (50MB)
-- 6. Click "Create bucket"
-- 
-- The policies above will be applied automatically
-- if you run this SQL, or you can set them manually
-- in the Storage > Policies section.
-- =============================================

-- Note: The soft_copy_url field in books table will store
-- the full public URL to the PDF in Supabase Storage.
-- Format: https://[project-ref].supabase.co/storage/v1/object/public/book-pdfs/[filename]
