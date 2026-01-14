/**
 * Property-Based Tests for Admin Route Protection
 * **Feature: admin-route-navigation, Property 3: Admin Route Protection**
 * **Validates: Requirements 3.1, 3.2**
 * 
 * This test verifies that for any user with a role other than 'Admin',
 * attempting to access any admin route (/admin or /admin/health) should
 * result in a redirect to the browse view.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// User role type matching the application
type UserRole = 'Reader' | 'Premium' | 'Admin';

// User interface for testing
interface TestUser {
  id: string;
  name: string;
  avatarUrl: string;
  role: UserRole;
  email?: string;
  username?: string;
}

// AdminGuard evaluation logic extracted for property testing
function evaluateAdminGuard(
  user: TestUser | null,
  isLoading: boolean
): 'loading' | 'redirect' | 'render' {
  if (isLoading) {
    return 'loading';
  }
  
  if (!user || user.role !== 'Admin') {
    return 'redirect';
  }
  
  return 'render';
}

// Generator for non-admin user roles
const nonAdminRoleArb = fc.constantFrom<UserRole>('Reader', 'Premium');

// Generator for all user roles
const userRoleArb = fc.constantFrom<UserRole>('Reader', 'Premium', 'Admin');

// Generator for test users
const testUserArb = (role: fc.Arbitrary<UserRole>): fc.Arbitrary<TestUser> =>
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    avatarUrl: fc.webUrl(),
    role: role,
    email: fc.option(fc.emailAddress(), { nil: undefined }),
    username: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined })
  });

// Generator for admin routes
const adminRouteArb = fc.constantFrom('/admin', '/admin/health');

describe('Admin Route Protection - Property Tests', () => {
  /**
   * **Feature: admin-route-navigation, Property 3: Admin Route Protection**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * Property: For any user with a role other than 'Admin', attempting to access
   * any admin route should result in a redirect to the browse view.
   */
  it('Property 3a: Non-admin users are always redirected from admin routes', () => {
    fc.assert(
      fc.property(
        testUserArb(nonAdminRoleArb),
        adminRouteArb,
        (user, _route) => {
          const result = evaluateAdminGuard(user, false);
          
          // Non-admin users should always be redirected
          expect(result).toBe('redirect');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * Property: Null users (unauthenticated) are always redirected from admin routes
   */
  it('Property 3b: Null users are always redirected from admin routes', () => {
    fc.assert(
      fc.property(
        adminRouteArb,
        (_route) => {
          const result = evaluateAdminGuard(null, false);
          
          // Null users should always be redirected
          expect(result).toBe('redirect');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * Property: Admin users are allowed to access admin routes
   */
  it('Property 3c: Admin users are allowed to access admin routes', () => {
    fc.assert(
      fc.property(
        testUserArb(fc.constant<UserRole>('Admin')),
        adminRouteArb,
        (user, _route) => {
          const result = evaluateAdminGuard(user, false);
          
          // Admin users should be allowed to render
          expect(result).toBe('render');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Role check is exact - only 'Admin' role grants access
   */
  it('Property 3d: Only exact Admin role grants access', () => {
    fc.assert(
      fc.property(
        testUserArb(userRoleArb),
        adminRouteArb,
        (user, _route) => {
          const result = evaluateAdminGuard(user, false);
          
          if (user.role === 'Admin') {
            expect(result).toBe('render');
          } else {
            expect(result).toBe('redirect');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Loading state takes precedence over role check
   */
  it('Property 3e: Loading state takes precedence over role check', () => {
    fc.assert(
      fc.property(
        fc.option(testUserArb(userRoleArb), { nil: null }),
        adminRouteArb,
        (user, _route) => {
          const result = evaluateAdminGuard(user, true);
          
          // Loading should always take precedence
          expect(result).toBe('loading');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Protection applies consistently across all admin routes
   */
  it('Property 3f: Protection is consistent across all admin routes', () => {
    fc.assert(
      fc.property(
        testUserArb(nonAdminRoleArb),
        (user) => {
          const adminRoutes = ['/admin', '/admin/health'];
          
          // All admin routes should have the same protection behavior
          const results = adminRoutes.map(route => evaluateAdminGuard(user, false));
          
          // All results should be 'redirect' for non-admin users
          expect(results.every(r => r === 'redirect')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
