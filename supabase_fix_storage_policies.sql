-- =============================================
-- Fix Supabase Storage Policies for PDF Uploads
-- Run this in Supabase SQL Editor
-- =============================================

-- The issue: Current policies require authentication, but the app uses
-- anonymous (anon) key which doesn't authenticate users.

-- Solution: Allow anonymous uploads to the book-pdfs bucket

-- First, drop existing policies
DROP POLICY IF EXISTS "Public Access for Reading PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete PDFs" ON storage.objects;

-- Create new policies that allow anonymous access

-- Allow anyone to read PDFs (public access)
CREATE POLICY "Public Read PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-pdfs');

-- Allow anyone to upload PDFs (needed for anon key)
CREATE POLICY "Public Upload PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'book-pdfs');

-- Allow anyone to update PDFs
CREATE POLICY "Public Update PDFs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'book-pdfs');

-- Allow anyone to delete PDFs
CREATE POLICY "Public Delete PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'book-pdfs');

-- =============================================
-- ALSO: Make sure the bucket exists and is public
-- =============================================
-- Go to Supabase Dashboard > Storage
-- 1. If "book-pdfs" bucket doesn't exist, create it:
--    - Click "New bucket"
--    - Name: book-pdfs
--    - Toggle "Public bucket" ON
--    - Click "Create bucket"
-- 
-- 2. If it exists but is private:
--    - Click on the bucket
--    - Go to Settings
--    - Toggle "Public bucket" ON
-- =============================================

-- Verify the bucket exists (this will show an error if it doesn't)
-- SELECT * FROM storage.buckets WHERE id = 'book-pdfs';
