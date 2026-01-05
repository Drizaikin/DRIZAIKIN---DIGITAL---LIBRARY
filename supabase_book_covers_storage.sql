-- =============================================
-- Supabase Storage Setup for Book Covers
-- Run this in Supabase SQL Editor
-- Requirements: 3.6, 3.7
-- =============================================

-- 1. Create a storage bucket for book covers
-- Go to Supabase Dashboard > Storage > Create a new bucket

-- Bucket Settings:
-- Name: book-covers
-- Public: Yes (so users can view covers without authentication)
-- File size limit: 5MB (covers are typically small)
-- Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

-- 2. Set up storage policies (run in SQL Editor)

-- Allow anyone to read covers (public access for viewing)
CREATE POLICY "Public Access for Reading Covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-covers');

-- Allow authenticated users (admins) to upload covers
CREATE POLICY "Admin Upload Covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'book-covers');

-- Allow authenticated users (admins) to update covers
CREATE POLICY "Admin Update Covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'book-covers');

-- Allow authenticated users (admins) to delete covers
CREATE POLICY "Admin Delete Covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'book-covers');

-- =============================================
-- MANUAL STEPS IN SUPABASE DASHBOARD:
-- =============================================
-- 
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: book-covers
-- 4. Toggle "Public bucket" ON
-- 5. Click "Create bucket"
-- 
-- The policies above will be applied automatically
-- if you run this SQL, or you can set them manually
-- in the Storage > Policies section.
-- =============================================

-- Note: The cover_url field in books/extracted_books tables will store
-- the full public URL to the cover in Supabase Storage.
-- Format: https://[project-ref].supabase.co/storage/v1/object/public/book-covers/[filename]
