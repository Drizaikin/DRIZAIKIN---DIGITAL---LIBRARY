/**
 * Book Management Service
 * 
 * Provides CRUD operations for book management in the admin panel.
 * Includes pagination, filtering, sorting, and asset cleanup.
 * 
 * Requirements: 1.1, 1.4, 1.5, 2.3, 6.3, 6.4
 */

import { createClient } from '@supabase/supabase-js';
import { validateGenres } from '../ingestion/genreTaxonomy.js';

// Storage bucket names
const PDF_BUCKET = 'book-pdfs';
const COVER_BUCKET = 'book-covers';

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
 * Valid sort fields for book listing
 */
const VALID_SORT_FIELDS = ['title', 'author', 'added_date', 'category', 'created_at'];

/**
 * Maps frontend sort field names to database column names
 */
const SORT_FIELD_MAP = {
  'title': 'title',
  'author': 'author',
  'added_date': 'created_at',
  'category': 'category',
  'created_at': 'created_at'
};


/**
 * Lists books with pagination, filtering, and sorting
 * 
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number (1-indexed)
 * @param {number} [options.pageSize=20] - Items per page (max 100)
 * @param {string} [options.search] - Search term for title, author, or ISBN
 * @param {string} [options.category] - Filter by category
 * @param {string} [options.genre] - Filter by genre
 * @param {string} [options.source] - Filter by source (internet_archive, manual, extraction)
 * @param {string} [options.dateFrom] - Filter by date range start (ISO string)
 * @param {string} [options.dateTo] - Filter by date range end (ISO string)
 * @param {string} [options.sortBy='created_at'] - Sort field
 * @param {string} [options.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<{success: boolean, books?: Array, total?: number, page?: number, pageSize?: number, totalPages?: number, error?: string}>}
 */
export async function listBooks(options = {}) {
  const client = getSupabase();
  
  // Validate and set defaults
  const page = Math.max(1, parseInt(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(options.pageSize) || 20));
  const sortBy = VALID_SORT_FIELDS.includes(options.sortBy) ? options.sortBy : 'created_at';
  const sortOrder = options.sortOrder === 'asc' ? 'asc' : 'desc';
  
  // Calculate offset
  const offset = (page - 1) * pageSize;
  
  try {
    // Build query
    let query = client
      .from('books')
      .select('*', { count: 'exact' });
    
    // Apply search filter (title, author, or ISBN)
    if (options.search && options.search.trim()) {
      const searchTerm = options.search.trim();
      query = query.or(`title.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%,isbn.ilike.%${searchTerm}%`);
    }
    
    // Apply category filter
    if (options.category && options.category.trim()) {
      query = query.eq('category', options.category.trim());
    }
    
    // Apply genre filter (check if genre is in the genres array)
    if (options.genre && options.genre.trim()) {
      query = query.contains('genres', [options.genre.trim()]);
    }
    
    // Apply source filter
    if (options.source && options.source.trim()) {
      query = query.eq('source', options.source.trim());
    }
    
    // Apply date range filters
    if (options.dateFrom) {
      query = query.gte('created_at', options.dateFrom);
    }
    
    if (options.dateTo) {
      query = query.lte('created_at', options.dateTo);
    }
    
    // Apply sorting
    const dbSortField = SORT_FIELD_MAP[sortBy] || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });
    
    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);
    
    // Execute query
    const { data, error, count } = await query;
    
    if (error) {
      console.error(`[BookManagementService] Error listing books: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);
    
    return {
      success: true,
      books: data || [],
      total,
      page,
      pageSize,
      totalPages
    };
  } catch (error) {
    console.error(`[BookManagementService] Unexpected error listing books: ${error.message}`);
    return { success: false, error: error.message };
  }
}


/**
 * Gets a single book by ID
 * 
 * @param {string} bookId - Book UUID
 * @returns {Promise<{success: boolean, book?: Object, error?: string}>}
 */
export async function getBookById(bookId) {
  if (!bookId || typeof bookId !== 'string') {
    return { success: false, error: 'Invalid book ID' };
  }
  
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Book not found' };
      }
      console.error(`[BookManagementService] Error getting book: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    return { success: true, book: data };
  } catch (error) {
    console.error(`[BookManagementService] Unexpected error getting book: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Validates book update data
 * 
 * @param {Object} updates - Update data to validate
 * @returns {{valid: boolean, errors?: string[], sanitized?: Object}}
 */
export function validateBookUpdate(updates) {
  if (!updates || typeof updates !== 'object') {
    return { valid: false, errors: ['Updates must be an object'] };
  }
  
  const errors = [];
  const sanitized = {};
  
  // Validate title
  if (updates.title !== undefined) {
    if (typeof updates.title !== 'string' || updates.title.trim().length === 0) {
      errors.push('Title must be a non-empty string');
    } else {
      sanitized.title = updates.title.trim();
    }
  }
  
  // Validate author
  if (updates.author !== undefined) {
    if (typeof updates.author !== 'string' || updates.author.trim().length === 0) {
      errors.push('Author must be a non-empty string');
    } else {
      sanitized.author = updates.author.trim();
    }
  }
  
  // Validate category
  if (updates.category !== undefined) {
    if (typeof updates.category !== 'string') {
      errors.push('Category must be a string');
    } else {
      sanitized.category = updates.category.trim();
    }
  }
  
  // Validate genres (must be from taxonomy)
  if (updates.genres !== undefined) {
    if (!Array.isArray(updates.genres)) {
      errors.push('Genres must be an array');
    } else {
      const validatedGenres = validateGenres(updates.genres);
      if (validatedGenres.length === 0 && updates.genres.length > 0) {
        errors.push('All provided genres are invalid. Genres must be from the valid taxonomy.');
      } else {
        sanitized.genres = validatedGenres;
        // Auto-sync category with first genre if genres are updated
        if (validatedGenres.length > 0 && updates.category === undefined) {
          sanitized.category = validatedGenres[0];
        }
      }
    }
  }
  
  // Validate description
  if (updates.description !== undefined) {
    if (updates.description !== null && typeof updates.description !== 'string') {
      errors.push('Description must be a string or null');
    } else {
      sanitized.description = updates.description;
    }
  }
  
  // Validate published_year
  if (updates.published_year !== undefined) {
    if (updates.published_year !== null) {
      const year = parseInt(updates.published_year);
      if (isNaN(year) || year < 0 || year > new Date().getFullYear() + 1) {
        errors.push('Published year must be a valid year');
      } else {
        sanitized.published_year = year;
      }
    } else {
      sanitized.published_year = null;
    }
  }
  
  // Validate ISBN
  if (updates.isbn !== undefined) {
    if (updates.isbn !== null && typeof updates.isbn !== 'string') {
      errors.push('ISBN must be a string or null');
    } else {
      sanitized.isbn = updates.isbn ? updates.isbn.trim() : null;
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, sanitized };
}


/**
 * Updates a book record
 * 
 * @param {string} bookId - Book UUID
 * @param {Object} updates - Fields to update
 * @param {Object} [adminInfo] - Admin user info for audit logging
 * @param {string} [adminInfo.userId] - Admin user ID
 * @param {string} [adminInfo.username] - Admin username
 * @returns {Promise<{success: boolean, book?: Object, error?: string, validationErrors?: string[]}>}
 */
export async function updateBook(bookId, updates, adminInfo = {}) {
  if (!bookId || typeof bookId !== 'string') {
    return { success: false, error: 'Invalid book ID' };
  }
  
  // Validate updates
  const validation = validateBookUpdate(updates);
  if (!validation.valid) {
    return { success: false, error: 'Validation failed', validationErrors: validation.errors };
  }
  
  // Check if there are any updates to apply
  if (Object.keys(validation.sanitized).length === 0) {
    return { success: false, error: 'No valid updates provided' };
  }
  
  const client = getSupabase();
  
  try {
    // Get current book state for audit log
    const { data: currentBook, error: fetchError } = await client
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return { success: false, error: 'Book not found' };
      }
      return { success: false, error: fetchError.message };
    }
    
    // Apply updates
    const { data: updatedBook, error: updateError } = await client
      .from('books')
      .update(validation.sanitized)
      .eq('id', bookId)
      .select('*')
      .single();
    
    if (updateError) {
      console.error(`[BookManagementService] Error updating book: ${updateError.message}`);
      return { success: false, error: updateError.message };
    }
    
    // Create audit log entry
    const changes = {};
    for (const key of Object.keys(validation.sanitized)) {
      if (JSON.stringify(currentBook[key]) !== JSON.stringify(validation.sanitized[key])) {
        changes[key] = {
          from: currentBook[key],
          to: validation.sanitized[key]
        };
      }
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
    
    console.log(`[BookManagementService] Book updated: ${bookId}`);
    return { success: true, book: updatedBook };
  } catch (error) {
    console.error(`[BookManagementService] Unexpected error updating book: ${error.message}`);
    return { success: false, error: error.message };
  }
}


/**
 * Extracts storage path from a Supabase storage URL
 * 
 * @param {string} url - Full storage URL
 * @param {string} bucket - Bucket name
 * @returns {string|null} Storage path or null if not a valid storage URL
 */
function extractStoragePath(url, bucket) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  // Match Supabase storage URL pattern
  // Example: https://xxx.supabase.co/storage/v1/object/public/book-pdfs/internet_archive/filename.pdf
  const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
  const match = url.match(pattern);
  
  return match ? match[1] : null;
}

/**
 * Deletes a book and its associated assets
 * 
 * @param {string} bookId - Book UUID
 * @param {Object} [adminInfo] - Admin user info for audit logging
 * @param {string} [adminInfo.userId] - Admin user ID
 * @param {string} [adminInfo.username] - Admin username
 * @returns {Promise<{success: boolean, deletedAssets?: {pdf: boolean, cover: boolean}, error?: string}>}
 */
export async function deleteBook(bookId, adminInfo = {}) {
  if (!bookId || typeof bookId !== 'string') {
    return { success: false, error: 'Invalid book ID' };
  }
  
  const client = getSupabase();
  
  try {
    // Get book data first (for asset URLs and audit log)
    const { data: book, error: fetchError } = await client
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return { success: false, error: 'Book not found' };
      }
      return { success: false, error: fetchError.message };
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
          console.log(`[BookManagementService] Deleted PDF: ${pdfPath}`);
        } else {
          console.warn(`[BookManagementService] Failed to delete PDF: ${pdfDeleteError.message}`);
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
          console.log(`[BookManagementService] Deleted cover: ${coverPath}`);
        } else {
          console.warn(`[BookManagementService] Failed to delete cover: ${coverDeleteError.message}`);
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
      console.error(`[BookManagementService] Error deleting book: ${deleteError.message}`);
      return { success: false, error: deleteError.message };
    }
    
    console.log(`[BookManagementService] Book deleted: ${bookId}`);
    return { success: true, deletedAssets };
  } catch (error) {
    console.error(`[BookManagementService] Unexpected error deleting book: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export { PDF_BUCKET, COVER_BUCKET, VALID_SORT_FIELDS, SORT_FIELD_MAP, extractStoragePath };
