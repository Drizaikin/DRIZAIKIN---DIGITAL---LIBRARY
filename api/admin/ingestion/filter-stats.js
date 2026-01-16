/**
 * Admin Ingestion Filter Statistics API Endpoint
 * 
 * GET /api/admin/ingestion/filter-stats - Returns filter statistics from recent ingestion runs
 * 
 * Requirements: 5.7.4, 5.7.5, 5.7.6
 * - Query ingestion_filter_stats table for detailed statistics
 * - Return total evaluated, passed, filtered counts
 * - Return top filtered genres and authors
 * - Require admin authentication
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  // Reject all requests if secret not configured
  if (!adminSecret) {
    console.error('[Filter Stats API] ADMIN_HEALTH_SECRET not configured');
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
 * Gets Supabase client instance
 * @returns {Object} Supabase client
 */
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

/**
 * Checks if the ingestion_filter_stats table exists
 * @param {Object} client - Supabase client
 * @returns {Promise<boolean>} True if table exists
 */
async function filterStatsTableExists(client) {
  try {
    // Try to query the table with a limit of 0 to check if it exists
    const { error } = await client
      .from('ingestion_filter_stats')
      .select('id')
      .limit(0);
    
    // If no error, table exists
    return !error;
  } catch (error) {
    return false;
  }
}

/**
 * Computes filter statistics from the ingestion_filter_stats table
 * @param {number} limit - Number of recent jobs to analyze
 * @returns {Promise<Object>} Filter statistics
 */
async function computeFilterStatisticsFromTable(client, limit = 10) {
  try {
    // Get recent job IDs from ingestion_logs
    const { data: recentJobs, error: jobsError } = await client
      .from('ingestion_logs')
      .select('id')
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (jobsError) {
      throw new Error(`Failed to fetch recent jobs: ${jobsError.message}`);
    }
    
    if (!recentJobs || recentJobs.length === 0) {
      return {
        totalEvaluated: 0,
        passed: 0,
        filtered: 0,
        filteredByGenre: 0,
        filteredByAuthor: 0,
        jobsAnalyzed: 0,
        topFilteredGenres: [],
        topFilteredAuthors: []
      };
    }
    
    const jobIds = recentJobs.map(j => j.id);
    
    // Get filter stats for these jobs
    const { data: stats, error: statsError } = await client
      .from('ingestion_filter_stats')
      .select('filter_result, book_genres, book_author')
      .in('job_id', jobIds);
    
    if (statsError) {
      throw new Error(`Failed to fetch filter stats: ${statsError.message}`);
    }
    
    // Calculate aggregate statistics
    let totalEvaluated = 0;
    let passed = 0;
    let filteredByGenre = 0;
    let filteredByAuthor = 0;
    const genreCounts = {};
    const authorCounts = {};
    
    for (const stat of stats || []) {
      totalEvaluated++;
      
      if (stat.filter_result === 'passed') {
        passed++;
      } else if (stat.filter_result === 'filtered_genre') {
        filteredByGenre++;
        // Track genres that were filtered
        if (stat.book_genres && Array.isArray(stat.book_genres)) {
          for (const genre of stat.book_genres) {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
          }
        }
      } else if (stat.filter_result === 'filtered_author') {
        filteredByAuthor++;
        // Track authors that were filtered
        if (stat.book_author) {
          authorCounts[stat.book_author] = (authorCounts[stat.book_author] || 0) + 1;
        }
      }
    }
    
    // Get top filtered genres
    const topFilteredGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));
    
    // Get top filtered authors
    const topFilteredAuthors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([author, count]) => ({ author, count }));
    
    return {
      totalEvaluated,
      passed,
      filtered: filteredByGenre + filteredByAuthor,
      filteredByGenre,
      filteredByAuthor,
      jobsAnalyzed: recentJobs.length,
      topFilteredGenres,
      topFilteredAuthors
    };
  } catch (error) {
    console.error(`[Filter Stats API] Error computing statistics from table: ${error.message}`);
    throw error;
  }
}

/**
 * Computes filter statistics from recent ingestion logs (fallback method)
 * Used when ingestion_filter_stats table is not available
 * @param {Object} client - Supabase client
 * @param {number} limit - Number of recent jobs to analyze
 * @returns {Promise<Object>} Filter statistics
 */
async function computeFilterStatisticsFromLogs(client, limit = 10) {
  try {
    // Fetch recent ingestion logs
    const { data: logs, error } = await client
      .from('ingestion_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error(`[Filter Stats API] Error fetching logs: ${error.message}`);
      throw new Error('Failed to fetch ingestion logs');
    }
    
    if (!logs || logs.length === 0) {
      // No logs available - return empty statistics
      return {
        totalEvaluated: 0,
        passed: 0,
        filtered: 0,
        filteredByGenre: 0,
        filteredByAuthor: 0,
        jobsAnalyzed: 0,
        topFilteredGenres: [],
        topFilteredAuthors: [],
        note: 'Statistics computed from ingestion_logs (limited detail). Run the ingestion_filter_stats migration for detailed statistics.'
      };
    }
    
    // Aggregate statistics across all logs
    let totalEvaluated = 0;
    let totalAdded = 0;
    let totalFiltered = 0;
    
    for (const log of logs) {
      const processed = log.books_processed || 0;
      const added = log.books_added || 0;
      const skipped = log.books_skipped || 0;
      const failed = log.books_failed || 0;
      
      // Filtered books are those that were processed but not added, skipped, or failed
      const filtered = Math.max(0, processed - (added + skipped + failed));
      
      totalEvaluated += processed;
      totalAdded += added;
      totalFiltered += filtered;
    }
    
    return {
      totalEvaluated,
      passed: totalAdded,
      filtered: totalFiltered,
      filteredByGenre: 0, // Not available without filter_stats table
      filteredByAuthor: 0, // Not available without filter_stats table
      jobsAnalyzed: logs.length,
      topFilteredGenres: [], // Not available without filter_stats table
      topFilteredAuthors: [], // Not available without filter_stats table
      note: 'Statistics computed from ingestion_logs (limited detail). Run the ingestion_filter_stats migration for detailed statistics.'
    };
  } catch (error) {
    console.error(`[Filter Stats API] Error computing statistics from logs: ${error.message}`);
    throw error;
  }
}

/**
 * Computes filter statistics, using the filter_stats table if available
 * @param {number} limit - Number of recent jobs to analyze
 * @returns {Promise<Object>} Filter statistics
 */
async function computeFilterStatistics(limit = 10) {
  const client = getSupabase();
  
  // Check if the filter_stats table exists
  const tableExists = await filterStatsTableExists(client);
  
  if (tableExists) {
    console.log('[Filter Stats API] Using ingestion_filter_stats table for statistics');
    return computeFilterStatisticsFromTable(client, limit);
  } else {
    console.log('[Filter Stats API] Falling back to ingestion_logs for statistics');
    return computeFilterStatisticsFromLogs(client, limit);
  }
}

/**
 * Handles GET request - retrieve filter statistics
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 */
async function handleGet(req, res) {
  try {
    // Parse limit from query parameters (default: 10)
    const limit = parseInt(req.query.limit) || 10;
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit',
        message: 'Limit must be between 1 and 100',
        timestamp: new Date().toISOString()
      });
    }
    
    // Compute statistics
    const stats = await computeFilterStatistics(limit);
    
    return res.status(200).json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[Filter Stats API] Error retrieving statistics: ${error.message}`);
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
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  // Validate authorization (Requirement 5.7.4, 5.7.6)
  const authHeader = req.headers['authorization'];
  const authResult = validateAuthorization(authHeader);
  
  if (!authResult.valid) {
    console.warn(`[Filter Stats API] Unauthorized request: ${authResult.error}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: authResult.error,
      timestamp: new Date().toISOString()
    });
  }
  
  // Only accept GET requests
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'This endpoint only accepts GET requests',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing
export { validateAuthorization, computeFilterStatistics, filterStatsTableExists, computeFilterStatisticsFromTable, computeFilterStatisticsFromLogs };
