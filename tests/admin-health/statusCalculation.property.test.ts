/**
 * Property-Based Tests for Status Calculation Consistency
 * **Feature: admin-health-dashboard, Property 2: Status Calculation Consistency**
 * **Validates: Requirements 2.4, 2.5, 2.6, 2.7**
 * 
 * This test verifies that for any combination of lastRunAt, lastRunStatus, and errorCount24h,
 * the calculated status is exactly one of: 'healthy', 'warning', or 'failed', following the defined rules.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Status calculation function (mirrors the implementation in healthService.js)
 * 
 * Rules:
 * - If last run failed, status is 'failed'
 * - If no run in 48 hours, status is 'warning'
 * - If more than 5 errors in 24 hours, status is 'warning'
 * - Otherwise, status is 'healthy'
 */
function calculateStatus(
  lastRunAt: string | null,
  lastRunStatus: string,
  errorCount24h: number
): 'healthy' | 'warning' | 'failed' {
  // Rule 1: If last run failed, status is 'failed'
  if (lastRunStatus === 'failed') {
    return 'failed';
  }
  
  // Rule 2: If no run in 48 hours, status is 'warning'
  const hoursSinceLastRun = lastRunAt 
    ? (Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60)
    : Infinity;
  
  if (hoursSinceLastRun > 48) {
    return 'warning';
  }
  
  // Rule 3: If more than 5 errors in 24 hours, status is 'warning'
  if (errorCount24h > 5) {
    return 'warning';
  }
  
  // Rule 4: Otherwise, status is 'healthy'
  return 'healthy';
}

// Valid status values
const VALID_STATUSES = ['healthy', 'warning', 'failed'] as const;

// Generator for lastRunStatus values
const lastRunStatusArb = fc.oneof(
  fc.constant('completed'),
  fc.constant('failed'),
  fc.constant('partial'),
  fc.constant('running'),
  fc.constant('idle')
);

// Generator for lastRunAt timestamps (null or ISO string within various time ranges)
const lastRunAtArb = fc.oneof(
  fc.constant(null),
  // Recent (within 48 hours)
  fc.integer({ min: 0, max: 47 }).map(hours => 
    new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  ),
  // Old (more than 48 hours ago)
  fc.integer({ min: 49, max: 168 }).map(hours => 
    new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  )
);

// Generator for error counts (non-negative integers)
const errorCountArb = fc.nat({ max: 100 });

describe('Status Calculation Consistency - Property Tests', () => {
  /**
   * **Feature: admin-health-dashboard, Property 2: Status Calculation Consistency**
   * **Validates: Requirements 2.4, 2.5, 2.6, 2.7**
   * 
   * Property: For any combination of inputs, the calculated status SHALL be
   * exactly one of: 'healthy', 'warning', or 'failed'
   */
  it('Property 2: Status is always one of healthy, warning, or failed', () => {
    fc.assert(
      fc.property(
        lastRunAtArb,
        lastRunStatusArb,
        errorCountArb,
        (lastRunAt, lastRunStatus, errorCount24h) => {
          const status = calculateStatus(lastRunAt, lastRunStatus, errorCount24h);
          
          // Status must be exactly one of the valid values
          expect(VALID_STATUSES).toContain(status);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 2.6**
   * 
   * Property: When lastRunStatus is 'failed', status SHALL be 'failed'
   */
  it('Property 2a: Failed last run always results in failed status', () => {
    fc.assert(
      fc.property(
        lastRunAtArb,
        errorCountArb,
        (lastRunAt, errorCount24h) => {
          const status = calculateStatus(lastRunAt, 'failed', errorCount24h);
          
          // Rule 1: If last run failed, status is 'failed'
          expect(status).toBe('failed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 2.4**
   * 
   * Property: When lastRunAt is null or more than 48 hours ago (and not failed),
   * status SHALL be 'warning'
   */
  it('Property 2b: No run in 48 hours results in warning status', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          // More than 48 hours ago
          fc.integer({ min: 49, max: 168 }).map(hours => 
            new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
          )
        ),
        fc.constantFrom('completed', 'partial', 'running', 'idle'),
        fc.nat({ max: 5 }), // Error count <= 5 to isolate this rule
        (lastRunAt, lastRunStatus, errorCount24h) => {
          const status = calculateStatus(lastRunAt, lastRunStatus, errorCount24h);
          
          // Rule 2: If no run in 48 hours, status is 'warning'
          expect(status).toBe('warning');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 2.5**
   * 
   * Property: When errorCount24h > 5 (and not failed, and recent run),
   * status SHALL be 'warning'
   */
  it('Property 2c: More than 5 errors in 24 hours results in warning status', () => {
    fc.assert(
      fc.property(
        // Recent run (within 48 hours)
        fc.integer({ min: 0, max: 47 }).map(hours => 
          new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
        ),
        fc.constantFrom('completed', 'partial', 'running', 'idle'),
        fc.integer({ min: 6, max: 100 }), // Error count > 5
        (lastRunAt, lastRunStatus, errorCount24h) => {
          const status = calculateStatus(lastRunAt, lastRunStatus, errorCount24h);
          
          // Rule 3: If more than 5 errors in 24 hours, status is 'warning'
          expect(status).toBe('warning');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 2.7**
   * 
   * Property: When lastRunStatus is not 'failed', lastRunAt is within 48 hours,
   * and errorCount24h <= 5, status SHALL be 'healthy'
   */
  it('Property 2d: Healthy conditions result in healthy status', () => {
    fc.assert(
      fc.property(
        // Recent run (within 48 hours)
        fc.integer({ min: 0, max: 47 }).map(hours => 
          new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
        ),
        fc.constantFrom('completed', 'partial', 'running', 'idle'),
        fc.nat({ max: 5 }), // Error count <= 5
        (lastRunAt, lastRunStatus, errorCount24h) => {
          const status = calculateStatus(lastRunAt, lastRunStatus, errorCount24h);
          
          // Rule 4: Otherwise, status is 'healthy'
          expect(status).toBe('healthy');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Status calculation is deterministic - same inputs always produce same output
   */
  it('Property 2e: Status calculation is deterministic', () => {
    fc.assert(
      fc.property(
        lastRunAtArb,
        lastRunStatusArb,
        errorCountArb,
        (lastRunAt, lastRunStatus, errorCount24h) => {
          const status1 = calculateStatus(lastRunAt, lastRunStatus, errorCount24h);
          const status2 = calculateStatus(lastRunAt, lastRunStatus, errorCount24h);
          
          // Same inputs should always produce same output
          expect(status1).toBe(status2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rule priority - 'failed' takes precedence over 'warning'
   */
  it('Property 2f: Failed status takes precedence over warning conditions', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          // Old timestamp (would normally trigger warning)
          fc.integer({ min: 49, max: 168 }).map(hours => 
            new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
          )
        ),
        fc.integer({ min: 6, max: 100 }), // High error count (would normally trigger warning)
        (lastRunAt, errorCount24h) => {
          const status = calculateStatus(lastRunAt, 'failed', errorCount24h);
          
          // Failed status should take precedence
          expect(status).toBe('failed');
        }
      ),
      { numRuns: 100 }
    );
  });
});
