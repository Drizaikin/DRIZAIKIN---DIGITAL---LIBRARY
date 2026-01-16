/**
 * Admin Book CRUD API Endpoint (Single Book Operations)
 * 
 * PUT /api/admin/books/[id] - Update book metadata
 * DELETE /api/admin/books/[id] - Delete book and associated assets
 * 
 * Requirements:
 * PUT: 2.3, 2.4, 2.5, 2.6, 2.7
 * - 2.3: Update book record in database
 * - 2.4: Display validation errors for invalid data
 * - 2.5: Validate genre from taxonomy
 * - 2.6: Display success notification
 * - 2.7: Log all edits with timestamp and admin user ID
 * 
 * DELETE: 6.1, 6.2, 6.3, 6.4, 6.5
 * - 6.1: Display confirmation dialog (handled by frontend)
 * - 6.2: Warn about permanent deletion
 * - 6.3: Remove book record from database
 * - 6.4: Delete associated PDF from storage
 * - 6.5: Log deletion with timestamp, admin user ID, and book identifier
 */

import { 
  updateBook, 
  deleteBook, 
  getBookById,
  initSupabase 
} from '../../../services/admin/bookManagementService.js';

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  if (!adminSecret) {
    console.error('[Book API] ADMIN_HEALTH_SECRET not configured');
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
 * Extracts book ID from request URL
 * @param {Object} req - Request object
 * @returns {string|null} Book ID or null
 */
function extractBookId(req) {
  // Vercel provides dynamic route params in req.query
  if (req.query && req.query.id) {
    return req.query.id;
  }
  
  // Fallback: extract from URL path
  const url = req.url || '';
  const match = url.match(/\/api\/admin\/books\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * Handles PUT request - Update book metadata
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 * @param {string} bookId - Book UUID
 */
async function handlePut(req, res, bookId) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const updates = req.body;
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Request body must be a JSON object',
        timestamp: new Date().toISOString()
      });
    }
    
    // Extract admin info from headers (if provided)
    const adminInfo = {
      userId: req.headers['x-admin-user-id'] || null,
      username: req.headers['x-admin-username'] || null
    };
    
    console.log(`[Book API] Updating book ${bookId} with:`, JSON.stringify(updates));
    
    // Perform update
    const result = await updateBook(bookId, updates, adminInfo);
    
    if (!result.success) {
      // Handle validation errors
      if (result.validationErrors) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: result.error,
          validationErrors: result.validationErrors,
          timestamp: new Date().toISOString()
        });
      }
      
      // Handle not found
      if (result.error === 'Book not found') {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Book not found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Handle other errors
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`[Book API] Book ${bookId} updated in ${responseTime}ms`);
    
    return res.status(200).json({
      success: true,
      book: result.book,
      message: 'Book updated successfully',
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Book API] Error updating book: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to update book',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handles DELETE request - Delete book and assets
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 * @param {string} bookId - Book UUID
 */
async function handleDelete(req, res, bookId) {
  const startTime = Date.now();
  
  try {
    // Check for confirmation header (optional safety measure)
    const confirmed = req.headers['x-confirm-delete'] === 'true' || 
                      req.query.confirm === 'true';
    
    // Get book info first for response
    const bookResult = await getBookById(bookId);
    
    if (!bookResult.success) {
      if (bookResult.error === 'Book not found') {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Book not found',
          timestamp: new Date().toISOString()
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: bookResult.error,
        timestamp: new Date().toISOString()
      });
    }
    
    // If not confirmed, return warning (Requirement 6.2)
    if (!confirmed) {
      return res.status(200).json({
        success: false,
        requiresConfirmation: true,
        warning: 'This action will permanently delete the book and all associated files (PDF, cover image). This cannot be undone.',
        book: {
          id: bookResult.book.id,
          title: bookResult.book.title,
          author: bookResult.book.author
        },
        message: 'Set x-confirm-delete header to "true" or add ?confirm=true to proceed',
        timestamp: new Date().toISOString()
      });
    }
    
    // Extract admin info from headers
    const adminInfo = {
      userId: req.headers['x-admin-user-id'] || null,
      username: req.headers['x-admin-username'] || null
    };
    
    console.log(`[Book API] Deleting book ${bookId} (${bookResult.book.title})`);
    
    // Perform deletion
    const result = await deleteBook(bookId, adminInfo);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`[Book API] Book ${bookId} deleted in ${responseTime}ms`);
    
    return res.status(200).json({
      success: true,
      message: 'Book deleted successfully',
      deletedBook: {
        id: bookResult.book.id,
        title: bookResult.book.title,
        author: bookResult.book.author
      },
      deletedAssets: result.deletedAssets,
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Book API] Error deleting book: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to delete book',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handles GET request - Get single book by ID
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 * @param {string} bookId - Book UUID
 */
async function handleGet(req, res, bookId) {
  const startTime = Date.now();
  
  try {
    const result = await getBookById(bookId);
    
    if (!result.success) {
      if (result.error === 'Book not found') {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Book not found',
          timestamp: new Date().toISOString()
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
    const responseTime = Date.now() - startTime;
    
    return res.status(200).json({
      success: true,
      book: result.book,
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Book API] Error getting book: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get book',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Vercel Serverless Function Handler
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  // Validate authorization
  const authHeader = req.headers['authorization'];
  const authResult = validateAuthorization(authHeader);
  
  if (!authResult.valid) {
    console.warn(`[Book API] Unauthorized request: ${authResult.error}`);
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: authResult.error,
      timestamp: new Date().toISOString()
    });
  }
  
  // Extract book ID
  const bookId = extractBookId(req);
  
  if (!bookId) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Book ID is required',
      timestamp: new Date().toISOString()
    });
  }
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(bookId)) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Invalid book ID format',
      timestamp: new Date().toISOString()
    });
  }
  
  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Book API] Missing Supabase configuration');
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database configuration missing',
      timestamp: new Date().toISOString()
    });
  }
  
  initSupabase(supabaseUrl, supabaseKey);
  
  // Route to appropriate handler based on method
  switch (req.method) {
    case 'GET':
      return handleGet(req, res, bookId);
    case 'PUT':
      return handlePut(req, res, bookId);
    case 'DELETE':
      return handleDelete(req, res, bookId);
    default:
      return res.status(405).json({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'This endpoint accepts GET, PUT, and DELETE requests',
        timestamp: new Date().toISOString()
      });
  }
}

// Export for testing
export { validateAuthorization, extractBookId };
