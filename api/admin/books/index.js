/**
 * Admin Books API Endpoint
 * 
 * GET /api/admin/books - List books with pagination, filtering, and sorting
 * POST /api/admin/books/bulk - Perform bulk operations on multiple books
 * POST /api/admin/books/bulk-update-categories - Sync all book categories with genres
 * 
 * Requirements: 1.1, 1.4, 1.5, 1.6, 7.1-7.6, 8.3
 * - 1.1: Display paginated list of all books
 * - 1.4: Support sorting by title, author, date, category
 * - 1.5: Support filtering by category, genre, source, date range
 * - 1.6: Support search by title, author, ISBN
 * - 7.1-7.6: Bulk operations (category update, genre update, delete)
 * - 8.3: Require admin authentication
 */

import { listBooks, initSupabase } from '../../../services/admin/bookManagementService.js';
import { createClient } from '@supabase/supabase-js';
import { validateGenres } from '../../../services/ingestion/genreTaxonomy.js';
import { updateAllCategories } from '../../../services/ingestion/bulkCategoryUpdate.js';

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  if (!adminSecret) {
    console.error('[Books API] ADMIN_HEALTH_SECRET not configured');
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
 * Parses query parameters from request
 * @param {Object} query - Request query object
 * @returns {Object} Parsed options for listBooks
 */
function parseQueryParams(query) {
  return {
    page: query.page ? parseInt(query.page, 10) : 1,
    pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    search: query.search || undefined,
    category: query.category || undefined,
    genre: query.genre || undefined,
    source: query.source || undefined,
    dateFrom: query.dateFrom || undefined,
    dateTo: query.dateTo || undefined,
    sortBy: query.sortBy || 'created_at',
    sortOrder: query.sortOrder || 'desc'
  };
}

/**
 * Vercel Serverless Function Handler
 * Handles:
 * - GET /api/admin/books - List books
 * - POST /api/admin/books/bulk - Bulk operations
 * - POST /api/admin/books/bulk-update-categories - Sync categories with genres
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Validate authorization for all requests
  const authHeader = req.headers['authorization'];
  const authResult = validateAuthorization(authHeader);
  
  if (!authResult.valid) {
    console.warn(`[Books API] Unauthorized request: ${authResult.error}`);
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: authResult.error,
      timestamp: new Date().toISOString()
    });
  }
  
  // Check URL path to determine which operation to perform
  const url = req.url || '';
  
  // Handle bulk-update-categories endpoint (POST only)
  if (url.includes('bulk-update-categories')) {
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'This endpoint only accepts POST requests',
        timestamp: new Date().toISOString()
      });
    }
    return await handleBulkUpdateCategories(req, res);
  }
  
  // Handle bulk endpoint (POST only)
  if (url.includes('/bulk')) {
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'This endpoint only accepts POST requests',
        timestamp: new Date().toISOString()
      });
    }
    return await handleBulkOperation(req, res);
  }
  
  // Default: List books (GET only)
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'This endpoint only accepts GET requests',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Books API] Missing Supabase configuration');
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database configuration missing',
        timestamp: new Date().toISOString()
      });
    }
    
    initSupabase(supabaseUrl, supabaseKey);
    
    // Parse query parameters
    const options = parseQueryParams(req.query || {});
    
    console.log(`[Books API] Listing books with options:`, JSON.stringify(options));
    
    // Fetch books
    const result = await listBooks(options);
    
    if (!result.success) {
      console.error(`[Books API] Error listing books: ${result.error}`);
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`[Books API] Listed ${result.books.length} books in ${responseTime}ms`);
    
    // Return successful response
    return res.status(200).json({
      success: true,
      books: result.books,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Books API] Unexpected error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to list books',
      timestamp: new Date().toISOString()
    });
  }
}

// ============================================================================
// BULK OPERATIONS (merged from bulk.js and bulk-update-categories.js)
// ============================================================================

let bulkSupabase = null;

/**
 * Initialize Supabase client for bulk operations
 */
function initBulkSupabase(url, key) {
  if (!url || !key) {
    throw new Error('Supabase URL and key are required');
  }
  bulkSupabase = createClient(url, key);
  return bulkSupabase;
}

/**
 * Get the Supabase client instance for bulk operations
 */
function getBulkSupabase() {
  if (!bulkSupabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (url && key) {
      return initBulkSupabase(url, key);
    }
    throw new Error('Supabase client not initialized');
  }
  return bulkSupabase;
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
 */
function validateBulkRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }
  
  if (!body.operation || !VALID_OPERATIONS.includes(body.operation)) {
    return { 
      valid: false, 
      error: `Invalid operation. Must be one of: ${VALID_OPERATIONS.join(', ')}` 
    };
  }
  
  if (!body.bookIds || !Array.isArray(body.bookIds)) {
    return { valid: false, error: 'bookIds must be an array' };
  }
  
  if (body.bookIds.length === 0) {
    return { valid: false, error: 'bookIds array cannot be empty' };
  }
  
  const invalidIds = body.bookIds.filter(id => !UUID_REGEX.test(id));
  if (invalidIds.length > 0) {
    return { 
      valid: false, 
      error: `Invalid book ID format: ${invalidIds.slice(0, 3).join(', ')}${invalidIds.length > 3 ? '...' : ''}` 
    };
  }
  
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
 */
async function bulkUpdateCategory(bookIds, category, adminInfo) {
  const client = getBulkSupabase();
  const results = [];
  let processed = 0;
  let failed = 0;
  
  for (const bookId of bookIds) {
    try {
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
      
      const { error: updateError } = await client
        .from('books')
        .update({ category: category.trim() })
        .eq('id', bookId);
      
      if (updateError) {
        results.push({ bookId, status: 'error', message: updateError.message });
        failed++;
        continue;
      }
      
      if (currentBook.category !== category.trim()) {
        await client.from('book_audit_log').insert({
          book_id: bookId,
          book_identifier: currentBook.source_identifier || currentBook.title,
          action: 'update',
          changes: {
            category: { from: currentBook.category, to: category.trim() }
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
 */
async function bulkUpdateGenre(bookIds, genres, adminInfo) {
  const client = getBulkSupabase();
  const results = [];
  let processed = 0;
  let failed = 0;
  
  const validatedGenres = validateGenres(genres);
  
  for (const bookId of bookIds) {
    try {
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
      
      const updateData = { genres: validatedGenres };
      if (validatedGenres.length > 0) {
        updateData.category = validatedGenres[0];
      }
      
      const { error: updateError } = await client
        .from('books')
        .update(updateData)
        .eq('id', bookId);
      
      if (updateError) {
        results.push({ bookId, status: 'error', message: updateError.message });
        failed++;
        continue;
      }
      
      const changes = {};
      if (JSON.stringify(currentBook.genres) !== JSON.stringify(validatedGenres)) {
        changes.genres = { from: currentBook.genres, to: validatedGenres };
      }
      if (validatedGenres.length > 0 && currentBook.category !== validatedGenres[0]) {
        changes.category = { from: currentBook.category, to: validatedGenres[0] };
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

const PDF_BUCKET = 'book-pdfs';
const COVER_BUCKET = 'book-covers';

/**
 * Extracts storage path from a Supabase storage URL
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
 */
async function bulkDelete(bookIds, confirmed, adminInfo) {
  const client = getBulkSupabase();
  
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
      
      await client.from('book_audit_log').insert({
        book_id: bookId,
        book_identifier: book.source_identifier || book.title,
        action: 'delete',
        changes: { deleted_book: book },
        admin_user_id: adminInfo.userId || null,
        admin_username: adminInfo.username || null
      });
      
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
 * Handles POST /api/admin/books/bulk
 */
async function handleBulkOperation(req, res) {
  const startTime = Date.now();
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database configuration missing',
      timestamp: new Date().toISOString()
    });
  }
  
  initBulkSupabase(supabaseUrl, supabaseKey);
  
  const validation = validateBulkRequest(req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: validation.error,
      timestamp: new Date().toISOString()
    });
  }
  
  const adminInfo = {
    userId: req.headers['x-admin-user-id'] || null,
    username: req.headers['x-admin-username'] || null
  };
  
  const confirmed = req.headers['x-confirm-delete'] === 'true' || 
                    req.query?.confirm === 'true';
  
  console.log(`[Books API] Processing ${validation.operation} for ${validation.bookIds.length} books`);
  
  try {
    let result;
    
    switch (validation.operation) {
      case 'update_category':
        result = await bulkUpdateCategory(validation.bookIds, validation.data.category, adminInfo);
        break;
      case 'update_genre':
        result = await bulkUpdateGenre(validation.bookIds, validation.data.genres, adminInfo);
        break;
      case 'delete':
        result = await bulkDelete(validation.bookIds, confirmed, adminInfo);
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
    
    console.log(`[Books API] ${validation.operation} completed: ${result.processed} processed, ${result.failed} failed in ${responseTime}ms`);
    
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
    console.error(`[Books API] Unexpected error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to process bulk operation',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handles POST /api/admin/books/bulk-update-categories
 */
async function handleBulkUpdateCategories(req, res) {
  const startTime = Date.now();
  
  try {
    console.log('[Books API] Starting bulk category update...');
    
    const result = await updateAllCategories();
    
    const responseTime = Date.now() - startTime;
    console.log(`[Books API] Bulk update completed in ${responseTime}ms`);
    
    return res.status(200).json({
      success: true,
      message: 'Bulk category update completed',
      result: {
        totalProcessed: result.updated + result.errors,
        updated: result.updated,
        errors: result.errors,
        errorDetails: result.details
      },
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Books API] Error during bulk update: ${error.message}`);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to complete bulk category update',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing
export { 
  validateAuthorization, 
  parseQueryParams,
  validateBulkRequest,
  bulkUpdateCategory,
  bulkUpdateGenre,
  bulkDelete,
  VALID_OPERATIONS
};
