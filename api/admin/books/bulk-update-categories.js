/**
 * Bulk Category Update API Endpoint
 * 
 * POST /api/admin/books/bulk-update-categories - Triggers bulk category update
 * 
 * Requirements: 5.5.1-5.5.6
 * - Updates all books' categories to match their first genre
 * - Requires admin authentication
 * - Returns progress and results
 */

import { updateAllCategories } from '../../../services/ingestion/bulkCategoryUpdate.js';

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * (Reusing the same secret as health endpoint for consistency)
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  if (!adminSecret) {
    console.error('[Bulk Update API] ADMIN_HEALTH_SECRET not configured');
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
 * Vercel Serverless Function Handler
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests',
      timestamp: new Date().toISOString()
    });
  }
  
  // Validate authorization
  const authHeader = req.headers['authorization'];
  const authResult = validateAuthorization(authHeader);
  
  if (!authResult.valid) {
    console.warn(`[Bulk Update API] Unauthorized request: ${authResult.error}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: authResult.error,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    console.log('[Bulk Update API] Starting bulk category update...');
    
    // Run the bulk update
    const result = await updateAllCategories();
    
    const responseTime = Date.now() - startTime;
    console.log(`[Bulk Update API] Bulk update completed in ${responseTime}ms`);
    
    // Return results
    return res.status(200).json({
      success: true,
      message: 'Bulk category update completed',
      result: {
        totalProcessed: result.updated + result.errors,
        updated: result.updated,
        errors: result.errors,
        errorDetails: result.details
      },
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[Bulk Update API] Error during bulk update: ${error.message}`);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to complete bulk category update',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing
export { validateAuthorization };
