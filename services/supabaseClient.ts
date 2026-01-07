// Supabase client for direct browser uploads
// This allows uploading files up to 50MB directly to Supabase Storage

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

// Initialize Supabase client only if credentials are available
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Supabase client initialized for direct uploads (up to 50MB)');
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
} else {
  console.warn('Supabase direct upload not available. Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  console.warn('Add these to your Vercel environment variables for 50MB upload support.');
}

export { supabase };

// Direct upload to Supabase Storage (bypasses serverless function limits)
// Max file size: 50MB (Supabase Storage limit)
export async function uploadPdfToSupabase(file: File): Promise<{ url: string; path: string } | null> {
  if (!supabase) {
    console.error('Supabase client not initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    return null;
  }

  // Create unique filename
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${timestamp}_${sanitizedName}`;

  try {
    console.log('Uploading to Supabase Storage:', fileName, 'Size:', (file.size / 1024 / 1024).toFixed(2) + 'MB');
    
    // Upload directly to Supabase Storage
    const { data, error } = await supabase.storage
      .from('book-pdfs')
      .upload(fileName, file, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('book-pdfs')
      .getPublicUrl(fileName);

    console.log('Upload successful:', urlData.publicUrl);
    
    return {
      url: urlData.publicUrl,
      path: data.path
    };
  } catch (err) {
    console.error('Upload failed:', err);
    throw err;
  }
}

// Check if direct Supabase upload is available
export function isDirectUploadAvailable(): boolean {
  const available = supabase !== null;
  if (!available) {
    console.log('Direct Supabase upload not available - will use API fallback (4MB limit)');
  }
  return available;
}
