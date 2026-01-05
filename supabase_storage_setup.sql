-- =============================================
-- Supabase Storage Setup for PDF Books
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create a storage bucket for book PDFs
-- Go to Supabase Dashboard > Storage > Create a new bucket

-- Bucket Settings:
-- Name: book-pdfs
-- Public: Yes (so users can read without authentication)
-- File size limit: 50MB (adjust as needed)
-- Allowed MIME types: application/pdf

-- 2. Set up storage policies (run in SQL Editor)

-- Allow anyone to read PDFs (public access for reading)
CREATE POLICY "Public Access for Reading PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-pdfs');

-- Allow authenticated users (admins) to upload PDFs
CREATE POLICY "Admin Upload PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'book-pdfs');

-- Allow authenticated users (admins) to update PDFs
CREATE POLICY "Admin Update PDFs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'book-pdfs');

-- Allow authenticated users (admins) to delete PDFs
CREATE POLICY "Admin Delete PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'book-pdfs');

-- =============================================
-- MANUAL STEPS IN SUPABASE DASHBOARD:
-- =============================================
-- 
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: book-pdfs
-- 4. Toggle "Public bucket" ON
-- 5. Click "Create bucket"
-- 
-- The policies above will be applied automatically
-- if you run this SQL, or you can set them manually
-- in the Storage > Policies section.
-- =============================================

-- Note: The soft_copy_url field in books table will store
-- the full public URL to the PDF in Supabase Storage.
-- Format: https://[project-ref].supabase.co/storage/v1/object/public/book-pdfs/[filename]
