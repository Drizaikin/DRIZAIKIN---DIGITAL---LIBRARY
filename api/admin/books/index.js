/**
 * Admin Books API Endpoint
 * 
 * GET /api/admin/books - List books with pagination, filtering, and sorting
 * 
 * Requirements: 1.1, 1.4, 1.5, 1.6, 8.3
 * - 1.1: Display paginated list of all books
 * - 1.4: Support sorting by title, author, date, category
 * - 1.5: Support filtering by category, genre, source, date range
 * - 1.6: Support search by title, author, ISBN
 * - 8.3: Require admin authentication
 */

import { listBooks, initSupabase } from '../../../services/admin/bookManagementService.js';

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
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'This endpoint only accepts GET requests',
      timestamp: new Date().toISOString()
    });
  }
  
  // Validate authorization
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

// Export for testing
export { validateAuthorization, parseQueryParams };
