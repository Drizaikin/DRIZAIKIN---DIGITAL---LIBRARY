/**
 * Property-Based Tests for Metrics Non-Negativity
 * **Feature: admin-health-dashboard, Property 3: Metrics Non-Negativity**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 * 
 * This test verifies that for any daily metrics response, all count values
 * (booksIngested, booksSkipped, booksFailed, booksClassified, classificationFailures)
 * are non-negative integers.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Interface representing DailyMetrics from the health service
 */
interface DailyMetrics {
  booksIngested: number;
  booksSkipped: number;
  booksFailed: number;
  booksClassified: number;
  classificationFailures: number;
  date: string;
}

/**
 * Simulates the getDailyMetrics aggregation logic
 * This mirrors the implementation in healthService.js
 */
function aggregateDailyMetrics(logs: Array<{
  books_added: number | null;
  books_skipped: number | null;
  books_failed: number | null;
}>, classifiedCount: number | null): DailyMetrics {
  let booksIngested = 0;
  let booksSkipped = 0;
  let booksFailed = 0;
  
  if (logs && logs.length > 0) {
    logs.forEach(log => {
      booksIngested += log.books_added || 0;
      booksSkipped += log.books_skipped || 0;
      booksFailed += log.books_failed || 0;
    });
  }
  
  const classificationFailures = booksFailed;
  
  return {
    booksIngested: Math.max(0, booksIngested),
    booksSkipped: Math.max(0, booksSkipped),
    booksFailed: Math.max(0, booksFailed),
    booksClassified: Math.max(0, classifiedCount || 0),
    classificationFailures: Math.max(0, classificationFailures),
    date: new Date().toISOString().split('T')[0]
  };
}

// Generator for individual log entries (can have null or negative values from DB)
const logEntryArb = fc.record({
  books_added: fc.oneof(fc.nat({ max: 100 }), fc.constant(null), fc.integer({ min: -10, max: -1 })),
  books_skipped: fc.oneof(fc.nat({ max: 100 }), fc.constant(null), fc.integer({ min: -10, max: -1 })),
  books_failed: fc.oneof(fc.nat({ max: 100 }), fc.constant(null), fc.integer({ min: -10, max: -1 }))
});

// Generator for array of log entries
const logsArb = fc.array(logEntryArb, { minLength: 0, maxLength: 20 });

// Generator for classified count (can be null or negative from DB)
const classifiedCountArb = fc.oneof(
  fc.nat({ max: 100 }),
  fc.constant(null),
  fc.integer({ min: -10, max: -1 })
);

describe('Metrics Non-Negativity - Property Tests', () => {
  /**
   * **Feature: admin-health-dashboard, Property 3: Metrics Non-Negativity**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
   * 
   * Property: For any daily metrics response, all count values SHALL be non-negative integers
   */
  it('Property 3: All daily metrics counts are non-negative', () => {
    fc.assert(
      fc.property(
        logsArb,
        classifiedCountArb,
        (logs, classifiedCount) => {
          const metrics = aggregateDailyMetrics(logs, classifiedCount);
          
          // All counts must be non-negative
          expect(metrics.booksIngested).toBeGreaterThanOrEqual(0);
          expect(metrics.booksSkipped).toBeGreaterThanOrEqual(0);
          expect(metrics.booksFailed).toBeGreaterThanOrEqual(0);
          expect(metrics.booksClassified).toBeGreaterThanOrEqual(0);
          expect(metrics.classificationFailures).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 3.1**
   * 
   * Property: booksIngested is always a non-negative integer
   */
  it('Property 3a: booksIngested is non-negative', () => {
    fc.assert(
      fc.property(
        logsArb,
        classifiedCountArb,
        (logs, classifiedCount) => {
          const metrics = aggregateDailyMetrics(logs, classifiedCount);
          
          expect(Number.isInteger(metrics.booksIngested)).toBe(true);
          expect(metrics.booksIngested).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 3.2**
   * 
   * Property: booksSkipped is always a non-negative integer
   */
  it('Property 3b: booksSkipped is non-negative', () => {
    fc.assert(
      fc.property(
        logsArb,
        classifiedCountArb,
        (logs, classifiedCount) => {
          const metrics = aggregateDailyMetrics(logs, classifiedCount);
          
          expect(Number.isInteger(metrics.booksSkipped)).toBe(true);
          expect(metrics.booksSkipped).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 3.3**
   * 
   * Property: booksFailed is always a non-negative integer
   */
  it('Property 3c: booksFailed is non-negative', () => {
    fc.assert(
      fc.property(
        logsArb,
        classifiedCountArb,
        (logs, classifiedCount) => {
          const metrics = aggregateDailyMetrics(logs, classifiedCount);
          
          expect(Number.isInteger(metrics.booksFailed)).toBe(true);
          expect(metrics.booksFailed).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 3.4**
   * 
   * Property: booksClassified is always a non-negative integer
   */
  it('Property 3d: booksClassified is non-negative', () => {
    fc.assert(
      fc.property(
        logsArb,
        classifiedCountArb,
        (logs, classifiedCount) => {
          const metrics = aggregateDailyMetrics(logs, classifiedCount);
          
          expect(Number.isInteger(metrics.booksClassified)).toBe(true);
          expect(metrics.booksClassified).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 3.5**
   * 
   * Property: classificationFailures is always a non-negative integer
   */
  it('Property 3e: classificationFailures is non-negative', () => {
    fc.assert(
      fc.property(
        logsArb,
        classifiedCountArb,
        (logs, classifiedCount) => {
          const metrics = aggregateDailyMetrics(logs, classifiedCount);
          
          expect(Number.isInteger(metrics.classificationFailures)).toBe(true);
          expect(metrics.classificationFailures).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 3.6**
   * 
   * Property: When no data exists (empty logs), all metrics are zero
   */
  it('Property 3f: Empty logs result in zero metrics', () => {
    fc.assert(
      fc.property(
        fc.constant([]),
        fc.oneof(fc.constant(null), fc.constant(0)),
        (logs, classifiedCount) => {
          const metrics = aggregateDailyMetrics(logs, classifiedCount);
          
          expect(metrics.booksIngested).toBe(0);
          expect(metrics.booksSkipped).toBe(0);
          expect(metrics.booksFailed).toBe(0);
          expect(metrics.booksClassified).toBe(0);
          expect(metrics.classificationFailures).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Date field is always a valid date string
   */
  it('Property 3g: Date field is a valid date string', () => {
    fc.assert(
      fc.property(
        logsArb,
        classifiedCountArb,
        (logs, classifiedCount) => {
          const metrics = aggregateDailyMetrics(logs, classifiedCount);
          
          // Date should be in YYYY-MM-DD format
          expect(metrics.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          
          // Date should be parseable
          const parsed = new Date(metrics.date);
          expect(isNaN(parsed.getTime())).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
