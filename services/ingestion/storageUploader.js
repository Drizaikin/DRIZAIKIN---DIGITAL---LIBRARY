/**
 * Storage Uploader Service
 * 
 * Uploads PDFs to Supabase Storage "books" bucket.
 * Uses structured path: internet_archive/{identifier}.pdf
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { createClient } from '@supabase/supabase-js';

// Storage bucket name
const BUCKET_NAME = 'books';

// Path prefix for Internet Archive books
const IA_PATH_PREFIX = 'internet_archive';

// Initialize Supabase client for server-side operations
let supabase = null;

/**
 * Initialize the Supabase client
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase service key
 */
export function initSupabase(url, key) {
  if (!url || !key) {
    throw new Error('Supabase URL and key are required');
  }
  supabase = createClient(url, key);
  return supabase;
}

/**
 * Get the Supabase client instance
 * @returns {Object} Supabase client
 */
export function getSupabase() {
  if (!supabase) {
    // Try to initialize from environment variables
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (url && key) {
      return initSupabase(url, key);
    }
    throw new Error('Supabase client not initialized. Call initSupabase() first.');
  }
  return supabase;
}


/**
 * Constructs the storage path for an Internet Archive book
 * @param {string} filename - Sanitized filename (without extension)
 * @returns {string} Full storage path
 */
export function getStoragePath(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename: must be a non-empty string');
  }
  return `${IA_PATH_PREFIX}/${filename}.pdf`;
}

/**
 * Checks if a file already exists in storage
 * @param {string} path - Storage path
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }

  const client = getSupabase();
  
  try {
    // List files at the path to check existence
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .list(IA_PATH_PREFIX, {
        search: path.replace(`${IA_PATH_PREFIX}/`, '')
      });
    
    if (error) {
      console.error('[StorageUploader] Error checking file existence:', error.message);
      // On error, assume file doesn't exist to allow upload attempt
      return false;
    }
    
    // Check if the exact file exists in the results
    const filename = path.replace(`${IA_PATH_PREFIX}/`, '');
    return data && data.some(file => file.name === filename);
  } catch (error) {
    console.error('[StorageUploader] Error checking file existence:', error.message);
    return false;
  }
}

/**
 * Uploads a PDF to Supabase Storage
 * @param {Buffer} pdfBuffer - PDF file content
 * @param {string} filename - Sanitized filename (without extension)
 * @returns {Promise<string>} Public URL of uploaded file
 * @throws {Error} If upload fails or file already exists
 */
export async function uploadPdf(pdfBuffer, filename) {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('Invalid PDF buffer: must be non-empty');
  }
  
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename: must be a non-empty string');
  }

  const client = getSupabase();
  const storagePath = getStoragePath(filename);
  
  console.log(`[StorageUploader] Uploading PDF to: ${storagePath}`);
  
  // Check if file already exists (Requirement 5.3: never overwrite)
  const exists = await fileExists(storagePath);
  if (exists) {
    console.log(`[StorageUploader] File already exists: ${storagePath}`);
    // Return existing URL instead of throwing error
    const { data: urlData } = client.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    return urlData.publicUrl;
  }
  
  try {
    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false // Never overwrite existing files
      });
    
    if (error) {
      // Handle duplicate file error gracefully
      if (error.message && error.message.includes('already exists')) {
        console.log(`[StorageUploader] File already exists (concurrent upload): ${storagePath}`);
        const { data: urlData } = client.storage
          .from(BUCKET_NAME)
          .getPublicUrl(storagePath);
        return urlData.publicUrl;
      }
      throw new Error(`Storage upload failed: ${error.message}`);
    }
    
    // Get public URL (Requirement 5.4)
    const { data: urlData } = client.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    
    console.log(`[StorageUploader] Upload successful: ${urlData.publicUrl}`);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error(`[StorageUploader] Upload error: ${error.message}`);
    throw error;
  }
}

/**
 * Deletes a file from storage (for cleanup/testing purposes)
 * @param {string} path - Storage path
 * @returns {Promise<boolean>} True if deletion was successful
 */
export async function deleteFile(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }

  const client = getSupabase();
  
  try {
    const { error } = await client.storage
      .from(BUCKET_NAME)
      .remove([path]);
    
    if (error) {
      console.error('[StorageUploader] Error deleting file:', error.message);
      return false;
    }
    
    console.log(`[StorageUploader] Deleted file: ${path}`);
    return true;
  } catch (error) {
    console.error('[StorageUploader] Error deleting file:', error.message);
    return false;
  }
}

export { BUCKET_NAME, IA_PATH_PREFIX };
