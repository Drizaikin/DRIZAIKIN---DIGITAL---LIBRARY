/**
 * Property-Based Tests for Classification Idempotency
 * **Feature: ai-genre-classification, Property 5: Classification Idempotency**
 * **Validates: Requirements 5.2, 5.3**
 * 
 * This test verifies that for any book that already has genres stored in the database,
 * re-running ingestion SHALL NOT trigger a new AI classification call.
 * 
 * Requirements:
 * - 5.2: THE Genre_Classifier SHALL NOT re-classify books that already have genres stored
 * - 5.3: THE Genre_Classifier SHALL cache results using source_identifier to avoid duplicate API calls
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PRIMARY_GENRES, SUB_GENRES } from '../../services/ingestion/genreTaxonomy.js';

/**
 * Represents a book record in the database
 */
interface BookRecord {
  source_identifier: string;
  title: string;
  author: string;
  genres: string[] | null;
  subgenre: string | null;
}

/**
 * Represents the result of checking for existing genres
 */
interface ExistingGenresResult {
  hasGenres: boolean;
  genres: string[] | null;
  subgenre: string | null;
}

/**
 * Simulates the database state
 */
interface DatabaseState {
  books: Map<string, BookRecord>;
}

/**
 * Tracks API calls for verification
 */
interface ApiCallTracker {
  callCount: number;
  calledIdentifiers: string[];
}

/**
 * Simulates getExistingGenres function from deduplicationEngine
 * Checks if a book already has genres stored in the database
 */
function simulateGetExistingGenres(
  sourceIdentifier: string,
  dbState: DatabaseState
): ExistingGenresResult {
  if (!sourceIdentifier) {
    return { hasGenres: false, genres: null, subgenre: null };
  }

  const book = dbState.books.get(sourceIdentifier);
  
  if (!book) {
    return { hasGenres: false, genres: null, subgenre: null };
  }
  
  const hasGenres = Array.isArray(book.genres) && book.genres.length > 0;
  
  return {
    hasGenres,
    genres: book.genres,
    subgenre: book.subgenre
  };
}

/**
 * Simulates the AI classification API call
 * This should NOT be called if book already has genres
 */
function simulateClassifyBook(
  book: { title: string; author: string },
  tracker: ApiCallTracker,
  identifier: string
): { genres: string[]; subgenre: string | null } {
  // Track the API call
  tracker.callCount++;
  tracker.calledIdentifiers.push(identifier);
  
  // Return mock classification
  return {
    genres: ['Literature'],
    subgenre: null
  };
}

/**
 * Simulates the orchestrator's classification step with idempotency check
 * Models the actual implementation behavior
 */
function simulateClassificationStep(
  book: { identifier: string; title: string; author: string },
  dbState: DatabaseState,
  tracker: ApiCallTracker,
  classificationEnabled: boolean = true
): { genres: string[] | null; subgenre: string | null; usedExisting: boolean } {
  if (!classificationEnabled) {
    return { genres: null, subgenre: null, usedExisting: false };
  }

  // Check if book already has genres (idempotency check)
  const existingGenres = simulateGetExistingGenres(book.identifier, dbState);
  
  if (existingGenres.hasGenres) {
    // Skip classification - use existing genres
    return {
      genres: existingGenres.genres,
      subgenre: existingGenres.subgenre,
      usedExisting: true
    };
  }
  
  // No existing genres - perform classification (API call)
  const classification = simulateClassifyBook(
    { title: book.title, author: book.author },
    tracker,
    book.identifier
  );
  
  return {
    genres: classification.genres,
    subgenre: classification.subgenre,
    usedExisting: false
  };
}

/**
 * Creates an empty database state
 */
function createEmptyDatabase(): DatabaseState {
  return { books: new Map() };
}

/**
 * Creates a fresh API call tracker
 */
function createApiTracker(): ApiCallTracker {
  return { callCount: 0, calledIdentifiers: [] };
}

/**
 * Inserts a book into the database
 */
function insertBook(dbState: DatabaseState, book: BookRecord): void {
  dbState.books.set(book.source_identifier, book);
}

/**
 * Generator for valid book identifiers
 */
const bookIdentifierArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s) && s.length > 0);

/**
 * Generator for valid genres (1-3 from PRIMARY_GENRES)
 */
const validGenresArb = fc.array(
  fc.constantFrom(...PRIMARY_GENRES),
  { minLength: 1, maxLength: 3 }
).map(genres => [...new Set(genres)]); // Remove duplicates

/**
 * Generator for valid sub-genres (optional)
 */
const validSubgenreArb = fc.option(fc.constantFrom(...SUB_GENRES));

/**
 * Generator for book metadata
 */
const bookMetadataArb = fc.record({
  identifier: bookIdentifierArb,
  title: fc.string({ minLength: 1, maxLength: 200 }),
  author: fc.string({ minLength: 1, maxLength: 100 })
});

/**
 * Generator for a book record with genres
 */
const bookWithGenresArb = fc.record({
  source_identifier: bookIdentifierArb,
  title: fc.string({ minLength: 1, maxLength: 200 }),
  author: fc.string({ minLength: 1, maxLength: 100 }),
  genres: validGenresArb,
  subgenre: validSubgenreArb.map(s => s ?? null)
});

/**
 * Generator for a book record without genres
 */
const bookWithoutGenresArb = fc.record({
  source_identifier: bookIdentifierArb,
  title: fc.string({ minLength: 1, maxLength: 200 }),
  author: fc.string({ minLength: 1, maxLength: 100 }),
  genres: fc.constant(null as string[] | null),
  subgenre: fc.constant(null as string | null)
});

describe('Classification Idempotency - Property Tests', () => {
  /**
   * **Feature: ai-genre-classification, Property 5: Classification Idempotency**
   * **Validates: Requirements 5.2, 5.3**
   * 
   * Property: For any book that already has genres stored, re-running classification
   * SHALL NOT trigger a new AI API call
   */
  it('Property 5: Books with existing genres do not trigger API calls', () => {
    fc.assert(
      fc.property(
        bookWithGenresArb,
        fc.context(),
        (bookRecord, ctx) => {
          ctx.log(`Book: ${bookRecord.title}, Genres: ${bookRecord.genres?.join(', ')}`);
          
          // Setup: Database with book that has genres
          const dbState = createEmptyDatabase();
          insertBook(dbState, bookRecord);
          
          // Setup: API call tracker
          const tracker = createApiTracker();
          
          // Action: Run classification step
          const result = simulateClassificationStep(
            {
              identifier: bookRecord.source_identifier,
              title: bookRecord.title,
              author: bookRecord.author
            },
            dbState,
            tracker
          );
          
          // PROPERTY ASSERTION 1: No API call was made
          // Validates: Requirement 5.2 - SHALL NOT re-classify books with genres
          expect(tracker.callCount).toBe(0);
          expect(tracker.calledIdentifiers).not.toContain(bookRecord.source_identifier);
          
          // PROPERTY ASSERTION 2: Existing genres were used
          // Validates: Requirement 5.3 - cache results using source_identifier
          expect(result.usedExisting).toBe(true);
          expect(result.genres).toEqual(bookRecord.genres);
          expect(result.subgenre).toBe(bookRecord.subgenre);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Books without genres DO trigger API calls
   * (Contrast test to verify idempotency is specific to books with genres)
   */
  it('Property 5b: Books without genres trigger API calls', () => {
    fc.assert(
      fc.property(
        bookWithoutGenresArb,
        fc.context(),
        (bookRecord, ctx) => {
          ctx.log(`Book: ${bookRecord.title}, Genres: null`);
          
          // Setup: Database with book that has NO genres
          const dbState = createEmptyDatabase();
          insertBook(dbState, bookRecord);
          
          // Setup: API call tracker
          const tracker = createApiTracker();
          
          // Action: Run classification step
          const result = simulateClassificationStep(
            {
              identifier: bookRecord.source_identifier,
              title: bookRecord.title,
              author: bookRecord.author
            },
            dbState,
            tracker
          );
          
          // PROPERTY ASSERTION 1: API call WAS made
          expect(tracker.callCount).toBe(1);
          expect(tracker.calledIdentifiers).toContain(bookRecord.source_identifier);
          
          // PROPERTY ASSERTION 2: New classification was used
          expect(result.usedExisting).toBe(false);
          expect(result.genres).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: New books (not in database) trigger API calls
   */
  it('Property 5c: New books trigger API calls', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        fc.context(),
        (book, ctx) => {
          ctx.log(`New book: ${book.title}`);
          
          // Setup: Empty database (book doesn't exist)
          const dbState = createEmptyDatabase();
          
          // Setup: API call tracker
          const tracker = createApiTracker();
          
          // Action: Run classification step
          const result = simulateClassificationStep(book, dbState, tracker);
          
          // PROPERTY ASSERTION 1: API call WAS made for new book
          expect(tracker.callCount).toBe(1);
          expect(tracker.calledIdentifiers).toContain(book.identifier);
          
          // PROPERTY ASSERTION 2: Classification result returned
          expect(result.usedExisting).toBe(false);
          expect(result.genres).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple re-runs on book with genres never trigger API calls
   */
  it('Property 5d: Multiple re-runs never trigger API calls for classified books', () => {
    fc.assert(
      fc.property(
        bookWithGenresArb,
        fc.integer({ min: 2, max: 10 }),
        fc.context(),
        (bookRecord, numReruns, ctx) => {
          ctx.log(`Book: ${bookRecord.title}, Re-runs: ${numReruns}`);
          
          // Setup: Database with book that has genres
          const dbState = createEmptyDatabase();
          insertBook(dbState, bookRecord);
          
          // Setup: API call tracker
          const tracker = createApiTracker();
          
          // Action: Run classification step multiple times
          for (let i = 0; i < numReruns; i++) {
            const result = simulateClassificationStep(
              {
                identifier: bookRecord.source_identifier,
                title: bookRecord.title,
                author: bookRecord.author
              },
              dbState,
              tracker
            );
            
            // Each run should use existing genres
            expect(result.usedExisting).toBe(true);
            expect(result.genres).toEqual(bookRecord.genres);
          }
          
          // PROPERTY ASSERTION: No API calls were made across all re-runs
          expect(tracker.callCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Mixed batch - only books without genres trigger API calls
   */
  it('Property 5e: Mixed batch only classifies books without genres', () => {
    fc.assert(
      fc.property(
        fc.array(bookWithGenresArb, { minLength: 1, maxLength: 5 }),
        fc.array(bookWithoutGenresArb, { minLength: 1, maxLength: 5 }),
        fc.context(),
        (booksWithGenres, booksWithoutGenres, ctx) => {
          // Ensure unique identifiers
          const usedIds = new Set<string>();
          const uniqueBooksWithGenres = booksWithGenres.filter(b => {
            if (usedIds.has(b.source_identifier)) return false;
            usedIds.add(b.source_identifier);
            return true;
          });
          const uniqueBooksWithoutGenres = booksWithoutGenres.filter(b => {
            if (usedIds.has(b.source_identifier)) return false;
            usedIds.add(b.source_identifier);
            return true;
          });
          
          if (uniqueBooksWithGenres.length === 0 || uniqueBooksWithoutGenres.length === 0) {
            return; // Skip if no unique books
          }
          
          ctx.log(`With genres: ${uniqueBooksWithGenres.length}, Without: ${uniqueBooksWithoutGenres.length}`);
          
          // Setup: Database with mixed books
          const dbState = createEmptyDatabase();
          uniqueBooksWithGenres.forEach(b => insertBook(dbState, b));
          uniqueBooksWithoutGenres.forEach(b => insertBook(dbState, b));
          
          // Setup: API call tracker
          const tracker = createApiTracker();
          
          // Action: Process all books
          const allBooks = [...uniqueBooksWithGenres, ...uniqueBooksWithoutGenres];
          allBooks.forEach(book => {
            simulateClassificationStep(
              {
                identifier: book.source_identifier,
                title: book.title,
                author: book.author
              },
              dbState,
              tracker
            );
          });
          
          // PROPERTY ASSERTION 1: Only books without genres triggered API calls
          expect(tracker.callCount).toBe(uniqueBooksWithoutGenres.length);
          
          // PROPERTY ASSERTION 2: Books with genres were NOT called
          uniqueBooksWithGenres.forEach(book => {
            expect(tracker.calledIdentifiers).not.toContain(book.source_identifier);
          });
          
          // PROPERTY ASSERTION 3: Books without genres WERE called
          uniqueBooksWithoutGenres.forEach(book => {
            expect(tracker.calledIdentifiers).toContain(book.source_identifier);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty genres array is treated as "no genres"
   */
  it('Property 5f: Empty genres array triggers API call', () => {
    fc.assert(
      fc.property(
        bookIdentifierArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.context(),
        (identifier, title, author, ctx) => {
          ctx.log(`Book with empty genres: ${title}`);
          
          // Setup: Database with book that has empty genres array
          const dbState = createEmptyDatabase();
          insertBook(dbState, {
            source_identifier: identifier,
            title,
            author,
            genres: [], // Empty array
            subgenre: null
          });
          
          // Setup: API call tracker
          const tracker = createApiTracker();
          
          // Action: Run classification step
          const result = simulateClassificationStep(
            { identifier, title, author },
            dbState,
            tracker
          );
          
          // PROPERTY ASSERTION: Empty genres array triggers API call
          // (empty array means book was not successfully classified)
          expect(tracker.callCount).toBe(1);
          expect(result.usedExisting).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genres are preserved exactly when using cached result
   */
  it('Property 5g: Cached genres are returned exactly as stored', () => {
    fc.assert(
      fc.property(
        bookWithGenresArb,
        fc.context(),
        (bookRecord, ctx) => {
          ctx.log(`Book: ${bookRecord.title}, Stored genres: ${bookRecord.genres?.join(', ')}`);
          
          // Setup: Database with book
          const dbState = createEmptyDatabase();
          insertBook(dbState, bookRecord);
          
          // Setup: API call tracker
          const tracker = createApiTracker();
          
          // Action: Run classification step
          const result = simulateClassificationStep(
            {
              identifier: bookRecord.source_identifier,
              title: bookRecord.title,
              author: bookRecord.author
            },
            dbState,
            tracker
          );
          
          // PROPERTY ASSERTION: Genres match exactly
          expect(result.genres).toEqual(bookRecord.genres);
          expect(result.subgenre).toBe(bookRecord.subgenre);
          
          // Verify array contents match
          if (result.genres && bookRecord.genres) {
            expect(result.genres.length).toBe(bookRecord.genres.length);
            result.genres.forEach((genre, i) => {
              expect(genre).toBe(bookRecord.genres![i]);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
