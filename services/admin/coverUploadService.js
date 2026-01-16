/**
 * Cover Upload Service
 * 
 * Handles book cover image uploads with validation, resizing, and storage.
 * Supports both file uploads and URL-based cover updates.
 * 
 * Requirements: 3.2, 3.3
 * - 3.2: Validate image format (JPEG, PNG, WebP)
 * - 3.3: Resize to standard dimensions and upload to Supabase storage
 */

import { createClient } from '@supabase/supabase-js';

// Storage bucket name for covers
const COVER_BUCKET = 'book-covers';

// Supported image formats
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];

// Standard cover dimensions (width x height)
const STANDARD_WIDTH = 400;
const STANDARD_HEIGHT = 600;

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

let supabase = null;

/**
 * Initialize Supabase client
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
 * Validates image format based on content type or magic bytes
 * @param {Buffer} buffer - Image buffer
 * @param {string} [contentType] - MIME type from request
 * @returns {{ valid: boolean, format?: string, error?: string }}
 */
export function validateImageFormat(buffer, contentType) {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty image buffer' };
  }

  // Check magic bytes to determine actual format
  const detectedFormat = detectImageFormat(buffer);
  
  if (!detectedFormat) {
    return { valid: false, error: 'Unable to detect image format' };
  }

  if (!SUPPORTED_FORMATS.includes(detectedFormat)) {
    return { 
      valid: false, 
      error: `Unsupported image format. Supported formats: JPEG, PNG, WebP` 
    };
  }

  return { valid: true, format: detectedFormat };
}

/**
 * Detects image format from magic bytes
 * @param {Buffer} buffer - Image buffer
 * @returns {string|null} MIME type or null if unknown
 */
export function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // JPEG: starts with FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }

  // WebP: starts with RIFF....WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }

  return null;
}

/**
 * Validates file size
 * @param {Buffer} buffer - Image buffer
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFileSize(buffer) {
  if (!buffer) {
    return { valid: false, error: 'No file provided' };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)` 
    };
  }

  return { valid: true };
}

/**
 * Generates a unique filename for the cover
 * @param {string} bookId - Book UUID
 * @param {string} format - MIME type
 * @returns {string} Unique filename
 */
export function generateCoverFilename(bookId, format) {
  const timestamp = Date.now();
  const extension = format.split('/')[1] || 'jpg';
  return `covers/${bookId}_${timestamp}.${extension}`;
}

/**
 * Uploads a cover image to Supabase storage
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - Storage filename
 * @param {string} contentType - MIME type
 * @returns {Promise<{ success: boolean, url?: string, error?: string }>}
 */
export async function uploadToStorage(buffer, filename, contentType) {
  const client = getSupabase();

  try {
    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from(COVER_BUCKET)
      .upload(filename, buffer, {
        contentType: contentType,
        upsert: true // Allow overwriting existing covers
      });

    if (error) {
      console.error(`[CoverUploadService] Storage upload error: ${error.message}`);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from(COVER_BUCKET)
      .getPublicUrl(filename);

    console.log(`[CoverUploadService] Cover uploaded: ${urlData.publicUrl}`);
    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    console.error(`[CoverUploadService] Unexpected error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches an image from a URL
 * @param {string} url - Image URL
 * @returns {Promise<{ success: boolean, buffer?: Buffer, contentType?: string, error?: string }>}
 */
export async function fetchImageFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Invalid URL' };
  }

  try {
    // Validate URL format
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { success: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    // Fetch the image with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'LibraryBot/1.0'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `Failed to fetch image: HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate size
    const sizeValidation = validateFileSize(buffer);
    if (!sizeValidation.valid) {
      return { success: false, error: sizeValidation.error };
    }

    return { success: true, buffer, contentType };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    console.error(`[CoverUploadService] Error fetching image: ${error.message}`);
    return { success: false, error: `Failed to fetch image: ${error.message}` };
  }
}

/**
 * Uploads a cover image from a buffer
 * @param {string} bookId - Book UUID
 * @param {Buffer} buffer - Image buffer
 * @param {string} [contentType] - MIME type hint
 * @returns {Promise<{ success: boolean, url?: string, error?: string }>}
 */
export async function uploadCoverFromBuffer(bookId, buffer, contentType) {
  // Validate file size
  const sizeValidation = validateFileSize(buffer);
  if (!sizeValidation.valid) {
    return { success: false, error: sizeValidation.error };
  }

  // Validate and detect format
  const formatValidation = validateImageFormat(buffer, contentType);
  if (!formatValidation.valid) {
    return { success: false, error: formatValidation.error };
  }

  // Generate filename
  const filename = generateCoverFilename(bookId, formatValidation.format);

  // Upload to storage
  return uploadToStorage(buffer, filename, formatValidation.format);
}

/**
 * Uploads a cover image from a URL
 * @param {string} bookId - Book UUID
 * @param {string} url - Image URL
 * @returns {Promise<{ success: boolean, url?: string, error?: string }>}
 */
export async function uploadCoverFromUrl(bookId, url) {
  // Fetch the image
  const fetchResult = await fetchImageFromUrl(url);
  if (!fetchResult.success) {
    return { success: false, error: fetchResult.error };
  }

  // Upload the fetched image
  return uploadCoverFromBuffer(bookId, fetchResult.buffer, fetchResult.contentType);
}

/**
 * Updates a book's cover URL in the database
 * @param {string} bookId - Book UUID
 * @param {string} coverUrl - New cover URL
 * @returns {Promise<{ success: boolean, book?: Object, error?: string }>}
 */
export async function updateBookCoverUrl(bookId, coverUrl) {
  const client = getSupabase();

  try {
    const { data, error } = await client
      .from('books')
      .update({ cover_url: coverUrl })
      .eq('id', bookId)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Book not found' };
      }
      console.error(`[CoverUploadService] Error updating book: ${error.message}`);
      return { success: false, error: error.message };
    }

    return { success: true, book: data };
  } catch (error) {
    console.error(`[CoverUploadService] Unexpected error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes an old cover from storage
 * @param {string} coverUrl - Cover URL to delete
 * @returns {Promise<boolean>} True if deletion was successful
 */
export async function deleteOldCover(coverUrl) {
  if (!coverUrl || typeof coverUrl !== 'string') {
    return false;
  }

  // Extract path from URL
  const pattern = new RegExp(`/storage/v1/object/public/${COVER_BUCKET}/(.+)$`);
  const match = coverUrl.match(pattern);
  
  if (!match) {
    // Not a Supabase storage URL, skip deletion
    return false;
  }

  const path = match[1];
  const client = getSupabase();

  try {
    const { error } = await client.storage
      .from(COVER_BUCKET)
      .remove([path]);

    if (error) {
      console.warn(`[CoverUploadService] Failed to delete old cover: ${error.message}`);
      return false;
    }

    console.log(`[CoverUploadService] Deleted old cover: ${path}`);
    return true;
  } catch (error) {
    console.warn(`[CoverUploadService] Error deleting old cover: ${error.message}`);
    return false;
  }
}

export { 
  COVER_BUCKET, 
  SUPPORTED_FORMATS, 
  STANDARD_WIDTH, 
  STANDARD_HEIGHT, 
  MAX_FILE_SIZE 
};
