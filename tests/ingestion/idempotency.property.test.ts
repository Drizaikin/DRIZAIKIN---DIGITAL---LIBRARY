/**
 * Property-Based Tests for Idempotency
 * **Feature: public-domain-book-ingestion, Property 3: Idempotency - Re-running Produces No Duplicates**
 * **Validates: Requirements 3.1, 3.2, 3.4**
 * 
 * This test verifies that for any set of books, running the ingestion job twice
 * with the same input SHALL result in:
 * - The same number of books in the database after both runs
 * - No duplicate source_identifier values
 * - The second run reporting all books as "skipped"
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Interface representing a book to be ingested
 */
interface BookMetadata {
  identifier: string;
  title: string;
  creator: string;
  date?: string;
  language?: string;
}

/**
 * Interface representing the database state
 */
interface DatabaseState {
  books: Map<string, BookMetadata>; // keyed by source_identifier
  bookCount: number;
}

/**
 * Interface representing the result of an ingestion run
 */
interface IngestionResult {
  processed: number;
  added: number;
  skipped: number;
  failed: number;
  status: 'completed' | 'partial' | 'failed';
}

/**
 * Simulates the deduplication check - checks if a book exists by source_identifier
 * @param identifier - The source_identifier to check
 * @param dbState - Current database state
 * @returns True if book exists
 */
function bookExists(identifier: string, dbState: DatabaseState): boolean {
  return dbState.books.has(identifier);
}

/**
 * Simulates inserting a book into the database
 * The unique constraint on source_identifier prevents duplicates
 * @param book - Book to insert
 * @param dbState - Current database state (mutated)
 * @returns Success status
 */
function insertBook(book: BookMetadata, dbState: DatabaseState): boolean {
  // Unique constraint check (Requirement 3.3)
  if (dbState.books.has(book.identifier)) {
    return false; // Would violate unique constraint
  }
  
  dbState.books.set(book.identifier, book);
  dbState.bookCount++;
  return true;
}

/**
 * Simulates a complete ingestion run with deduplication
 * Models the orchestrator's behavior with the deduplication engine
 * @param books - Books to ingest
 * @param dbState - Current database state (mutated)
 * @returns Ingestion result
 */
function simulateIngestionRun(
  books: BookMetadata[],
  dbState: DatabaseState
): IngestionResult {
  let added = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const book of books) {
    // Step 1: Check if book already exists (Requirement 3.1)
    if (bookExists(book.identifier, dbState)) {
      // Requirement 3.2: Skip and log
      skipped++;
      continue;
    }
    
    // Step 2: Try to insert the book
    const success = insertBook(book, dbState);
    if (success) {
      added++;
    } else {
      // This shouldn't happen if deduplication works correctly
      failed++;
    }
  }
  
  // Determine status
  let status: 'completed' | 'partial' | 'failed';
  if (failed > 0 && added > 0) {
    status = 'partial';
  } else if (failed > 0 && added === 0 && skipped === 0) {
    status = 'failed';
  } else {
    status = 'completed';
  }
  
  return {
    processed: books.length,
    added,
    skipped,
    failed,
    status
  };
}

/**
 * Creates a fresh database state
 */
function createEmptyDatabase(): DatabaseState {
  return {
    books: new Map(),
    bookCount: 0
  };
}

/**
 * Gets all unique source_identifiers from the database
 */
function getUniqueIdentifiers(dbState: DatabaseState): Set<string> {
  return new Set(dbState.books.keys());
}

/**
 * Generator for valid book identifiers (alphanumeric with hyphens/underscores)
 */
const bookIdentifierArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s) && s.length > 0);

/**
 * Generator for book metadata
 */
const bookMetadataArb = fc.record({
  identifier: bookIdentifierArb,
  title: fc.string({ minLength: 1, maxLength: 100 }),
  creator: fc.string({ minLength: 1, maxLength: 100 }),
  date: fc.option(fc.stringMatching(/^[0-9]{4}$/)),
  language: fc.option(fc.constantFrom('en', 'fr', 'de', 'es', 'it', 'la', 'gr'))
});

/**
 * Generator for a batch of books with unique identifiers
 */
const uniqueBookBatchArb = fc.array(bookMetadataArb, { minLength: 1, maxLength: 30 })
  .map(books => {
    // Ensure unique identifiers within the batch
    const seen = new Set<string>();
    return books.filter(book => {
      if (seen.has(book.identifier)) {
        return false;
      }
      seen.add(book.identifier);
      return true;
    });
  })
  .filter(books => books.length > 0);

describe('Idempotency - Property Tests', () => {
  /**
   * **Feature: public-domain-book-ingestion, Property 3: Idempotency - Re-running Produces No Duplicates**
   * **Validates: Requirements 3.1, 3.2, 3.4**
   * 
   * Property: Running the same ingestion twice results in the same database state
   */
  it('Property 3: Re-running ingestion produces no duplicates', () => {
    fc.assert(
      fc.property(
        uniqueBookBatchArb,
        (books) => {
          // Start with empty database
          const dbState = createEmptyDatabase();
          
          // First run - should add all books
          const firstRunResult = simulateIngestionRun(books, dbState);
          const countAfterFirstRun = dbState.bookCount;
          
          // Second run with same books - should skip all
          const secondRunResult = simulateIngestionRun(books, dbState);
          const countAfterSecondRun = dbState.bookCount;
          
          // PROPERTY ASSERTION 1: Database count unchanged after second run
          expect(countAfterSecondRun).toBe(countAfterFirstRun);
          
          // PROPERTY ASSERTION 2: First run added all books
          expect(firstRunResult.added).toBe(books.length);
          expect(firstRunResult.skipped).toBe(0);
          
          // PROPERTY ASSERTION 3: Second run skipped all books
          expect(secondRunResult.added).toBe(0);
          expect(secondRunResult.skipped).toBe(books.length);
          
          // PROPERTY ASSERTION 4: No duplicates in database
          const uniqueIds = getUniqueIdentifiers(dbState);
          expect(uniqueIds.size).toBe(dbState.bookCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple re-runs all produce the same result (skipped)
   */
  it('Property 3b: Multiple re-runs all skip all books', () => {
    fc.assert(
      fc.property(
        uniqueBookBatchArb,
        fc.integer({ min: 2, max: 5 }),
        (books, numReruns) => {
          const dbState = createEmptyDatabase();
          
          // First run
          const firstRunResult = simulateIngestionRun(books, dbState);
          const countAfterFirstRun = dbState.bookCount;
          
          // Multiple re-runs
          for (let i = 0; i < numReruns; i++) {
            const rerunResult = simulateIngestionRun(books, dbState);
            
            // PROPERTY ASSERTION: Each re-run skips all books
            expect(rerunResult.added).toBe(0);
            expect(rerunResult.skipped).toBe(books.length);
            expect(rerunResult.failed).toBe(0);
            
            // PROPERTY ASSERTION: Database count unchanged
            expect(dbState.bookCount).toBe(countAfterFirstRun);
          }
          
          // PROPERTY ASSERTION: Final count equals first run count
          expect(dbState.bookCount).toBe(firstRunResult.added);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Partial overlap between runs - only new books are added
   */
  it('Property 3c: Partial overlap adds only new books', () => {
    fc.assert(
      fc.property(
        uniqueBookBatchArb,
        uniqueBookBatchArb,
        (firstBatch, secondBatch) => {
          const dbState = createEmptyDatabase();
          
          // First run with first batch
          const firstRunResult = simulateIngestionRun(firstBatch, dbState);
          const countAfterFirstRun = dbState.bookCount;
          
          // Calculate expected results for second run
          const firstBatchIds = new Set(firstBatch.map(b => b.identifier));
          const newInSecondBatch = secondBatch.filter(b => !firstBatchIds.has(b.identifier));
          const overlappingInSecondBatch = secondBatch.filter(b => firstBatchIds.has(b.identifier));
          
          // Second run with second batch (may have overlap)
          const secondRunResult = simulateIngestionRun(secondBatch, dbState);
          
          // PROPERTY ASSERTION 1: Only new books were added
          expect(secondRunResult.added).toBe(newInSecondBatch.length);
          
          // PROPERTY ASSERTION 2: Overlapping books were skipped
          expect(secondRunResult.skipped).toBe(overlappingInSecondBatch.length);
          
          // PROPERTY ASSERTION 3: Total count is sum of unique books
          const allUniqueIds = new Set([
            ...firstBatch.map(b => b.identifier),
            ...secondBatch.map(b => b.identifier)
          ]);
          expect(dbState.bookCount).toBe(allUniqueIds.size);
          
          // PROPERTY ASSERTION 4: No duplicates
          expect(getUniqueIdentifiers(dbState).size).toBe(dbState.bookCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty batch is idempotent (no-op)
   */
  it('Property 3d: Empty batch is idempotent', () => {
    fc.assert(
      fc.property(
        uniqueBookBatchArb,
        (initialBooks) => {
          const dbState = createEmptyDatabase();
          
          // Populate with initial books
          simulateIngestionRun(initialBooks, dbState);
          const countAfterInitial = dbState.bookCount;
          
          // Run with empty batch
          const emptyResult = simulateIngestionRun([], dbState);
          
          // PROPERTY ASSERTION 1: No changes
          expect(emptyResult.processed).toBe(0);
          expect(emptyResult.added).toBe(0);
          expect(emptyResult.skipped).toBe(0);
          
          // PROPERTY ASSERTION 2: Database unchanged
          expect(dbState.bookCount).toBe(countAfterInitial);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Unique constraint prevents duplicates even without deduplication check
   */
  it('Property 3e: Unique constraint prevents duplicates at database level', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        (book) => {
          const dbState = createEmptyDatabase();
          
          // First insert succeeds
          const firstInsert = insertBook(book, dbState);
          expect(firstInsert).toBe(true);
          expect(dbState.bookCount).toBe(1);
          
          // Second insert with same identifier fails (unique constraint)
          const duplicateBook = { ...book, title: 'Different Title' };
          const secondInsert = insertBook(duplicateBook, dbState);
          expect(secondInsert).toBe(false);
          
          // PROPERTY ASSERTION: Count unchanged after failed insert
          expect(dbState.bookCount).toBe(1);
          
          // PROPERTY ASSERTION: Original book data preserved
          expect(dbState.books.get(book.identifier)?.title).toBe(book.title);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Order of books doesn't affect idempotency
   */
  it('Property 3f: Order of books does not affect idempotency', () => {
    fc.assert(
      fc.property(
        uniqueBookBatchArb,
        (books) => {
          // Create two databases
          const dbState1 = createEmptyDatabase();
          const dbState2 = createEmptyDatabase();
          
          // Run in original order
          const result1 = simulateIngestionRun(books, dbState1);
          
          // Run in reversed order
          const reversedBooks = [...books].reverse();
          const result2 = simulateIngestionRun(reversedBooks, dbState2);
          
          // PROPERTY ASSERTION 1: Same number of books added
          expect(result1.added).toBe(result2.added);
          
          // PROPERTY ASSERTION 2: Same final count
          expect(dbState1.bookCount).toBe(dbState2.bookCount);
          
          // PROPERTY ASSERTION 3: Same set of identifiers
          const ids1 = getUniqueIdentifiers(dbState1);
          const ids2 = getUniqueIdentifiers(dbState2);
          expect(ids1.size).toBe(ids2.size);
          ids1.forEach(id => expect(ids2.has(id)).toBe(true));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Idempotency holds regardless of batch size
   */
  it('Property 3g: Idempotency holds for any batch size', () => {
    fc.assert(
      fc.property(
        fc.array(bookMetadataArb, { minLength: 1, maxLength: 100 })
          .map(books => {
            const seen = new Set<string>();
            return books.filter(book => {
              if (seen.has(book.identifier)) return false;
              seen.add(book.identifier);
              return true;
            });
          })
          .filter(books => books.length > 0),
        (books) => {
          const dbState = createEmptyDatabase();
          
          // First run
          const firstRun = simulateIngestionRun(books, dbState);
          
          // Second run
          const secondRun = simulateIngestionRun(books, dbState);
          
          // PROPERTY ASSERTION 1: All books added in first run
          expect(firstRun.added).toBe(books.length);
          
          // PROPERTY ASSERTION 2: All books skipped in second run
          expect(secondRun.skipped).toBe(books.length);
          expect(secondRun.added).toBe(0);
          
          // PROPERTY ASSERTION 3: Database count equals unique book count
          expect(dbState.bookCount).toBe(books.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
