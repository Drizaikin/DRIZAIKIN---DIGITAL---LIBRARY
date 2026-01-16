/**
 * Admin Books Search API Endpoint
 * 
 * POST /api/admin/books/search - AI-powered book search across multiple sources
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 9.1, 9.6, 10.2
 * - 4.1: Query configured book sources for matching books
 * - 4.2: Use AI to rank and filter results based on relevance
 * - 4.3: Display results with title, author, description, availability
 * - 4.4: Indicate which books are already in the library
 * - 9.1: Support multiple book sources
 * - 9.6: Allow filtering by source
 * - 10.2: Support year range filtering
 */

import { searchBooks, initSupabase } from '../../../services/admin/aiBookSearchService.js';

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  if (!adminSecret) {
    console.error('[Search API] ADMIN_HEALTH_SECRET not configured');
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
 * Validates search request body
 * @param {Object} body - Request body
 * @returns {{ valid: boolean, criteria?: Object, error?: string }}
 */
function validateSearchRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }
  
  if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
    return { valid: false, error: 'Search query is required' };
  }
  
  const criteria = {
    query: body.query.trim()
  };
  
  // Optional: topic
  if (body.topic && typeof body.topic === 'string') {
    criteria.topic = body.topic.trim();
  }
  
  // Optional: author
  if (body.author && typeof body.author === 'string') {
    criteria.author = body.author.trim();
  }
  
  // Optional: year range
  if (body.yearFrom !== undefined) {
    const yearFrom = parseInt(body.yearFrom, 10);
    if (isNaN(yearFrom) || yearFrom < 0 || yearFrom > new Date().getFullYear() + 1) {
      return { valid: false, error: 'Invalid yearFrom value' };
    }
    criteria.yearFrom = yearFrom;
  }
  
  if (body.yearTo !== undefined) {
    const yearTo = parseInt(body.yearTo, 10);
    if (isNaN(yearTo) || yearTo < 0 || yearTo > new Date().getFullYear() + 1) {
      return { valid: false, error: 'Invalid yearTo value' };
    }
    criteria.yearTo = yearTo;
  }
  
  // Validate year range logic
  if (criteria.yearFrom && criteria.yearTo && criteria.yearFrom > criteria.yearTo) {
    return { valid: false, error: 'yearFrom cannot be greater than yearTo' };
  }
  
  // Optional: genre
  if (body.genre && typeof body.genre === 'string') {
    criteria.genre = body.genre.trim();
  }
  
  // Optional: sources (array of valid source names)
  const validSources = ['internet_archive', 'open_library', 'google_books'];
  if (body.sources) {
    if (!Array.isArray(body.sources)) {
      return { valid: false, error: 'sources must be an array' };
    }
    const invalidSources = body.sources.filter(s => !validSources.includes(s));
    if (invalidSources.length > 0) {
      return { valid: false, error: `Invalid sources: ${invalidSources.join(', ')}` };
    }
    criteria.sources = body.sources;
  }
  
  // Optional: accessType (array of valid access types)
  const validAccessTypes = ['public_domain', 'open_access', 'preview_only'];
  if (body.accessType) {
    if (!Array.isArray(body.accessType)) {
      return { valid: false, error: 'accessType must be an array' };
    }
    const invalidTypes = body.accessType.filter(t => !validAccessTypes.includes(t));
    if (invalidTypes.length > 0) {
      return { valid: false, error: `Invalid access types: ${invalidTypes.join(', ')}` };
    }
    criteria.accessType = body.accessType;
  }
  
  // Optional: limit
  if (body.limit !== undefined) {
    const limit = parseInt(body.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return { valid: false, error: 'limit must be between 1 and 100' };
    }
    criteria.limit = limit;
  }
  
  return { valid: true, criteria };
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
    console.warn(`[Search API] Unauthorized request: ${authResult.error}`);
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: authResult.error,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Initialize Supabase for duplicate checking
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Search API] Missing Supabase configuration');
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database configuration missing',
        timestamp: new Date().toISOString()
      });
    }
    
    initSupabase(supabaseUrl, supabaseKey);
    
    // Validate request body
    const validation = validateSearchRequest(req.body);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[Search API] Searching with criteria:`, JSON.stringify(validation.criteria));
    
    // Perform search
    const result = await searchBooks(validation.criteria);
    
    if (!result.success) {
      console.error(`[Search API] Search failed: ${result.error}`);
      return res.status(500).json({
        success: false,
        error: 'SEARCH_ERROR',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`[Search API] Found ${result.results.length} results in ${responseTime}ms`);
    
    // Return successful response
    return res.status(200).json({
      success: true,
      results: result.results,
      total: result.total,
      query: result.query,
      sourceBreakdown: result.sourceBreakdown,
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Search API] Unexpected error: ${error.message}`);
    console.error(error.stack);
    
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to search books',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing
export { validateAuthorization, validateSearchRequest };
