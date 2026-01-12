/**
 * Admin Health API Endpoint
 * 
 * GET /api/admin/health - Returns comprehensive health metrics for the dashboard
 * 
 * Requirements: 1.1-1.5, 8.1-8.2, 9.1
 * - 1.1: Accessible only at /admin/health route
 * - 1.2: Return 401 for invalid authorization
 * - 1.3: Validate using ADMIN_HEALTH_SECRET
 * - 1.4: Reject all requests if secret not configured
 * - 1.5: Never expose sensitive API keys or credentials
 * - 8.1: Use optimized queries
 * - 8.2: Respond within 3 seconds
 * - 9.1: Return metrics in structured JSON format
 */

import { getHealthMetrics, initSupabase } from '../../../services/admin/healthService.js';

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  // Requirement 1.4: Reject all requests if secret not configured
  if (!adminSecret) {
    console.error('[Health API] ADMIN_HEALTH_SECRET not configured');
    return { valid: false, error: 'Service not configured' };
  }
  
  // Requirement 1.2: Return 401 for missing authorization
  if (!authHeader) {
    return { valid: false, error: 'Authorization required' };
  }
  
  // Requirement 1.3: Validate using ADMIN_HEALTH_SECRET
  const expectedAuth = `Bearer ${adminSecret}`;
  if (authHeader !== expectedAuth) {
    return { valid: false, error: 'Invalid authorization' };
  }
  
  return { valid: true };
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
      error: 'Method not allowed',
      message: 'This endpoint only accepts GET requests',
      timestamp: new Date().toISOString()
    });
  }
  
  // Validate authorization
  const authHeader = req.headers['authorization'];
  const authResult = validateAuthorization(authHeader);
  
  if (!authResult.valid) {
    // Requirement 1.2, 1.4: Return 401 for unauthorized requests
    // Requirement 1.5: Don't expose any metrics data
    console.warn(`[Health API] Unauthorized request: ${authResult.error}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: authResult.error,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Health API] Missing Supabase configuration');
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Database configuration missing',
        timestamp: new Date().toISOString()
      });
    }
    
    initSupabase(supabaseUrl, supabaseKey);
    
    // Requirement 8.1, 8.2: Fetch metrics with optimized queries
    const metrics = await getHealthMetrics();
    
    const responseTime = Date.now() - startTime;
    console.log(`[Health API] Metrics fetched in ${responseTime}ms`);
    
    // Requirement 9.1: Return structured JSON format
    return res.status(200).json({
      ...metrics,
      responseTimeMs: responseTime
    });
    
  } catch (error) {
    console.error(`[Health API] Error fetching metrics: ${error.message}`);
    
    // Requirement 1.5: Don't expose sensitive data in error messages
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch health metrics',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing
export { validateAuthorization };
