/**
 * Admin Books Ingest API Endpoint
 * 
 * POST /api/admin/books/ingest - Queue books for manual ingestion
 * 
 * Requirements: 5.1, 5.2, 5.4, 5.5
 * - 5.1: Display confirmation dialog with selected books (handled by frontend)
 * - 5.2: Add books to ingestion queue on confirmation
 * - 5.4: Display success/failure status for each book
 * - 5.5: Skip duplicates and report as duplicate
 */

import { 
  addBooksToQueue, 
  processQueue,
  getQueueStatus,
  initSupabase 
} from '../../../services/admin/manualIngestionService.js';

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  if (!adminSecret) {
    console.error('[Ingest API] ADMIN_HEALTH_SECRET not configured');
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
 * Validates the request body for ingestion
 * @param {Object} body - Request body
 * @returns {{ valid: boolean, error?: string, books?: Array }}
 */
function validateRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }
  
  if (!Array.isArray(body.books)) {
    return { valid: false, error: 'books array is required' };
  }
  
  if (body.books.length === 0) {
    return { valid: false, error: 'books array cannot be empty' };
  }
  
  if (body.books.length > 100) {
    return { valid: false, error: 'Maximum 100 books per request' };
  }
  
  // Validate each book entry
  const validSources = ['internet_archive', 'open_library', 'google_books', 'manual'];
  const validatedBooks = [];
  
  for (let i = 0; i < body.books.length; i++) {
    const book = body.books[i];
    
    if (!book || typeof book !== 'object') {
      return { valid: false, error: `Invalid book entry at index ${i}` };
    }
    
    if (!book.identifier || typeof book.identifier !== 'string') {
      return { valid: false, error: `Missing identifier at index ${i}` };
    }
    
    if (!book.source || !validSources.includes(book.source)) {
      return { valid: false, error: `Invalid source at index ${i}. Must be one of: ${validSources.join(', ')}` };
    }
    
    validatedBooks.push({
      identifier: book.identifier.trim(),
      source: book.source,
      metadata: book.metadata || null,
      priority: typeof book.priority === 'number' ? book.priority : 0
    });
  }
  
  return { valid: true, books: validatedBooks };
}


/**
 * Vercel Serverless Function Handler
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Only allow POST and GET requests
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'This endpoint accepts POST (queue books) and GET (queue status) requests',
      timestamp: new Date().toISOString()
    });
  }
  
  // Validate authorization
  const authHeader = req.headers['authorization'];
  const authResult = validateAuthorization(authHeader);
  
  if (!authResult.valid) {
    console.warn(`[Ingest API] Unauthorized request: ${authResult.error}`);
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
      console.error('[Ingest API] Missing Supabase configuration');
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database configuration missing',
        timestamp: new Date().toISOString()
      });
    }
    
    initSupabase(supabaseUrl, supabaseKey);
    
    // Handle GET request - return queue status
    if (req.method === 'GET') {
      const status = req.query?.status || undefined;
      const limit = req.query?.limit ? parseInt(req.query.limit, 10) : 50;
      
      console.log(`[Ingest API] Getting queue status (status: ${status || 'all'}, limit: ${limit})`);
      
      const result = await getQueueStatus({ status, limit });
      
      if (!result.success) {
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
        items: result.items,
        total: result.total,
        responseTimeMs: responseTime,
        timestamp: new Date().toISOString()
      });
    }
    
    // Handle POST request - queue books for ingestion
    const bodyValidation = validateRequestBody(req.body);
    
    if (!bodyValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: bodyValidation.error,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[Ingest API] Queueing ${bodyValidation.books.length} books for ingestion`);
    
    // Extract admin user ID from request if available
    const adminUserId = req.body.adminUserId || null;
    
    // Add books to queue
    const result = await addBooksToQueue(bodyValidation.books, adminUserId);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'QUEUE_ERROR',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
    const responseTime = Date.now() - startTime;
    
    console.log(`[Ingest API] Queued ${result.queued} books, skipped ${result.skipped} in ${responseTime}ms`);
    
    // Optionally trigger immediate processing if requested
    let processingResult = null;
    if (req.body.processImmediately === true && result.queued > 0) {
      console.log(`[Ingest API] Processing queue immediately`);
      processingResult = await processQueue({
        limit: result.queued,
        adminInfo: { userId: adminUserId }
      });
    }
    
    return res.status(200).json({
      success: true,
      queued: result.queued,
      skipped: result.skipped,
      results: result.results,
      processing: processingResult ? {
        processed: processingResult.processed,
        succeeded: processingResult.succeeded,
        failed: processingResult.failed,
        results: processingResult.results
      } : null,
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Ingest API] Unexpected error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to process ingestion request',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing
export { validateAuthorization, validateRequestBody };
