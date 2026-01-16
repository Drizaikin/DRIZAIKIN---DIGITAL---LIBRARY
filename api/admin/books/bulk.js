/**
 * Admin Books Bulk Operations API Endpoint
 * 
 * POST /api/admin/books/bulk - Perform bulk operations on multiple books
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 * - 7.1: Support selecting multiple books via checkboxes
 * - 7.2: Enable bulk action buttons when books are selected
 * - 7.3: Support bulk category update for selected books
 * - 7.4: Support bulk genre update for selected books
 * - 7.5: Support bulk deletion with confirmation for selected books
 * - 7.6: Display progress and results summary
 */

import { createClient } from '@supabase/supabase-js';
import { validateGenres } from '../../../services/ingestion/genreTaxonomy.js';

let supabase = null;

/**
 * Initialize Supabase client
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase service key
 */
function initSupabase(url, key) {
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
function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (url && key) {
      return initSupabase(url, key);
    }
    throw new Error('Supabase client not initialized');
  }
  return supabase;
}

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  if (!adminSecret) {
    console.error('[Bulk API] ADMIN_HEALTH_SECRET not configured');
    return { valid: false, error: 'Service not configured' };
  }
  
  if (!authHeader) {
    return { valid: false, error: 'Authorization required' };
  }
  
  const expectedAuth = `Bearer ${adminSecret}`;
  if (authHeader !== expectedAuth) {
    return { valid: false, error: 'Invalid authorization' };
  }
  
  return { valid: true };
}

/**
 * Valid operations for bulk actions
 */
const VALID_OPERATIONS = ['update_category', 'update_genre', 'delete'];

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates the bulk operation request body
 * @param {Object} body - Request body
 * @returns {{ valid: boolean, error?: string, operation?: string, bookIds?: string[], data?: Object }}
 */
function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }
  
  // Validate operation
  if (!body.operation || !VALID_OPERATIONS.includes(body.operation)) {
    return { 
      valid: false, 
      error: `Invalid operation. Must be one of: ${VALID_OPERATIONS.join(', ')}` 
    };
  }
  
  // Validate bookIds
  if (!body.bookIds || !Array.isArray(body.bookIds)) {
    return { valid: false, error: 'bookIds must be an array' };
  }
  
  if (body.bookIds.length === 0) {
    return { valid: false, error: 'bookIds array cannot be empty' };
  }
  
  // Validate each book ID is a valid UUID
  const invalidIds = body.bookIds.filter(id => !UUID_REGEX.test(id));
  if (invalidIds.length > 0) {
    return { 
      valid: false, 
      error: `Invalid book ID format: ${invalidIds.slice(0, 3).join(', ')}${invalidIds.length > 3 ? '...' : ''}` 
    };
  }
  
  // Validate data for update operations
  if (body.operation === 'update_category') {
    if (!body.data || typeof body.data.category !== 'string' || body.data.category.trim() === '') {
      return { valid: false, error: 'Category is required for update_category operation' };
    }
  }
  
  if (body.operation === 'update_genre') {
    if (!body.data || !Array.isArray(body.data.genres)) {
      return { valid: false, error: 'Genres array is required for update_genre operation' };
    }
    
    const validatedGenres = validateGenres(body.data.genres);
    if (validatedGenres.length === 0 && body.data.genres.length > 0) {
      return { valid: false, error: 'All provided genres are invalid. Genres must be from the valid taxonomy.' };
    }
  }
  
  return { 
    valid: true, 
    operation: body.operation, 
    bookIds: body.bookIds,
    data: body.data || {}
  };
}


/**
 * Performs bulk category update
 * @param {string[]} bookIds - Array of book UUIDs
 * @param {string} category - New category value
 * @param {Object} adminInfo - Admin user info
 * @returns {Promise<{processed: number, failed: number, results: Array}>}
 */
async function bulkUpdateCategory(bookIds, category, adminInfo) {
  const client = getSupabase();
  const results = [];
  let processed = 0;
  let failed = 0;
  
  for (const bookId of bookIds) {
    try {
      // Get current book state for audit log
      const { data: currentBook, error: fetchError } = await client
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();
      
      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          results.push({ bookId, status: 'error', message: 'Book not found' });
          failed++;
          continue;
        }
        results.push({ bookId, status: 'error', message: fetchError.message });
        failed++;
        continue;
      }
      
      // Update the book
      const { error: updateError } = await client
        .from('books')
        .update({ category: category.trim() })
        .eq('id', bookId);
      
      if (updateError) {
        results.push({ bookId, status: 'error', message: updateError.message });
        failed++;
        continue;
      }
      
      // Create audit log entry
      if (currentBook.category !== category.trim()) {
        await client.from('book_audit_log').insert({
          book_id: bookId,
          book_identifier: currentBook.source_identifier || currentBook.title,
          action: 'update',
          changes: {
            category: {
              from: currentBook.category,
              to: category.trim()
            }
          },
          admin_user_id: adminInfo.userId || null,
          admin_username: adminInfo.username || null
        });
      }
      
      results.push({ bookId, status: 'success', message: 'Category updated' });
      processed++;
      
    } catch (error) {
      results.push({ bookId, status: 'error', message: error.message });
      failed++;
    }
  }
  
  return { processed, failed, results };
}

/**
 * Performs bulk genre update
 * @param {string[]} bookIds - Array of book UUIDs
 * @param {string[]} genres - New genres array
 * @param {Object} adminInfo - Admin user info
 * @returns {Promise<{processed: number, failed: number, results: Array}>}
 */
async function bulkUpdateGenre(bookIds, genres, adminInfo) {
  const client = getSupabase();
  const results = [];
  let processed = 0;
  let failed = 0;
  
  // Validate and normalize genres
  const validatedGenres = validateGenres(genres);
  
  for (const bookId of bookIds) {
    try {
      // Get current book state for audit log
      const { data: currentBook, error: fetchError } = await client
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();
      
      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          results.push({ bookId, status: 'error', message: 'Book not found' });
          failed++;
          continue;
        }
        results.push({ bookId, status: 'error', message: fetchError.message });
        failed++;
        continue;
      }
      
      // Prepare update data - also sync category with first genre
      const updateData = { genres: validatedGenres };
      if (validatedGenres.length > 0) {
        updateData.category = validatedGenres[0];
      }
      
      // Update the book
      const { error: updateError } = await client
        .from('books')
        .update(updateData)
        .eq('id', bookId);
      
      if (updateError) {
        results.push({ bookId, status: 'error', message: updateError.message });
        failed++;
        continue;
      }
      
      // Create audit log entry
      const changes = {};
      if (JSON.stringify(currentBook.genres) !== JSON.stringify(validatedGenres)) {
        changes.genres = {
          from: currentBook.genres,
          to: validatedGenres
        };
      }
      if (validatedGenres.length > 0 && currentBook.category !== validatedGenres[0]) {
        changes.category = {
          from: currentBook.category,
          to: validatedGenres[0]
        };
      }
      
      if (Object.keys(changes).length > 0) {
        await client.from('book_audit_log').insert({
          book_id: bookId,
          book_identifier: currentBook.source_identifier || currentBook.title,
          action: 'update',
          changes,
          admin_user_id: adminInfo.userId || null,
          admin_username: adminInfo.username || null
        });
      }
      
      results.push({ bookId, status: 'success', message: 'Genre updated' });
      processed++;
      
    } catch (error) {
      results.push({ bookId, status: 'error', message: error.message });
      failed++;
    }
  }
  
  return { processed, failed, results };
}


// Storage bucket names
const PDF_BUCKET = 'book-pdfs';
const COVER_BUCKET = 'book-covers';

/**
 * Extracts storage path from a Supabase storage URL
 * @param {string} url - Full storage URL
 * @param {string} bucket - Bucket name
 * @returns {string|null} Storage path or null if not a valid storage URL
 */
function extractStoragePath(url, bucket) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)`);
  const match = url.match(pattern);
  
  return match ? match[1] : null;
}

/**
 * Performs bulk deletion
 * @param {string[]} bookIds - Array of book UUIDs
 * @param {boolean} confirmed - Whether deletion is confirmed
 * @param {Object} adminInfo - Admin user info
 * @returns {Promise<{processed: number, failed: number, results: Array, requiresConfirmation?: boolean, books?: Array}>}
 */
async function bulkDelete(bookIds, confirmed, adminInfo) {
  const client = getSupabase();
  
  // If not confirmed, return books info for confirmation dialog
  if (!confirmed) {
    const booksToDelete = [];
    
    for (const bookId of bookIds) {
      try {
        const { data: book, error } = await client
          .from('books')
          .select('id, title, author')
          .eq('id', bookId)
          .single();
        
        if (!error && book) {
          booksToDelete.push(book);
        }
      } catch (e) {
        // Skip books that can't be fetched
      }
    }
    
    return {
      requiresConfirmation: true,
      books: booksToDelete,
      warning: `This action will permanently delete ${booksToDelete.length} book(s) and all associated files (PDFs, cover images). This cannot be undone.`,
      processed: 0,
      failed: 0,
      results: []
    };
  }
  
  const results = [];
  let processed = 0;
  let failed = 0;
  
  for (const bookId of bookIds) {
    try {
      // Get book data first (for asset URLs and audit log)
      const { data: book, error: fetchError } = await client
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();
      
      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          results.push({ bookId, status: 'error', message: 'Book not found' });
          failed++;
          continue;
        }
        results.push({ bookId, status: 'error', message: fetchError.message });
        failed++;
        continue;
      }
      
      const deletedAssets = { pdf: false, cover: false };
      
      // Delete PDF from storage if it exists
      if (book.pdf_url || book.soft_copy_url) {
        const pdfUrl = book.pdf_url || book.soft_copy_url;
        const pdfPath = extractStoragePath(pdfUrl, PDF_BUCKET);
        
        if (pdfPath) {
          const { error: pdfDeleteError } = await client.storage
            .from(PDF_BUCKET)
            .remove([pdfPath]);
          
          if (!pdfDeleteError) {
            deletedAssets.pdf = true;
          }
        }
      }
      
      // Delete cover from storage if it exists and is in our storage
      if (book.cover_url) {
        const coverPath = extractStoragePath(book.cover_url, COVER_BUCKET);
        
        if (coverPath) {
          const { error: coverDeleteError } = await client.storage
            .from(COVER_BUCKET)
            .remove([coverPath]);
          
          if (!coverDeleteError) {
            deletedAssets.cover = true;
          }
        }
      }
      
      // Create audit log entry before deletion
      await client.from('book_audit_log').insert({
        book_id: bookId,
        book_identifier: book.source_identifier || book.title,
        action: 'delete',
        changes: { deleted_book: book },
        admin_user_id: adminInfo.userId || null,
        admin_username: adminInfo.username || null
      });
      
      // Delete the book record
      const { error: deleteError } = await client
        .from('books')
        .delete()
        .eq('id', bookId);
      
      if (deleteError) {
        results.push({ bookId, status: 'error', message: deleteError.message });
        failed++;
        continue;
      }
      
      results.push({ 
        bookId, 
        status: 'success', 
        message: 'Book deleted',
        deletedAssets
      });
      processed++;
      
    } catch (error) {
      results.push({ bookId, status: 'error', message: error.message });
      failed++;
    }
  }
  
  return { processed, failed, results };
}


/**
 * Vercel Serverless Function Handler
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'This endpoint only accepts POST requests',
      timestamp: new Date().toISOString()
    });
  }
  
  // Validate authorization
  const authHeader = req.headers['authorization'];
  const authResult = validateAuthorization(authHeader);
  
  if (!authResult.valid) {
    console.warn(`[Bulk API] Unauthorized request: ${authResult.error}`);
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: authResult.error,
      timestamp: new Date().toISOString()
    });
  }
  
  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Bulk API] Missing Supabase configuration');
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database configuration missing',
      timestamp: new Date().toISOString()
    });
  }
  
  initSupabase(supabaseUrl, supabaseKey);
  
  // Validate request body
  const validation = validateRequest(req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: validation.error,
      timestamp: new Date().toISOString()
    });
  }
  
  // Extract admin info from headers
  const adminInfo = {
    userId: req.headers['x-admin-user-id'] || null,
    username: req.headers['x-admin-username'] || null
  };
  
  // Check for confirmation header (for delete operations)
  const confirmed = req.headers['x-confirm-delete'] === 'true' || 
                    req.query?.confirm === 'true';
  
  console.log(`[Bulk API] Processing ${validation.operation} for ${validation.bookIds.length} books`);
  
  try {
    let result;
    
    switch (validation.operation) {
      case 'update_category':
        result = await bulkUpdateCategory(
          validation.bookIds, 
          validation.data.category, 
          adminInfo
        );
        break;
        
      case 'update_genre':
        result = await bulkUpdateGenre(
          validation.bookIds, 
          validation.data.genres, 
          adminInfo
        );
        break;
        
      case 'delete':
        result = await bulkDelete(
          validation.bookIds, 
          confirmed, 
          adminInfo
        );
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'INVALID_OPERATION',
          message: `Unknown operation: ${validation.operation}`,
          timestamp: new Date().toISOString()
        });
    }
    
    const responseTime = Date.now() - startTime;
    
    // Handle confirmation required response for delete
    if (result.requiresConfirmation) {
      return res.status(200).json({
        success: false,
        requiresConfirmation: true,
        warning: result.warning,
        books: result.books,
        message: 'Set x-confirm-delete header to "true" or add ?confirm=true to proceed with deletion',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[Bulk API] ${validation.operation} completed: ${result.processed} processed, ${result.failed} failed in ${responseTime}ms`);
    
    return res.status(200).json({
      success: true,
      operation: validation.operation,
      processed: result.processed,
      failed: result.failed,
      results: result.results,
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Bulk API] Unexpected error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to process bulk operation',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing
export { 
  validateAuthorization, 
  validateRequest, 
  bulkUpdateCategory, 
  bulkUpdateGenre, 
  bulkDelete,
  VALID_OPERATIONS,
  initSupabase,
  getSupabase
};
