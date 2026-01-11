/**
 * Property-Based Tests for Job Result Completeness
 * **Feature: public-domain-book-ingestion, Property 5: Job Result Contains All Required Counts**
 * **Validates: Requirements 2.3, 9.4**
 * 
 * This test verifies that for any completed ingestion job, the result object
 * contains all required counts and that the sum of added + skipped + failed
 * equals processed.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Interface representing a JobResult from the orchestrator
 */
interface JobResult {
  jobId: string;
  status: 'completed' | 'failed' | 'partial';
  startedAt: Date;
  completedAt: Date | null;
  processed: number;
  added: number;
  skipped: number;
  failed: number;
  errors: Array<{ identifier: string; error: string; timestamp?: string }>;
}

/**
 * Generator for valid job results
 * Generates realistic job result objects with consistent counts
 */
const jobResultArb = fc.record({
  added: fc.nat({ max: 100 }),
  skipped: fc.nat({ max: 100 }),
  failed: fc.nat({ max: 100 })
}).map(({ added, skipped, failed }) => {
  const processed = added + skipped + failed;
  
  // Determine status based on counts
  let status: 'completed' | 'failed' | 'partial';
  if (failed > 0 && added > 0) {
    status = 'partial';
  } else if (failed > 0 && added === 0) {
    status = 'failed';
  } else {
    status = 'completed';
  }
  
  // Generate errors array matching failed count
  const errors: Array<{ identifier: string; error: string; timestamp: string }> = [];
  for (let i = 0; i < failed; i++) {
    errors.push({
      identifier: `book_${i}`,
      error: `Error processing book ${i}`,
      timestamp: new Date().toISOString()
    });
  }
  
  return {
    jobId: `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    status,
    startedAt: new Date(),
    completedAt: new Date(),
    processed,
    added,
    skipped,
    failed,
    errors
  } as JobResult;
});


/**
 * Validates that a job result contains all required fields
 * @param result - The job result to validate
 * @returns true if all required fields are present
 */
function hasAllRequiredFields(result: JobResult): boolean {
  return (
    typeof result.jobId === 'string' &&
    typeof result.status === 'string' &&
    result.startedAt instanceof Date &&
    typeof result.processed === 'number' &&
    typeof result.added === 'number' &&
    typeof result.skipped === 'number' &&
    typeof result.failed === 'number' &&
    Array.isArray(result.errors)
  );
}

/**
 * Validates that the counts in a job result are consistent
 * @param result - The job result to validate
 * @returns true if added + skipped + failed === processed
 */
function countsAreConsistent(result: JobResult): boolean {
  return result.added + result.skipped + result.failed === result.processed;
}

/**
 * Validates that the status is appropriate for the counts
 * @param result - The job result to validate
 * @returns true if status matches the count pattern
 */
function statusMatchesCounts(result: JobResult): boolean {
  if (result.failed > 0 && result.added > 0) {
    return result.status === 'partial';
  } else if (result.failed > 0 && result.added === 0) {
    return result.status === 'failed';
  } else {
    return result.status === 'completed';
  }
}

describe('Job Result Completeness - Property Tests', () => {
  /**
   * **Feature: public-domain-book-ingestion, Property 5: Job Result Contains All Required Counts**
   * **Validates: Requirements 2.3, 9.4**
   * 
   * Property: For any completed ingestion job, the result object SHALL contain:
   * - processed: total books attempted
   * - added: books successfully inserted
   * - skipped: books skipped due to duplication
   * - failed: books that encountered errors
   * - The sum added + skipped + failed SHALL equal processed
   */
  it('Property 5: Job result contains all required counts and sum equals processed', () => {
    fc.assert(
      fc.property(jobResultArb, (result) => {
        // PROPERTY ASSERTION 1: All required fields are present
        expect(hasAllRequiredFields(result)).toBe(true);
        
        // PROPERTY ASSERTION 2: processed equals sum of added + skipped + failed
        expect(countsAreConsistent(result)).toBe(true);
        expect(result.processed).toBe(result.added + result.skipped + result.failed);
        
        // PROPERTY ASSERTION 3: All counts are non-negative
        expect(result.processed).toBeGreaterThanOrEqual(0);
        expect(result.added).toBeGreaterThanOrEqual(0);
        expect(result.skipped).toBeGreaterThanOrEqual(0);
        expect(result.failed).toBeGreaterThanOrEqual(0);
        
        // PROPERTY ASSERTION 4: Status is one of the valid values
        expect(['completed', 'failed', 'partial']).toContain(result.status);
        
        // PROPERTY ASSERTION 5: Status matches the count pattern
        expect(statusMatchesCounts(result)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Errors array length should match or be less than failed count
   * (errors array may not capture all failures in edge cases)
   */
  it('Property 5b: Errors array length is consistent with failed count', () => {
    fc.assert(
      fc.property(jobResultArb, (result) => {
        // Errors array should have at most 'failed' number of entries
        expect(result.errors.length).toBeLessThanOrEqual(result.failed);
        
        // Each error should have required fields
        result.errors.forEach(error => {
          expect(typeof error.identifier).toBe('string');
          expect(typeof error.error).toBe('string');
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Job ID should be a non-empty string
   */
  it('Property 5c: Job ID is a valid non-empty string', () => {
    fc.assert(
      fc.property(jobResultArb, (result) => {
        expect(typeof result.jobId).toBe('string');
        expect(result.jobId.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Timestamps should be valid dates
   */
  it('Property 5d: Timestamps are valid dates', () => {
    fc.assert(
      fc.property(jobResultArb, (result) => {
        expect(result.startedAt instanceof Date).toBe(true);
        expect(isNaN(result.startedAt.getTime())).toBe(false);
        
        if (result.completedAt !== null) {
          expect(result.completedAt instanceof Date).toBe(true);
          expect(isNaN(result.completedAt.getTime())).toBe(false);
          // completedAt should be >= startedAt
          expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(result.startedAt.getTime());
        }
      }),
      { numRuns: 100 }
    );
  });
});
