/**
 * Admin Ingestion Filters API Endpoint
 * 
 * GET /api/admin/ingestion/filters - Returns current filter configuration
 * POST /api/admin/ingestion/filters - Updates filter configuration
 * 
 * Requirements: 5.8.5
 * - Validate genre names against taxonomy
 * - Validate author names are non-empty strings
 * - Store configuration in database (ingestion_config table)
 * - Require admin authentication
 */

import { PRIMARY_GENRES } from '../../../services/ingestion/genreTaxonomy.js';
import { validateGenreNames } from '../../../services/ingestion/ingestionFilter.js';
import { createClient } from '@supabase/supabase-js';

/**
 * Gets Supabase client instance
 * @returns {Object|null} Supabase client or null if not configured
 */
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    return null;
  }
  
  return createClient(url, key);
}

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
 * Gets current filter configuration from database, falling back to environment variables
 * @returns {Promise<Object>} Current configuration
 */
async function getCurrentConfig() {
  const client = getSupabase();
  
  // Try to get config from database first
  if (client) {
    try {
      const { data, error } = await client
        .from('ingestion_config')
        .select('*')
        .eq('config_key', 'filter_settings')
        .single();
      
      if (!error && data && data.config_value) {
        console.log('[Filters API] Loaded config from database');
        return data.config_value;
      }
    } catch (err) {
      console.warn('[Filters API] Database config not available, using env vars:', err.message);
    }
  }
  
  // Fall back to environment variables
  console.log('[Filters API] Using environment variables for config');
  const allowedGenresStr = process.env.INGEST_ALLOWED_GENRES || '';
  const allowedGenres = allowedGenresStr
    .split(',')
    .map(g => g.trim())
    .filter(g => g.length > 0);
  
  const allowedAuthorsStr = process.env.INGEST_ALLOWED_AUTHORS || '';
  const allowedAuthors = allowedAuthorsStr
    .split(',')
    .map(a => a.trim())
    .filter(a => a.length > 0);
  
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
 * Saves filter configuration to database
 * @param {Object} config - Configuration to save
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function saveConfigToDatabase(config) {
  const client = getSupabase();
  
  if (!client) {
    return { success: false, error: 'Database not configured' };
  }
  
  try {
    // Upsert the configuration
    const { error } = await client
      .from('ingestion_config')
      .upsert({
        config_key: 'filter_settings',
        config_value: config,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'config_key'
      });
    
    if (error) {
      console.error('[Filters API] Failed to save config:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('[Filters API] Configuration saved to database');
    return { success: true };
  } catch (err) {
    console.error('[Filters API] Error saving config:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Handles GET request - retrieve current configuration
 * @param {Response} res - Response object
 */
async function handleGet(res) {
  try {
    const config = await getCurrentConfig();
    
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
 * Persists configuration to database for use by ingestion service
 * 
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 */
async function handlePost(req, res) {
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
    
    // Save configuration to database
    const saveResult = await saveConfigToDatabase(newConfig);
    
    if (!saveResult.success) {
      console.warn('[Filters API] Database save failed, config validated but not persisted:', saveResult.error);
      return res.status(200).json({
        success: true,
        message: 'Configuration validated but could not be persisted to database. Please ensure the ingestion_config table exists.',
        config: newConfig,
        persisted: false,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('[Filters API] Configuration saved successfully:', newConfig);
    
    return res.status(200).json({
      success: true,
      message: 'Filter configuration saved successfully',
      config: newConfig,
      persisted: true,
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
 * Computes filter statistics from recent ingestion logs
 * @param {number} limit - Number of recent jobs to analyze
 * @returns {Promise<Object>} Filter statistics
 */
async function computeFilterStatistics(limit = 10) {
  const client = getSupabase();
  
  if (!client) {
    return {
      totalEvaluated: 0,
      passed: 0,
      filtered: 0,
      jobsAnalyzed: 0,
      topFilteredGenres: [],
      topFilteredAuthors: [],
      note: 'Database not configured'
    };
  }
  
  try {
    // Fetch recent ingestion logs
    const { data: logs, error } = await client
      .from('ingestion_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (error || !logs || logs.length === 0) {
      return {
        totalEvaluated: 0,
        passed: 0,
        filtered: 0,
        jobsAnalyzed: 0,
        topFilteredGenres: [],
        topFilteredAuthors: []
      };
    }
    
    let totalEvaluated = 0;
    let totalAdded = 0;
    let totalFiltered = 0;
    
    for (const log of logs) {
      const processed = log.books_processed || 0;
      const added = log.books_added || 0;
      const skipped = log.books_skipped || 0;
      const failed = log.books_failed || 0;
      const filtered = Math.max(0, processed - (added + skipped + failed));
      
      totalEvaluated += processed;
      totalAdded += added;
      totalFiltered += filtered;
    }
    
    return {
      totalEvaluated,
      passed: totalAdded,
      filtered: totalFiltered,
      filteredByGenre: 0,
      filteredByAuthor: 0,
      jobsAnalyzed: logs.length,
      topFilteredGenres: [],
      topFilteredAuthors: []
    };
  } catch (error) {
    console.error(`[Filters API] Error computing statistics: ${error.message}`);
    return {
      totalEvaluated: 0,
      passed: 0,
      filtered: 0,
      jobsAnalyzed: 0,
      topFilteredGenres: [],
      topFilteredAuthors: []
    };
  }
}

/**
 * Handles GET request for filter statistics
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 */
async function handleGetStats(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const stats = await computeFilterStatistics(Math.min(Math.max(limit, 1), 100));
    
    return res.status(200).json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[Filters API] Error retrieving statistics: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve filter statistics',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Vercel Serverless Function Handler
 * Handles both /api/admin/ingestion/filters and /api/admin/ingestion/filter-stats
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
  
  // Check if this is a filter-stats request (routed here via vercel.json)
  const url = req.url || '';
  if (url.includes('filter-stats')) {
    if (req.method === 'GET') {
      return await handleGetStats(req, res);
    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        message: 'This endpoint only accepts GET requests',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Route based on HTTP method for filters endpoint
  if (req.method === 'GET') {
    return await handleGet(res);
  } else if (req.method === 'POST') {
    return await handlePost(req, res);
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
export { validateAuthorization, validateFilterConfig, getCurrentConfig, computeFilterStatistics };
