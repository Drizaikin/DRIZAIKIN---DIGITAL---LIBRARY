/**
 * Admin Ingestion Filters API Endpoint
 * 
 * GET /api/admin/ingestion/filters - Returns current filter configuration
 * POST /api/admin/ingestion/filters - Updates filter configuration
 * 
 * Requirements: 5.8.5
 * - Validate genre names against taxonomy
 * - Validate author names are non-empty strings
 * - Store configuration in environment variables
 * - Require admin authentication
 */

import { PRIMARY_GENRES } from '../../../services/ingestion/genreTaxonomy.js';
import { validateGenreNames } from '../../../services/ingestion/ingestionFilter.js';

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  // Reject all requests if secret not configured
  if (!adminSecret) {
    console.error('[Filters API] ADMIN_HEALTH_SECRET not configured');
    return { valid: false, error: 'Service not configured' };
  }
  
  // Return 401 for missing authorization
  if (!authHeader) {
    return { valid: false, error: 'Authorization required' };
  }
  
  // Validate using ADMIN_HEALTH_SECRET
  const expectedAuth = `Bearer ${adminSecret}`;
  if (authHeader !== expectedAuth) {
    return { valid: false, error: 'Invalid authorization' };
  }
  
  return { valid: true };
}

/**
 * Validates filter configuration
 * @param {Object} config - Configuration to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFilterConfig(config) {
  const errors = [];
  
  // Validate structure
  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object');
    return { valid: false, errors };
  }
  
  // Validate allowedGenres
  if (config.allowedGenres !== undefined) {
    if (!Array.isArray(config.allowedGenres)) {
      errors.push('allowedGenres must be an array');
    } else {
      // Validate each genre against taxonomy (Requirement 5.8.5)
      const genreValidation = validateGenreNames(config.allowedGenres);
      if (!genreValidation.valid) {
        errors.push(
          `Invalid genres: ${genreValidation.invalidGenres.join(', ')}. ` +
          `Valid genres: ${PRIMARY_GENRES.join(', ')}`
        );
      }
    }
  }
  
  // Validate allowedAuthors
  if (config.allowedAuthors !== undefined) {
    if (!Array.isArray(config.allowedAuthors)) {
      errors.push('allowedAuthors must be an array');
    } else {
      // Validate author names are non-empty strings (Requirement 5.8.5)
      const invalidAuthors = config.allowedAuthors.filter(
        author => typeof author !== 'string' || author.trim().length === 0
      );
      if (invalidAuthors.length > 0) {
        errors.push('All author names must be non-empty strings');
      }
    }
  }
  
  // Validate enable flags
  if (config.enableGenreFilter !== undefined && typeof config.enableGenreFilter !== 'boolean') {
    errors.push('enableGenreFilter must be a boolean');
  }
  
  if (config.enableAuthorFilter !== undefined && typeof config.enableAuthorFilter !== 'boolean') {
    errors.push('enableAuthorFilter must be a boolean');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Gets current filter configuration from environment variables
 * @returns {Object} Current configuration
 */
function getCurrentConfig() {
  // Parse allowed genres from environment (comma-separated)
  const allowedGenresStr = process.env.INGEST_ALLOWED_GENRES || '';
  const allowedGenres = allowedGenresStr
    .split(',')
    .map(g => g.trim())
    .filter(g => g.length > 0);
  
  // Parse allowed authors from environment (comma-separated)
  const allowedAuthorsStr = process.env.INGEST_ALLOWED_AUTHORS || '';
  const allowedAuthors = allowedAuthorsStr
    .split(',')
    .map(a => a.trim())
    .filter(a => a.length > 0);
  
  // Parse enable flags
  const enableGenreFilter = process.env.ENABLE_GENRE_FILTER === 'true';
  const enableAuthorFilter = process.env.ENABLE_AUTHOR_FILTER === 'true';
  
  return {
    allowedGenres,
    allowedAuthors,
    enableGenreFilter,
    enableAuthorFilter
  };
}

/**
 * Handles GET request - retrieve current configuration
 * @param {Response} res - Response object
 */
function handleGet(res) {
  try {
    const config = getCurrentConfig();
    
    return res.status(200).json({
      success: true,
      config,
      availableGenres: PRIMARY_GENRES,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[Filters API] Error retrieving configuration: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve filter configuration',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handles POST request - update configuration
 * Note: This implementation returns the validated config but doesn't persist it
 * since environment variables can't be modified at runtime.
 * In production, this would write to a database table.
 * 
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 */
function handlePost(req, res) {
  try {
    const newConfig = req.body;
    
    // Validate configuration (Requirement 5.8.5)
    const validation = validateFilterConfig(newConfig);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration',
        errors: validation.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    // In a real implementation, this would:
    // 1. Store configuration in database (ingestion_config table)
    // 2. Invalidate cache
    // 3. Notify ingestion service of config change
    
    // For now, we return success with the validated config
    // The actual configuration is still read from environment variables
    console.log('[Filters API] Configuration validated successfully:', newConfig);
    
    return res.status(200).json({
      success: true,
      message: 'Configuration validated successfully. Note: Environment variables are still used for actual filtering.',
      config: newConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[Filters API] Error updating configuration: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update filter configuration',
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
  // Validate authorization (Requirement 5.8.5)
  const authHeader = req.headers['authorization'];
  const authResult = validateAuthorization(authHeader);
  
  if (!authResult.valid) {
    console.warn(`[Filters API] Unauthorized request: ${authResult.error}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: authResult.error,
      timestamp: new Date().toISOString()
    });
  }
  
  // Route based on HTTP method
  if (req.method === 'GET') {
    return handleGet(res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'This endpoint only accepts GET and POST requests',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing
export { validateAuthorization, validateFilterConfig, getCurrentConfig };
