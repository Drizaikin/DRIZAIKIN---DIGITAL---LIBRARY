// Supabase client for direct browser uploads
// This allows uploading files up to 50MB directly to Supabase Storage

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

// Initialize Supabase client only if credentials are available
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
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
  return supabase !== null;
}
