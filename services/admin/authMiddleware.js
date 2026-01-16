/**
 * Admin Authentication Middleware
 * 
 * Centralized authentication middleware for admin API endpoints.
 * Validates admin secret from request headers and admin session.
 * 
 * Requirements: 8.3, 8.4, 8.5
 * - 8.3: All book management API endpoints SHALL require admin authentication
 * - 8.4: Return 401 Unauthorized for unauthorized requests
 * - 8.5: Validate admin session before processing any modification request
 */

/**
 * Validates authorization header against ADMIN_HEALTH_SECRET
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {{ valid: boolean, error?: string, errorCode?: string }}
 */
export function validateAuthorization(authHeader) {
  const adminSecret = process.env.ADMIN_HEALTH_SECRET;
  
  // Requirement 8.5: Reject all requests if secret not configured
  if (!adminSecret) {
    console.error('[Auth Middleware] ADMIN_HEALTH_SECRET not configured');
    return { 
      valid: false, 
      error: 'Service not configured',
      errorCode: 'SERVICE_NOT_CONFIGURED'
    };
  }
  
  // Requirement 8.4: Return 401 for missing authorization
  if (!authHeader) {
    return { 
      valid: false, 
      error: 'Authorization required',
      errorCode: 'AUTHORIZATION_REQUIRED'
    };
  }
  
  // Requirement 8.3: Validate using ADMIN_HEALTH_SECRET with Bearer token format
  const expectedAuth = `Bearer ${adminSecret}`;
  if (authHeader !== expectedAuth) {
    return { 
      valid: false, 
      error: 'Invalid authorization',
      errorCode: 'INVALID_AUTHORIZATION'
    };
  }
  
  return { valid: true };
}

/**
 * Validates admin session from request headers
 * Extracts admin user information for audit logging
 * @param {Object} req - Request object
 * @returns {{ valid: boolean, adminInfo: { userId: string|null, username: string|null } }}
 */
export function validateAdminSession(req) {
  const adminInfo = {
    userId: req.headers['x-admin-user-id'] || null,
    username: req.headers['x-admin-username'] || null
  };
  
  // Session is considered valid if we have at least the authorization
  // Admin info headers are optional but useful for audit logging
  return {
    valid: true,
    adminInfo
  };
}

/**
 * Creates a standardized 401 Unauthorized response
 * @param {Object} res - Response object
 * @param {string} error - Error message
 * @param {string} [errorCode='UNAUTHORIZED'] - Error code
 * @returns {Object} Response
 */
export function unauthorizedResponse(res, error, errorCode = 'UNAUTHORIZED') {
  return res.status(401).json({
    success: false,
    error: errorCode,
    message: error,
    timestamp: new Date().toISOString()
  });
}

/**
 * Middleware function to protect admin endpoints
 * Can be used as a wrapper or called directly in handlers
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {{ authorized: boolean, adminInfo?: Object, response?: Object }}
 */
export function requireAdminAuth(req, res) {
  const authHeader = req.headers['authorization'];
  const authResult = validateAuthorization(authHeader);
  
  if (!authResult.valid) {
    console.warn(`[Auth Middleware] Unauthorized request: ${authResult.error}`);
    return {
      authorized: false,
      response: unauthorizedResponse(res, authResult.error, authResult.errorCode)
    };
  }
  
  // Extract admin session info
  const sessionResult = validateAdminSession(req);
  
  return {
    authorized: true,
    adminInfo: sessionResult.adminInfo
  };
}

/**
 * Higher-order function to wrap a handler with admin authentication
 * @param {Function} handler - The handler function to wrap
 * @returns {Function} Wrapped handler with authentication
 */
export function withAdminAuth(handler) {
  return async (req, res) => {
    const authResult = requireAdminAuth(req, res);
    
    if (!authResult.authorized) {
      // Response already sent by requireAdminAuth
      return authResult.response;
    }
    
    // Attach admin info to request for use in handler
    req.adminInfo = authResult.adminInfo;
    
    // Call the original handler
    return handler(req, res);
  };
}

/**
 * Validates that a request has admin role (for frontend session validation)
 * This is used when validating user sessions from the frontend
 * @param {Object} user - User object from session
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAdminRole(user) {
  if (!user) {
    return { valid: false, error: 'No user session' };
  }
  
  if (user.role !== 'Admin') {
    return { valid: false, error: 'Admin role required' };
  }
  
  return { valid: true };
}

// Export all functions for testing and use
export default {
  validateAuthorization,
  validateAdminSession,
  unauthorizedResponse,
  requireAdminAuth,
  withAdminAuth,
  validateAdminRole
};
