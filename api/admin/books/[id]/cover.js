/**
 * Admin Book Cover Upload API Endpoint
 * 
 * POST /api/admin/books/[id]/cover - Upload or update book cover
 * 
 * Requirements: 3.1, 3.4, 3.5
 * - 3.1: Display options to upload a new cover or enter a cover URL
 * - 3.4: Validate URL accessibility for URL-based updates
 * - 3.5: Update book record with new cover URL
 */

import {
  initSupabase,
  uploadCoverFromBuffer,
  uploadCoverFromUrl,
  updateBookCoverUrl,
  deleteOldCover,
  SUPPORTED_FORMATS
} from '../../../../services/admin/coverUploadService.js';
import { getBookById, initSupabase as initBookService } from '../../../../services/admin/bookManagementService.js';

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  if (!adminSecret) {
    console.error('[Cover API] ADMIN_HEALTH_SECRET not configured');
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
  const match = url.match(/\/api\/admin\/books\/([^/?]+)\/cover/);
  return match ? match[1] : null;
}

/**
 * Parses multipart form data for file uploads
 * This is a simple parser for base64-encoded file data
 * @param {Object} body - Request body
 * @returns {{ file?: Buffer, contentType?: string, coverUrl?: string }}
 */
function parseRequestBody(body) {
  if (!body) {
    return {};
  }

  // Handle URL-based update
  if (body.coverUrl && typeof body.coverUrl === 'string') {
    return { coverUrl: body.coverUrl };
  }

  // Handle base64-encoded file upload
  if (body.imageData && typeof body.imageData === 'string') {
    try {
      const buffer = Buffer.from(body.imageData, 'base64');
      return {
        file: buffer,
        contentType: body.contentType || 'image/jpeg'
      };
    } catch (error) {
      console.error('[Cover API] Failed to decode base64 image:', error.message);
      return {};
    }
  }

  return {};
}

/**
 * Handles POST request - Upload or update book cover
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 * @param {string} bookId - Book UUID
 */
async function handlePost(req, res, bookId) {
  const startTime = Date.now();

  try {
    // Verify book exists
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

    const existingCoverUrl = bookResult.book.cover_url;
    const { file, contentType, coverUrl } = parseRequestBody(req.body);

    // Validate that we have either a file or URL
    if (!file && !coverUrl) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Either imageData (base64) or coverUrl is required',
        supportedFormats: SUPPORTED_FORMATS,
        timestamp: new Date().toISOString()
      });
    }

    let uploadResult;

    if (file) {
      // Handle file upload
      console.log(`[Cover API] Processing file upload for book ${bookId}`);
      uploadResult = await uploadCoverFromBuffer(bookId, file, contentType);
    } else {
      // Handle URL-based update
      console.log(`[Cover API] Processing URL-based cover for book ${bookId}: ${coverUrl}`);
      uploadResult = await uploadCoverFromUrl(bookId, coverUrl);
    }

    if (!uploadResult.success) {
      return res.status(400).json({
        success: false,
        error: 'UPLOAD_ERROR',
        message: uploadResult.error,
        timestamp: new Date().toISOString()
      });
    }

    // Update book record with new cover URL
    const updateResult = await updateBookCoverUrl(bookId, uploadResult.url);
    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Cover uploaded but failed to update book record',
        coverUrl: uploadResult.url,
        timestamp: new Date().toISOString()
      });
    }

    // Delete old cover if it was in our storage (best effort, don't fail if this fails)
    if (existingCoverUrl && existingCoverUrl !== uploadResult.url) {
      await deleteOldCover(existingCoverUrl);
    }

    const responseTime = Date.now() - startTime;
    console.log(`[Cover API] Cover updated for book ${bookId} in ${responseTime}ms`);

    return res.status(200).json({
      success: true,
      coverUrl: uploadResult.url,
      book: updateResult.book,
      message: 'Cover updated successfully',
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Cover API] Error updating cover: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to update cover',
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
  // Only allow POST method
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
    console.warn(`[Cover API] Unauthorized request: ${authResult.error}`);
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
    console.error('[Cover API] Missing Supabase configuration');
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database configuration missing',
      timestamp: new Date().toISOString()
    });
  }

  initSupabase(supabaseUrl, supabaseKey);
  initBookService(supabaseUrl, supabaseKey);

  return handlePost(req, res, bookId);
}

// Export for testing
export { validateAuthorization, extractBookId, parseRequestBody };
