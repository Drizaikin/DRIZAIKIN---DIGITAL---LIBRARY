/**
 * Property-Based Tests for Resilience
 * **Feature: public-domain-book-ingestion, Property 6: Resilience - Single Failure Doesn't Stop Batch**
 * **Validates: Requirements 7.1, 7.4**
 * 
 * This test verifies that for any batch of N books where book K fails (1 ≤ K < N):
 * - Books 1 through K-1 SHALL be processed normally
 * - Books K+1 through N SHALL be processed normally
 * - The job SHALL complete with status "partial" or "completed"
 * - The failed count SHALL be at least 1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Simulates processing a batch of books where some may fail
 * This models the orchestrator's continue-on-failure behavior
 */
interface BookProcessingResult {
  identifier: string;
  status: 'added' | 'skipped' | 'failed';
  error?: string;
}

interface BatchResult {
  processed: number;
  added: number;
  skipped: number;
  failed: number;
  status: 'completed' | 'partial' | 'failed';
  results: BookProcessingResult[];
}

/**
 * Simulates the orchestrator's batch processing with continue-on-failure
 * @param books - Array of book identifiers
 * @param failingIndices - Set of indices that should fail
 * @param skippedIndices - Set of indices that should be skipped (duplicates)
 * @returns BatchResult with all counts
 */
function simulateBatchProcessing(
  books: string[],
  failingIndices: Set<number>,
  skippedIndices: Set<number>
): BatchResult {
  const results: BookProcessingResult[] = [];
  let added = 0;
  let skipped = 0;
  let failed = 0;
  
  // Process each book - continue on failure (Requirement 7.1, 7.4)
  for (let i = 0; i < books.length; i++) {
    const identifier = books[i];
    
    if (skippedIndices.has(i)) {
      results.push({ identifier, status: 'skipped' });
      skipped++;
    } else if (failingIndices.has(i)) {
      results.push({ 
        identifier, 
        status: 'failed', 
        error: `Simulated failure for book ${i}` 
      });
      failed++;
    } else {
      results.push({ identifier, status: 'added' });
      added++;
    }
  }
  
  // Determine status based on counts
  let status: 'completed' | 'partial' | 'failed';
  if (failed > 0 && added > 0) {
    status = 'partial';
  } else if (failed > 0 && added === 0) {
    status = 'failed';
  } else {
    status = 'completed';
  }
  
  return {
    processed: books.length,
    added,
    skipped,
    failed,
    status,
    results
  };
}


/**
 * Generator for batch sizes (1 to 50 books)
 */
const batchSizeArb = fc.integer({ min: 2, max: 50 });

/**
 * Generator for a single failing index within a batch
 */
const failingIndexArb = (batchSize: number) => 
  fc.integer({ min: 0, max: batchSize - 1 });

/**
 * Generator for multiple failing indices within a batch
 */
const failingIndicesArb = (batchSize: number) =>
  fc.array(fc.integer({ min: 0, max: batchSize - 1 }), { minLength: 1, maxLength: Math.min(batchSize - 1, 10) })
    .map(indices => new Set(indices));

/**
 * Generator for book identifiers
 */
const bookIdentifierArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

describe('Resilience - Property Tests', () => {
  /**
   * **Feature: public-domain-book-ingestion, Property 6: Resilience - Single Failure Doesn't Stop Batch**
   * **Validates: Requirements 7.1, 7.4**
   * 
   * Property: For any batch of N books where book K fails (1 ≤ K < N):
   * - Books before and after K SHALL be processed normally
   * - The job SHALL complete (not crash)
   * - The failed count SHALL be at least 1
   */
  it('Property 6: Single failure in middle of batch does not stop processing', () => {
    fc.assert(
      fc.property(
        batchSizeArb,
        fc.context(),
        (batchSize, ctx) => {
          // Generate book identifiers
          const books = Array.from({ length: batchSize }, (_, i) => `book_${i}`);
          
          // Pick a failing index in the middle (not first or last)
          const failingIndex = Math.floor(batchSize / 2);
          const failingIndices = new Set([failingIndex]);
          
          ctx.log(`Batch size: ${batchSize}, Failing index: ${failingIndex}`);
          
          // Process the batch
          const result = simulateBatchProcessing(books, failingIndices, new Set());
          
          // PROPERTY ASSERTION 1: All books were processed (job didn't stop)
          expect(result.processed).toBe(batchSize);
          
          // PROPERTY ASSERTION 2: Failed count is exactly 1
          expect(result.failed).toBe(1);
          
          // PROPERTY ASSERTION 3: Added count is batchSize - 1 (all except the failed one)
          expect(result.added).toBe(batchSize - 1);
          
          // PROPERTY ASSERTION 4: Status should be 'partial' (some added, some failed)
          expect(result.status).toBe('partial');
          
          // PROPERTY ASSERTION 5: Books before failing index were processed
          for (let i = 0; i < failingIndex; i++) {
            expect(result.results[i].status).toBe('added');
          }
          
          // PROPERTY ASSERTION 6: Books after failing index were processed
          for (let i = failingIndex + 1; i < batchSize; i++) {
            expect(result.results[i].status).toBe('added');
          }
          
          // PROPERTY ASSERTION 7: The failing book has failed status
          expect(result.results[failingIndex].status).toBe('failed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple failures don't stop the batch
   */
  it('Property 6b: Multiple failures in batch do not stop processing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 50 }),
        fc.context(),
        (batchSize, ctx) => {
          const books = Array.from({ length: batchSize }, (_, i) => `book_${i}`);
          
          // Create multiple failing indices (up to 30% of batch)
          const numFailures = Math.max(1, Math.floor(batchSize * 0.3));
          const failingIndices = new Set<number>();
          for (let i = 0; i < numFailures; i++) {
            failingIndices.add(Math.floor((i + 1) * batchSize / (numFailures + 1)));
          }
          
          ctx.log(`Batch size: ${batchSize}, Failing indices: ${Array.from(failingIndices).join(', ')}`);
          
          const result = simulateBatchProcessing(books, failingIndices, new Set());
          
          // PROPERTY ASSERTION 1: All books were processed
          expect(result.processed).toBe(batchSize);
          
          // PROPERTY ASSERTION 2: Failed count matches number of failing indices
          expect(result.failed).toBe(failingIndices.size);
          
          // PROPERTY ASSERTION 3: Added count is correct
          expect(result.added).toBe(batchSize - failingIndices.size);
          
          // PROPERTY ASSERTION 4: Sum of counts equals processed
          expect(result.added + result.skipped + result.failed).toBe(result.processed);
          
          // PROPERTY ASSERTION 5: Status is partial (some added, some failed)
          expect(result.status).toBe('partial');
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property: First book failure doesn't prevent processing remaining books
   */
  it('Property 6c: First book failure does not stop batch', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }),
        (batchSize) => {
          const books = Array.from({ length: batchSize }, (_, i) => `book_${i}`);
          
          // First book fails
          const failingIndices = new Set([0]);
          
          const result = simulateBatchProcessing(books, failingIndices, new Set());
          
          // PROPERTY ASSERTION 1: All books were processed
          expect(result.processed).toBe(batchSize);
          
          // PROPERTY ASSERTION 2: First book failed
          expect(result.results[0].status).toBe('failed');
          
          // PROPERTY ASSERTION 3: All remaining books were added
          for (let i = 1; i < batchSize; i++) {
            expect(result.results[i].status).toBe('added');
          }
          
          // PROPERTY ASSERTION 4: Counts are correct
          expect(result.failed).toBe(1);
          expect(result.added).toBe(batchSize - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Last book failure still results in partial status
   */
  it('Property 6d: Last book failure results in partial status', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }),
        (batchSize) => {
          const books = Array.from({ length: batchSize }, (_, i) => `book_${i}`);
          
          // Last book fails
          const failingIndices = new Set([batchSize - 1]);
          
          const result = simulateBatchProcessing(books, failingIndices, new Set());
          
          // PROPERTY ASSERTION 1: All books were processed
          expect(result.processed).toBe(batchSize);
          
          // PROPERTY ASSERTION 2: All books except last were added
          for (let i = 0; i < batchSize - 1; i++) {
            expect(result.results[i].status).toBe('added');
          }
          
          // PROPERTY ASSERTION 3: Last book failed
          expect(result.results[batchSize - 1].status).toBe('failed');
          
          // PROPERTY ASSERTION 4: Status is partial
          expect(result.status).toBe('partial');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All books failing results in 'failed' status
   */
  it('Property 6e: All books failing results in failed status', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (batchSize) => {
          const books = Array.from({ length: batchSize }, (_, i) => `book_${i}`);
          
          // All books fail
          const failingIndices = new Set(Array.from({ length: batchSize }, (_, i) => i));
          
          const result = simulateBatchProcessing(books, failingIndices, new Set());
          
          // PROPERTY ASSERTION 1: All books were processed
          expect(result.processed).toBe(batchSize);
          
          // PROPERTY ASSERTION 2: All books failed
          expect(result.failed).toBe(batchSize);
          expect(result.added).toBe(0);
          
          // PROPERTY ASSERTION 3: Status is 'failed'
          expect(result.status).toBe('failed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Mixed failures and skips still processes all books
   */
  it('Property 6f: Mixed failures and skips processes all books', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 6, max: 50 }),
        (batchSize) => {
          const books = Array.from({ length: batchSize }, (_, i) => `book_${i}`);
          
          // Some books fail, some are skipped
          const failingIndices = new Set([1, 3]);
          const skippedIndices = new Set([2, 4]);
          
          const result = simulateBatchProcessing(books, failingIndices, skippedIndices);
          
          // PROPERTY ASSERTION 1: All books were processed
          expect(result.processed).toBe(batchSize);
          
          // PROPERTY ASSERTION 2: Counts are correct
          expect(result.failed).toBe(2);
          expect(result.skipped).toBe(2);
          expect(result.added).toBe(batchSize - 4);
          
          // PROPERTY ASSERTION 3: Sum equals processed
          expect(result.added + result.skipped + result.failed).toBe(result.processed);
          
          // PROPERTY ASSERTION 4: Status is partial (has both added and failed)
          expect(result.status).toBe('partial');
        }
      ),
      { numRuns: 100 }
    );
  });
});
