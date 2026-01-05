/**
 * Property-Based Tests for Job Limit Enforcement
 * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
 * **Validates: Requirements 2.3, 2.4, 2.5**
 * 
 * This test verifies that extraction jobs stop when limits are reached:
 * - Requirement 2.3: Stop when time limit is reached
 * - Requirement 2.4: Stop when book count limit is reached
 * - Requirement 2.5: Stop when either limit is reached first
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ExtractionJob,
  hasReachedTimeLimit,
  hasReachedBookLimit,
  shouldStopJob,
  DEFAULT_MAX_TIME_MINUTES,
  DEFAULT_MAX_BOOKS
} from '../../services/extractionService';

/**
 * Helper to create a mock ExtractionJob for testing limit enforcement
 */
function createMockJob(overrides: Partial<ExtractionJob> = {}): ExtractionJob {
  return {
    id: 'test-job-id',
    sourceUrl: 'https://example.com/books',
    status: 'running',
    maxTimeMinutes: DEFAULT_MAX_TIME_MINUTES,
    maxBooks: DEFAULT_MAX_BOOKS,
    booksExtracted: 0,
    booksQueued: 0,
    errorCount: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    createdBy: 'test-admin-id',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Helper to create a startedAt timestamp that represents elapsed minutes
 */
function createStartedAtForElapsedMinutes(elapsedMinutes: number): string {
  const now = Date.now();
  const startTime = now - (elapsedMinutes * 60 * 1000);
  return new Date(startTime).toISOString();
}

describe('Job Limit Enforcement - Property Tests', () => {
  /**
   * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
   * **Validates: Requirements 2.3**
   * 
   * Property: For any extraction job where elapsed time >= maxTimeMinutes,
   * hasReachedTimeLimit SHALL return true.
   */
  it('Property 1: Time limit is enforced when elapsed time >= maxTimeMinutes', () => {
    fc.assert(
      fc.property(
        // maxTimeMinutes: 1 to 120 minutes
        fc.integer({ min: 1, max: 120 }),
        // elapsedMinutes: at or beyond the limit (0 to 60 minutes beyond)
        fc.integer({ min: 0, max: 60 }),
        (maxTimeMinutes, extraMinutes) => {
          const elapsedMinutes = maxTimeMinutes + extraMinutes;
          
          const job = createMockJob({
            maxTimeMinutes,
            startedAt: createStartedAtForElapsedMinutes(elapsedMinutes)
          });
          
          // PROPERTY ASSERTION: When elapsed >= limit, time limit is reached
          expect(hasReachedTimeLimit(job)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
   * **Validates: Requirements 2.3**
   * 
   * Property: For any extraction job where elapsed time < maxTimeMinutes,
   * hasReachedTimeLimit SHALL return false.
   */
  it('Property 1: Time limit is not reached when elapsed time < maxTimeMinutes', () => {
    fc.assert(
      fc.property(
        // maxTimeMinutes: 2 to 120 minutes (min 2 to allow room for elapsed < max)
        fc.integer({ min: 2, max: 120 }),
        // fraction of time elapsed (0 to 0.99)
        fc.double({ min: 0, max: 0.99, noNaN: true }),
        (maxTimeMinutes, fraction) => {
          const elapsedMinutes = Math.floor(maxTimeMinutes * fraction);
          
          const job = createMockJob({
            maxTimeMinutes,
            startedAt: createStartedAtForElapsedMinutes(elapsedMinutes)
          });
          
          // PROPERTY ASSERTION: When elapsed < limit, time limit is NOT reached
          expect(hasReachedTimeLimit(job)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
   * **Validates: Requirements 2.4**
   * 
   * Property: For any extraction job where booksExtracted >= maxBooks,
   * hasReachedBookLimit SHALL return true.
   */
  it('Property 1: Book limit is enforced when booksExtracted >= maxBooks', () => {
    fc.assert(
      fc.property(
        // maxBooks: 1 to 500 books
        fc.integer({ min: 1, max: 500 }),
        // extraBooks: 0 to 100 books beyond the limit
        fc.integer({ min: 0, max: 100 }),
        (maxBooks, extraBooks) => {
          const booksExtracted = maxBooks + extraBooks;
          
          const job = createMockJob({
            maxBooks,
            booksExtracted
          });
          
          // PROPERTY ASSERTION: When extracted >= limit, book limit is reached
          expect(hasReachedBookLimit(job)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
   * **Validates: Requirements 2.4**
   * 
   * Property: For any extraction job where booksExtracted < maxBooks,
   * hasReachedBookLimit SHALL return false.
   */
  it('Property 1: Book limit is not reached when booksExtracted < maxBooks', () => {
    fc.assert(
      fc.property(
        // maxBooks: 2 to 500 books (min 2 to allow room for extracted < max)
        fc.integer({ min: 2, max: 500 }),
        // fraction of books extracted (0 to 0.99)
        fc.double({ min: 0, max: 0.99, noNaN: true }),
        (maxBooks, fraction) => {
          const booksExtracted = Math.floor(maxBooks * fraction);
          
          const job = createMockJob({
            maxBooks,
            booksExtracted
          });
          
          // PROPERTY ASSERTION: When extracted < limit, book limit is NOT reached
          expect(hasReachedBookLimit(job)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
   * **Validates: Requirements 2.5**
   * 
   * Property: For any extraction job, shouldStopJob SHALL return true
   * when EITHER the time limit OR book count limit is reached.
   */
  it('Property 1: Job stops when either limit is reached (time limit first)', () => {
    fc.assert(
      fc.property(
        // maxTimeMinutes: 1 to 60 minutes
        fc.integer({ min: 1, max: 60 }),
        // maxBooks: 10 to 500 books
        fc.integer({ min: 10, max: 500 }),
        // extraMinutes beyond time limit
        fc.integer({ min: 0, max: 30 }),
        (maxTimeMinutes, maxBooks, extraMinutes) => {
          // Time limit reached, but book limit NOT reached
          const elapsedMinutes = maxTimeMinutes + extraMinutes;
          const booksExtracted = Math.floor(maxBooks * 0.5); // Only 50% of books
          
          const job = createMockJob({
            maxTimeMinutes,
            maxBooks,
            booksExtracted,
            startedAt: createStartedAtForElapsedMinutes(elapsedMinutes)
          });
          
          // PROPERTY ASSERTION: Job should stop when time limit is reached
          expect(shouldStopJob(job)).toBe(true);
          expect(hasReachedTimeLimit(job)).toBe(true);
          expect(hasReachedBookLimit(job)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
   * **Validates: Requirements 2.5**
   * 
   * Property: For any extraction job, shouldStopJob SHALL return true
   * when EITHER the time limit OR book count limit is reached.
   */
  it('Property 1: Job stops when either limit is reached (book limit first)', () => {
    fc.assert(
      fc.property(
        // maxTimeMinutes: 30 to 120 minutes
        fc.integer({ min: 30, max: 120 }),
        // maxBooks: 1 to 100 books
        fc.integer({ min: 1, max: 100 }),
        // extraBooks beyond book limit
        fc.integer({ min: 0, max: 50 }),
        (maxTimeMinutes, maxBooks, extraBooks) => {
          // Book limit reached, but time limit NOT reached
          const elapsedMinutes = Math.floor(maxTimeMinutes * 0.5); // Only 50% of time
          const booksExtracted = maxBooks + extraBooks;
          
          const job = createMockJob({
            maxTimeMinutes,
            maxBooks,
            booksExtracted,
            startedAt: createStartedAtForElapsedMinutes(elapsedMinutes)
          });
          
          // PROPERTY ASSERTION: Job should stop when book limit is reached
          expect(shouldStopJob(job)).toBe(true);
          expect(hasReachedTimeLimit(job)).toBe(false);
          expect(hasReachedBookLimit(job)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
   * **Validates: Requirements 2.5**
   * 
   * Property: For any extraction job, shouldStopJob SHALL return true
   * when BOTH limits are reached simultaneously.
   */
  it('Property 1: Job stops when both limits are reached', () => {
    fc.assert(
      fc.property(
        // maxTimeMinutes: 1 to 60 minutes
        fc.integer({ min: 1, max: 60 }),
        // maxBooks: 1 to 100 books
        fc.integer({ min: 1, max: 100 }),
        // extra beyond both limits
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 50 }),
        (maxTimeMinutes, maxBooks, extraMinutes, extraBooks) => {
          // Both limits reached
          const elapsedMinutes = maxTimeMinutes + extraMinutes;
          const booksExtracted = maxBooks + extraBooks;
          
          const job = createMockJob({
            maxTimeMinutes,
            maxBooks,
            booksExtracted,
            startedAt: createStartedAtForElapsedMinutes(elapsedMinutes)
          });
          
          // PROPERTY ASSERTION: Job should stop when both limits are reached
          expect(shouldStopJob(job)).toBe(true);
          expect(hasReachedTimeLimit(job)).toBe(true);
          expect(hasReachedBookLimit(job)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
   * **Validates: Requirements 2.3, 2.4, 2.5**
   * 
   * Property: For any extraction job where NEITHER limit is reached,
   * shouldStopJob SHALL return false.
   */
  it('Property 1: Job continues when neither limit is reached', () => {
    fc.assert(
      fc.property(
        // maxTimeMinutes: 10 to 120 minutes
        fc.integer({ min: 10, max: 120 }),
        // maxBooks: 10 to 500 books
        fc.integer({ min: 10, max: 500 }),
        // fraction of time elapsed (0 to 0.9)
        fc.double({ min: 0, max: 0.9, noNaN: true }),
        // fraction of books extracted (0 to 0.9)
        fc.double({ min: 0, max: 0.9, noNaN: true }),
        (maxTimeMinutes, maxBooks, timeFraction, bookFraction) => {
          // Neither limit reached
          const elapsedMinutes = Math.floor(maxTimeMinutes * timeFraction);
          const booksExtracted = Math.floor(maxBooks * bookFraction);
          
          const job = createMockJob({
            maxTimeMinutes,
            maxBooks,
            booksExtracted,
            startedAt: createStartedAtForElapsedMinutes(elapsedMinutes)
          });
          
          // PROPERTY ASSERTION: Job should NOT stop when neither limit is reached
          expect(shouldStopJob(job)).toBe(false);
          expect(hasReachedTimeLimit(job)).toBe(false);
          expect(hasReachedBookLimit(job)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
   * **Validates: Requirements 2.3**
   * 
   * Property: For any extraction job without a startedAt timestamp,
   * hasReachedTimeLimit SHALL return false (job hasn't started).
   */
  it('Property 1: Time limit check returns false for jobs without startedAt', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120 }),
        (maxTimeMinutes) => {
          const job = createMockJob({
            maxTimeMinutes,
            startedAt: null
          });
          
          // PROPERTY ASSERTION: Jobs without startedAt cannot have reached time limit
          expect(hasReachedTimeLimit(job)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 1: Job Limit Enforcement**
   * **Validates: Requirements 2.3, 2.4, 2.5**
   * 
   * Property: The shouldStopJob function is equivalent to the logical OR
   * of hasReachedTimeLimit and hasReachedBookLimit.
   */
  it('Property 1: shouldStopJob equals (hasReachedTimeLimit OR hasReachedBookLimit)', () => {
    fc.assert(
      fc.property(
        // maxTimeMinutes: 1 to 120 minutes
        fc.integer({ min: 1, max: 120 }),
        // maxBooks: 1 to 500 books
        fc.integer({ min: 1, max: 500 }),
        // elapsedMinutes: 0 to 180 minutes
        fc.integer({ min: 0, max: 180 }),
        // booksExtracted: 0 to 600 books
        fc.integer({ min: 0, max: 600 }),
        // whether job has started
        fc.boolean(),
        (maxTimeMinutes, maxBooks, elapsedMinutes, booksExtracted, hasStarted) => {
          const job = createMockJob({
            maxTimeMinutes,
            maxBooks,
            booksExtracted,
            startedAt: hasStarted ? createStartedAtForElapsedMinutes(elapsedMinutes) : null
          });
          
          const timeReached = hasReachedTimeLimit(job);
          const bookReached = hasReachedBookLimit(job);
          const shouldStop = shouldStopJob(job);
          
          // PROPERTY ASSERTION: shouldStopJob === (timeReached || bookReached)
          expect(shouldStop).toBe(timeReached || bookReached);
        }
      ),
      { numRuns: 100 }
    );
  });
});
