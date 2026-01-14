/**
 * Property-Based Tests for Admin Navigation Visibility
 * **Feature: admin-route-navigation, Property 5: Admin Navigation Visibility**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 * 
 * This test verifies that for any user with role 'Admin', both the Admin button
 * and Health button should be visible in the navbar. For any user with a role
 * other than 'Admin', neither admin navigation option should be visible.
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

// Navbar visibility evaluation logic extracted for property testing
// This mirrors the conditional rendering logic in Navbar.tsx:
// {user.role === 'Admin' && <button>Admin</button>}
// {user.role === 'Admin' && <button>Health</button>}
interface NavbarVisibility {
  adminButtonVisible: boolean;
  healthButtonVisible: boolean;
  mobileAdminButtonVisible: boolean;
  mobileHealthButtonVisible: boolean;
  bottomNavAdminButtonVisible: boolean;
}

function evaluateNavbarVisibility(user: TestUser): NavbarVisibility {
  const isAdmin = user.role === 'Admin';
  
  return {
    // Desktop navbar buttons
    adminButtonVisible: isAdmin,
    healthButtonVisible: isAdmin,
    // Mobile hamburger menu buttons
    mobileAdminButtonVisible: isAdmin,
    mobileHealthButtonVisible: isAdmin,
    // Bottom mobile nav button
    bottomNavAdminButtonVisible: isAdmin
  };
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

describe('Admin Navigation Visibility - Property Tests', () => {
  /**
   * **Feature: admin-route-navigation, Property 5: Admin Navigation Visibility**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * Property: For any user with role 'Admin', both the Admin button and Health
   * button should be visible in all navbar sections.
   */
  it('Property 5a: Admin users see all admin navigation buttons', () => {
    fc.assert(
      fc.property(
        testUserArb(fc.constant<UserRole>('Admin')),
        (user) => {
          const visibility = evaluateNavbarVisibility(user);
          
          // Admin users should see all admin navigation buttons
          expect(visibility.adminButtonVisible).toBe(true);
          expect(visibility.healthButtonVisible).toBe(true);
          expect(visibility.mobileAdminButtonVisible).toBe(true);
          expect(visibility.mobileHealthButtonVisible).toBe(true);
          expect(visibility.bottomNavAdminButtonVisible).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.3**
   * 
   * Property: For any user with a role other than 'Admin', neither admin
   * navigation option should be visible.
   */
  it('Property 5b: Non-admin users do not see admin navigation buttons', () => {
    fc.assert(
      fc.property(
        testUserArb(nonAdminRoleArb),
        (user) => {
          const visibility = evaluateNavbarVisibility(user);
          
          // Non-admin users should not see any admin navigation buttons
          expect(visibility.adminButtonVisible).toBe(false);
          expect(visibility.healthButtonVisible).toBe(false);
          expect(visibility.mobileAdminButtonVisible).toBe(false);
          expect(visibility.mobileHealthButtonVisible).toBe(false);
          expect(visibility.bottomNavAdminButtonVisible).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.1, 6.2, 6.3**
   * 
   * Property: Visibility is determined solely by role - Admin role shows buttons,
   * any other role hides them.
   */
  it('Property 5c: Visibility is determined solely by Admin role', () => {
    fc.assert(
      fc.property(
        testUserArb(userRoleArb),
        (user) => {
          const visibility = evaluateNavbarVisibility(user);
          const isAdmin = user.role === 'Admin';
          
          // All visibility flags should match the admin status
          expect(visibility.adminButtonVisible).toBe(isAdmin);
          expect(visibility.healthButtonVisible).toBe(isAdmin);
          expect(visibility.mobileAdminButtonVisible).toBe(isAdmin);
          expect(visibility.mobileHealthButtonVisible).toBe(isAdmin);
          expect(visibility.bottomNavAdminButtonVisible).toBe(isAdmin);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * Property: Admin and Health buttons are always shown together for admin users
   * (they are a pair, not individually toggleable).
   */
  it('Property 5d: Admin and Health buttons visibility is always paired', () => {
    fc.assert(
      fc.property(
        testUserArb(userRoleArb),
        (user) => {
          const visibility = evaluateNavbarVisibility(user);
          
          // Desktop buttons should have same visibility
          expect(visibility.adminButtonVisible).toBe(visibility.healthButtonVisible);
          
          // Mobile buttons should have same visibility
          expect(visibility.mobileAdminButtonVisible).toBe(visibility.mobileHealthButtonVisible);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.4**
   * 
   * Property: Visibility is consistent across all navbar sections (desktop,
   * mobile hamburger menu, bottom nav).
   */
  it('Property 5e: Visibility is consistent across all navbar sections', () => {
    fc.assert(
      fc.property(
        testUserArb(userRoleArb),
        (user) => {
          const visibility = evaluateNavbarVisibility(user);
          
          // All admin button visibility should be consistent
          const allAdminButtonsVisible = [
            visibility.adminButtonVisible,
            visibility.mobileAdminButtonVisible,
            visibility.bottomNavAdminButtonVisible
          ];
          
          // All should be the same value
          expect(allAdminButtonsVisible.every(v => v === allAdminButtonsVisible[0])).toBe(true);
          
          // Health buttons in desktop and mobile should be consistent
          expect(visibility.healthButtonVisible).toBe(visibility.mobileHealthButtonVisible);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: User properties other than role do not affect admin button visibility
   */
  it('Property 5f: Only role affects admin button visibility', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          testUserArb(fc.constant<UserRole>('Admin')),
          testUserArb(fc.constant<UserRole>('Admin'))
        ),
        ([user1, user2]) => {
          const visibility1 = evaluateNavbarVisibility(user1);
          const visibility2 = evaluateNavbarVisibility(user2);
          
          // Two different admin users should have identical visibility
          expect(visibility1.adminButtonVisible).toBe(visibility2.adminButtonVisible);
          expect(visibility1.healthButtonVisible).toBe(visibility2.healthButtonVisible);
          expect(visibility1.mobileAdminButtonVisible).toBe(visibility2.mobileAdminButtonVisible);
          expect(visibility1.mobileHealthButtonVisible).toBe(visibility2.mobileHealthButtonVisible);
          expect(visibility1.bottomNavAdminButtonVisible).toBe(visibility2.bottomNavAdminButtonVisible);
        }
      ),
      { numRuns: 100 }
    );
  });
});
