/**
 * Property-Based Tests for Authorization Enforcement
 * **Feature: admin-book-management, Property 15: Authorization Enforcement**
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 * 
 * This test verifies that for any API request to book management endpoints,
 * requests without valid admin authentication SHALL receive a 401 Unauthorized
 * response, and no data modification SHALL occur.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Import the validateAuthorization function from the auth middleware
import { 
  validateAuthorization, 
  validateAdminSession,
  validateAdminRole,
  requireAdminAuth
} from '../../services/admin/authMiddleware.js';

// Store original env value
let originalAdminSecret: string | undefined;

describe('Authorization Enforcement - Property Tests', () => {
  beforeEach(() => {
    // Store original value
    originalAdminSecret = process.env.ADMIN_HEALTH_SECRET;
  });

  afterEach(() => {
    // Restore original value
    if (originalAdminSecret !== undefined) {
      process.env.ADMIN_HEALTH_SECRET = originalAdminSecret;
    } else {
      delete process.env.ADMIN_HEALTH_SECRET;
    }
  });

  /**
   * **Feature: admin-book-management, Property 15: Authorization Enforcement**
   * **Validates: Requirement 8.5**
   * 
   * Property: When ADMIN_HEALTH_SECRET is not configured, ALL requests SHALL be rejected
   */
  it('Property 15a: Rejects all requests when secret not configured', () => {
    fc.assert(
      fc.property(
        // Generate any possible authorization header value
        fc.oneof(
          fc.constant(undefined),
          fc.constant(''),
          fc.string(),
          fc.string().map(s => `Bearer ${s}`),
          fc.constant('Bearer valid-secret'),
          fc.constant('Basic dXNlcjpwYXNz')
        ),
        (authHeader) => {
          // Remove the secret from environment
          delete process.env.ADMIN_HEALTH_SECRET;
          
          const result = validateAuthorization(authHeader);
          
          // Should always reject when secret not configured
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Service not configured');
          expect(result.errorCode).toBe('SERVICE_NOT_CONFIGURED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 8.4**
   * 
   * Property: When authorization header is missing, request SHALL be rejected with 401
   */
  it('Property 15b: Rejects requests with missing authorization', () => {
    fc.assert(
      fc.property(
        // Generate random secrets for the environment
        fc.string({ minLength: 1, maxLength: 64 }),
        (secret) => {
          process.env.ADMIN_HEALTH_SECRET = secret;
          
          // Test with undefined authorization header
          const result = validateAuthorization(undefined);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Authorization required');
          expect(result.errorCode).toBe('AUTHORIZATION_REQUIRED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 8.3**
   * 
   * Property: When authorization header doesn't match ADMIN_HEALTH_SECRET, request SHALL be rejected
   */
  it('Property 15c: Rejects requests with invalid authorization', () => {
    fc.assert(
      fc.property(
        // Generate random secrets
        fc.string({ minLength: 1, maxLength: 64 }),
        // Generate invalid auth headers (non-empty, different from the secret)
        fc.oneof(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1 }).map(s => `Bearer ${s}`),
          fc.constant('Basic dXNlcjpwYXNz'),
          fc.constant('Bearer invalid-token'),
          fc.string({ minLength: 1 }).map(s => `Token ${s}`)
        ),
        (secret, invalidAuth) => {
          process.env.ADMIN_HEALTH_SECRET = secret;
          
          // Skip if by chance the invalid auth matches the valid one
          const validAuth = `Bearer ${secret}`;
          if (invalidAuth === validAuth) {
            return; // Skip this case
          }
          
          const result = validateAuthorization(invalidAuth);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Invalid authorization');
          expect(result.errorCode).toBe('INVALID_AUTHORIZATION');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.3, 8.5**
   * 
   * Property: Only the exact Bearer token format with correct secret is accepted
   */
  it('Property 15d: Accepts only valid Bearer token with correct secret', () => {
    fc.assert(
      fc.property(
        // Generate random secrets
        fc.string({ minLength: 1, maxLength: 64 }),
        (secret) => {
          process.env.ADMIN_HEALTH_SECRET = secret;
          
          // Valid authorization header
          const validAuth = `Bearer ${secret}`;
          const result = validateAuthorization(validAuth);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 8.3**
   * 
   * Property: Authorization is case-sensitive
   */
  it('Property 15e: Authorization is case-sensitive', () => {
    fc.assert(
      fc.property(
        // Generate secrets with mixed case
        fc.string({ minLength: 1, maxLength: 64 }).filter(s => s !== s.toLowerCase() && s !== s.toUpperCase()),
        (secret) => {
          process.env.ADMIN_HEALTH_SECRET = secret;
          
          // Test with different case variations
          const lowerAuth = `Bearer ${secret.toLowerCase()}`;
          const upperAuth = `Bearer ${secret.toUpperCase()}`;
          const validAuth = `Bearer ${secret}`;
          
          // Only exact match should be valid
          if (secret !== secret.toLowerCase()) {
            const lowerResult = validateAuthorization(lowerAuth);
            expect(lowerResult.valid).toBe(false);
          }
          
          if (secret !== secret.toUpperCase()) {
            const upperResult = validateAuthorization(upperAuth);
            expect(upperResult.valid).toBe(false);
          }
          
          const validResult = validateAuthorization(validAuth);
          expect(validResult.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 8.3**
   * 
   * Property: Bearer prefix is required
   */
  it('Property 15f: Bearer prefix is required', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }),
        (secret) => {
          process.env.ADMIN_HEALTH_SECRET = secret;
          
          // Test without Bearer prefix
          const withoutBearer = secret;
          const result = validateAuthorization(withoutBearer);
          
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 8.5**
   * 
   * Property: Empty secret in environment should reject all requests
   */
  it('Property 15g: Empty secret rejects all requests', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(''),
          fc.string(),
          fc.string().map(s => `Bearer ${s}`)
        ),
        (authHeader) => {
          process.env.ADMIN_HEALTH_SECRET = '';
          
          const result = validateAuthorization(authHeader);
          
          // Empty secret should be treated as not configured
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 8.1**
   * 
   * Property: Admin role validation rejects non-admin users
   */
  it('Property 15h: Admin role validation rejects non-admin users', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Reader', 'Premium', 'Guest', 'User', 'Moderator'),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (role, name, id) => {
          const user = { id, name, role };
          const result = validateAdminRole(user);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Admin role required');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 8.1**
   * 
   * Property: Admin role validation accepts admin users
   */
  it('Property 15i: Admin role validation accepts admin users', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.uuid(),
        (name, id) => {
          const user = { id, name, role: 'Admin' };
          const result = validateAdminRole(user);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 8.2**
   * 
   * Property: Admin role validation rejects null/undefined users
   */
  it('Property 15j: Admin role validation rejects null/undefined users', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined),
        (user) => {
          const result = validateAdminRole(user as any);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('No user session');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 8.5**
   * 
   * Property: Admin session extracts user info from headers
   */
  it('Property 15k: Admin session extracts user info from headers', () => {
    fc.assert(
      fc.property(
        fc.option(fc.uuid()),
        fc.option(fc.string({ minLength: 1, maxLength: 50 })),
        (userId, username) => {
          const req = {
            headers: {
              'x-admin-user-id': userId ?? undefined,
              'x-admin-username': username ?? undefined
            }
          };
          
          const result = validateAdminSession(req);
          
          expect(result.valid).toBe(true);
          expect(result.adminInfo.userId).toBe(userId ?? null);
          expect(result.adminInfo.username).toBe(username ?? null);
        }
      ),
      { numRuns: 100 }
    );
  });
});
