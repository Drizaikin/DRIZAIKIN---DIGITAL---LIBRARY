/**
 * Property-Based Tests for Authorization Enforcement
 * **Feature: admin-health-dashboard, Property 1: Authorization Enforcement**
 * **Validates: Requirements 1.2, 1.3, 1.4**
 * 
 * This test verifies that for any request to the Health_API without a valid
 * ADMIN_HEALTH_SECRET, the API SHALL return a 401 status code and not expose
 * any metrics data.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Import the validateAuthorization function from the API
// We test the validation logic directly since it's the core of authorization
import { validateAuthorization } from '../../api/admin/health/index.js';

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
   * **Feature: admin-health-dashboard, Property 1: Authorization Enforcement**
   * **Validates: Requirement 1.4**
   * 
   * Property: When ADMIN_HEALTH_SECRET is not configured, ALL requests SHALL be rejected
   */
  it('Property 1a: Rejects all requests when secret not configured', () => {
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
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 1.2**
   * 
   * Property: When authorization header is missing, request SHALL be rejected with 401
   */
  it('Property 1b: Rejects requests with missing authorization', () => {
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
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 1.3**
   * 
   * Property: When authorization header doesn't match ADMIN_HEALTH_SECRET, request SHALL be rejected
   */
  it('Property 1c: Rejects requests with invalid authorization', () => {
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
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.2, 1.3**
   * 
   * Property: Only the exact Bearer token format with correct secret is accepted
   */
  it('Property 1d: Accepts only valid Bearer token with correct secret', () => {
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
   * Property: Authorization is case-sensitive
   */
  it('Property 1e: Authorization is case-sensitive', () => {
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
   * Property: Bearer prefix is required
   */
  it('Property 1f: Bearer prefix is required', () => {
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
   * Property: Empty secret in environment should reject all requests
   */
  it('Property 1g: Empty secret rejects all requests', () => {
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
});
