/**
 * Property-Based Tests for Filter Audit Logging
 * **Feature: ingestion-filtering, Property 6: Filter Audit Logging**
 * **Validates: Requirements 5.1.7, 5.2.7, 5.6.4, 5.7.5**
 * 
 * This test verifies that:
 * - For any book that fails any filter, the system SHALL log the filter decision 
 *   including book identifier, filter type, and reason
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { logFilterDecision, applyFilters } from '../../services/ingestion/ingestionFilter.js';
import { PRIMARY_GENRES } from '../../services/ingestion/genreTaxonomy.js';

/**
 * Generator for book metadata
 */
const bookMetadataArb = fc.record({
  identifier: fc.string({ minLength: 5, maxLength: 20 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  author: fc.oneof(
    fc.constantFrom(
      'Robin Sharma',
      'Paulo Coelho',
      'Dale Carnegie',
      'Stephen King',
      'J.K. Rowling',
      'George Orwell'
    ),
    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
  ),
  genres: fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 3 })
});

/**
 * Generator for filter configuration
 */
const filterConfigArb = fc.record({
  allowedGenres: fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 0, maxLength: 5 }),
  allowedAuthors: fc.array(
    fc.constantFrom('Robin Sharma', 'Paulo Coelho', 'Dale Carnegie'),
    { minLength: 0, maxLength: 3 }
  ),
  enableGenreFilter: fc.boolean(),
  enableAuthorFilter: fc.boolean()
});

describe('Filter Audit Logging - Property Tests', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    // Spy on console.log to capture log output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  /**
   * **Feature: ingestion-filtering, Property 6: Filter Audit Logging**
   * **Validates: Requirements 5.1.7, 5.2.7, 5.6.4, 5.7.5**
   * 
   * Property: For any book that fails any filter, the system SHALL log the filter decision 
   * including book identifier, filter type, and reason
   */
  it('Property 6: Filter decisions are logged with book identifier and reason', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        filterConfigArb,
        (book, config) => {
          // Clear previous calls
          consoleLogSpy.mockClear();
          
          // Apply filters to get result
          const filterResult = applyFilters(book, config);
          
          // Call logFilterDecision
          const logEntry = logFilterDecision(book, filterResult);
          
          // PROPERTY ASSERTION: logFilterDecision must return a log entry object
          expect(logEntry).toBeDefined();
          expect(typeof logEntry).toBe('object');
          
          // PROPERTY ASSERTION: Log entry must contain required fields
          expect(logEntry).toHaveProperty('timestamp');
          expect(logEntry).toHaveProperty('status');
          expect(logEntry).toHaveProperty('identifier');
          expect(logEntry).toHaveProperty('title');
          expect(logEntry).toHaveProperty('author');
          expect(logEntry).toHaveProperty('genres');
          expect(logEntry).toHaveProperty('reason');
          
          // PROPERTY ASSERTION: Timestamp must be a valid ISO string
          expect(typeof logEntry.timestamp).toBe('string');
          expect(() => new Date(logEntry.timestamp)).not.toThrow();
          
          // PROPERTY ASSERTION: Status must be either 'PASSED' or 'FILTERED'
          expect(['PASSED', 'FILTERED']).toContain(logEntry.status);
          
          // PROPERTY ASSERTION: Status must match filter result
          if (filterResult.passed) {
            expect(logEntry.status).toBe('PASSED');
          } else {
            expect(logEntry.status).toBe('FILTERED');
          }
          
          // PROPERTY ASSERTION: Identifier must match book identifier
          expect(logEntry.identifier).toBe(book.identifier);
          
          // PROPERTY ASSERTION: Title must match book title
          expect(logEntry.title).toBe(book.title);
          
          // PROPERTY ASSERTION: Author must be present (or 'Unknown')
          expect(typeof logEntry.author).toBe('string');
          if (book.author) {
            expect(logEntry.author).toBe(book.author);
          } else {
            expect(logEntry.author).toBe('Unknown');
          }
          
          // PROPERTY ASSERTION: Genres must be an array
          expect(Array.isArray(logEntry.genres)).toBe(true);
          
          // PROPERTY ASSERTION: Reason must be a non-empty string
          expect(typeof logEntry.reason).toBe('string');
          expect(logEntry.reason.length).toBeGreaterThan(0);
          
          // PROPERTY ASSERTION: If filtered, reason must contain failure information
          if (!filterResult.passed) {
            expect(logEntry.reason).toBe(filterResult.reason);
          } else {
            expect(logEntry.reason).toBe('Passed all filters');
          }
          
          // PROPERTY ASSERTION: Console.log must have been called
          expect(consoleLogSpy).toHaveBeenCalled();
          
          // PROPERTY ASSERTION: Log message must contain book identifier
          const logCalls = consoleLogSpy.mock.calls;
          const logMessages = logCalls.map((call: any[]) => call.join(' '));
          const hasIdentifier = logMessages.some((msg: string) => msg.includes(book.identifier));
          expect(hasIdentifier).toBe(true);
          
          // PROPERTY ASSERTION: Log message must contain book title
          const hasTitle = logMessages.some((msg: string) => msg.includes(book.title));
          expect(hasTitle).toBe(true);
          
          // PROPERTY ASSERTION: If filtered, log message must contain reason
          if (!filterResult.passed) {
            const hasReason = logMessages.some((msg: string) => 
              msg.includes(filterResult.reason || '')
            );
            expect(hasReason).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Log entries for filtered books contain filter type information
   */
  it('Property 6a: Filtered books log entries contain filter type (genre or author)', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        filterConfigArb,
        (book, config) => {
          // Apply filters
          const filterResult = applyFilters(book, config);
          
          // Only test filtered books
          if (filterResult.passed) {
            return; // Skip passed books
          }
          
          // Clear previous calls
          consoleLogSpy.mockClear();
          
          // Call logFilterDecision
          const logEntry = logFilterDecision(book, filterResult);
          
          // PROPERTY ASSERTION: Reason must indicate which filter failed
          const reason = logEntry.reason.toLowerCase();
          const hasFilterType = reason.includes('genre') || reason.includes('author');
          expect(hasFilterType).toBe(true);
          
          // PROPERTY ASSERTION: Console log must contain filter type
          const logCalls = consoleLogSpy.mock.calls;
          const logMessages = logCalls.map((call: any[]) => call.join(' '));
          const logHasFilterType = logMessages.some((msg: string) => {
            const msgLower = msg.toLowerCase();
            return msgLower.includes('genre') || msgLower.includes('author');
          });
          expect(logHasFilterType).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Log entries are deterministic (same input produces same log structure)
   */
  it('Property 6b: Log entries are deterministic for same input', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        filterConfigArb,
        (book, config) => {
          // Apply filters
          const filterResult = applyFilters(book, config);
          
          // Call logFilterDecision twice
          const logEntry1 = logFilterDecision(book, filterResult);
          const logEntry2 = logFilterDecision(book, filterResult);
          
          // PROPERTY ASSERTION: Both log entries must have same structure (except timestamp)
          expect(logEntry1.status).toBe(logEntry2.status);
          expect(logEntry1.identifier).toBe(logEntry2.identifier);
          expect(logEntry1.title).toBe(logEntry2.title);
          expect(logEntry1.author).toBe(logEntry2.author);
          expect(logEntry1.genres).toEqual(logEntry2.genres);
          expect(logEntry1.reason).toBe(logEntry2.reason);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Log entries handle missing book metadata gracefully
   */
  it('Property 6c: Log entries handle missing author gracefully', () => {
    fc.assert(
      fc.property(
        fc.record({
          identifier: fc.string({ minLength: 5, maxLength: 20 }),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          author: fc.constant(null),
          genres: fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 3 })
        }),
        filterConfigArb,
        (book, config) => {
          // Apply filters
          const filterResult = applyFilters(book as any, config);
          
          // Call logFilterDecision
          const logEntry = logFilterDecision(book as any, filterResult);
          
          // PROPERTY ASSERTION: Author must default to 'Unknown'
          expect(logEntry.author).toBe('Unknown');
          
          // PROPERTY ASSERTION: Log entry must still be valid
          expect(logEntry.identifier).toBe(book.identifier);
          expect(logEntry.title).toBe(book.title);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Log entries handle missing genres gracefully
   */
  it('Property 6d: Log entries handle missing genres gracefully', () => {
    fc.assert(
      fc.property(
        fc.record({
          identifier: fc.string({ minLength: 5, maxLength: 20 }),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          author: fc.string({ minLength: 1, maxLength: 50 }),
          genres: fc.constant(null)
        }),
        filterConfigArb,
        (book, config) => {
          // Apply filters
          const filterResult = applyFilters(book as any, config);
          
          // Call logFilterDecision
          const logEntry = logFilterDecision(book as any, filterResult);
          
          // PROPERTY ASSERTION: Genres must default to empty array
          expect(Array.isArray(logEntry.genres)).toBe(true);
          expect(logEntry.genres).toEqual([]);
          
          // PROPERTY ASSERTION: Log entry must still be valid
          expect(logEntry.identifier).toBe(book.identifier);
          expect(logEntry.title).toBe(book.title);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Passed books are logged with appropriate status
   */
  it('Property 6e: Passed books are logged with PASSED status', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        (book) => {
          // Create config that will pass all books (no filters)
          const config = {
            allowedGenres: [],
            allowedAuthors: [],
            enableGenreFilter: false,
            enableAuthorFilter: false
          };
          
          // Apply filters (should pass)
          const filterResult = applyFilters(book, config);
          
          // Clear previous calls
          consoleLogSpy.mockClear();
          
          // Call logFilterDecision
          const logEntry = logFilterDecision(book, filterResult);
          
          // PROPERTY ASSERTION: Status must be PASSED
          expect(logEntry.status).toBe('PASSED');
          
          // PROPERTY ASSERTION: Reason must indicate passed
          expect(logEntry.reason).toBe('Passed all filters');
          
          // PROPERTY ASSERTION: Console log must contain PASSED
          const logCalls = consoleLogSpy.mock.calls;
          const logMessages = logCalls.map((call: any[]) => call.join(' '));
          const hasPassed = logMessages.some((msg: string) => msg.includes('PASSED'));
          expect(hasPassed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filtered books are logged with FILTERED status
   */
  it('Property 6f: Filtered books are logged with FILTERED status', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 3 }),
        (book, allowedGenres) => {
          // Ensure book genres don't match allowed genres
          const bookGenresSet = new Set(book.genres.map(g => g.toLowerCase()));
          const allowedGenresSet = new Set(allowedGenres.map(g => g.toLowerCase()));
          const hasOverlap = [...bookGenresSet].some(g => allowedGenresSet.has(g));
          
          if (hasOverlap) {
            return; // Skip if there's overlap
          }
          
          // Create config that will filter this book
          const config = {
            allowedGenres,
            allowedAuthors: [],
            enableGenreFilter: true,
            enableAuthorFilter: false
          };
          
          // Apply filters (should fail)
          const filterResult = applyFilters(book, config);
          
          // Skip if somehow passed
          if (filterResult.passed) {
            return;
          }
          
          // Clear previous calls
          consoleLogSpy.mockClear();
          
          // Call logFilterDecision
          const logEntry = logFilterDecision(book, filterResult);
          
          // PROPERTY ASSERTION: Status must be FILTERED
          expect(logEntry.status).toBe('FILTERED');
          
          // PROPERTY ASSERTION: Reason must contain failure information
          expect(logEntry.reason).not.toBe('Passed all filters');
          expect(logEntry.reason.length).toBeGreaterThan(0);
          
          // PROPERTY ASSERTION: Console log must contain FILTERED
          const logCalls = consoleLogSpy.mock.calls;
          const logMessages = logCalls.map((call: any[]) => call.join(' '));
          const hasFiltered = logMessages.some((msg: string) => msg.includes('FILTERED'));
          expect(hasFiltered).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Log entries contain valid timestamps
   */
  it('Property 6g: Log entries contain valid ISO timestamps', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        filterConfigArb,
        (book, config) => {
          // Apply filters
          const filterResult = applyFilters(book, config);
          
          // Call logFilterDecision
          const logEntry = logFilterDecision(book, filterResult);
          
          // PROPERTY ASSERTION: Timestamp must be valid ISO string
          expect(typeof logEntry.timestamp).toBe('string');
          const timestamp = new Date(logEntry.timestamp);
          expect(timestamp.toString()).not.toBe('Invalid Date');
          
          // PROPERTY ASSERTION: Timestamp must be recent (within last minute)
          const now = new Date();
          const diff = now.getTime() - timestamp.getTime();
          expect(diff).toBeGreaterThanOrEqual(0);
          expect(diff).toBeLessThan(60000); // Less than 1 minute
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Log format is consistent across all filter results
   */
  it('Property 6h: Log format is consistent for all filter results', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        filterConfigArb,
        (book, config) => {
          // Apply filters
          const filterResult = applyFilters(book, config);
          
          // Clear previous calls
          consoleLogSpy.mockClear();
          
          // Call logFilterDecision
          logFilterDecision(book, filterResult);
          
          // PROPERTY ASSERTION: Console.log must have been called exactly once
          expect(consoleLogSpy).toHaveBeenCalledTimes(1);
          
          // PROPERTY ASSERTION: Log message must start with [IngestionFilter]
          const logCall = consoleLogSpy.mock.calls[0];
          const logMessage = logCall.join(' ');
          expect(logMessage).toContain('[IngestionFilter]');
          
          // PROPERTY ASSERTION: Log message must contain status (PASSED or FILTERED)
          const hasStatus = logMessage.includes('PASSED') || logMessage.includes('FILTERED');
          expect(hasStatus).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Log entries preserve all book metadata
   */
  it('Property 6i: Log entries preserve all book metadata fields', () => {
    fc.assert(
      fc.property(
        bookMetadataArb,
        filterConfigArb,
        (book, config) => {
          // Apply filters
          const filterResult = applyFilters(book, config);
          
          // Call logFilterDecision
          const logEntry = logFilterDecision(book, filterResult);
          
          // PROPERTY ASSERTION: All book fields must be preserved
          expect(logEntry.identifier).toBe(book.identifier);
          expect(logEntry.title).toBe(book.title);
          
          if (book.author) {
            expect(logEntry.author).toBe(book.author);
          }
          
          if (book.genres) {
            expect(logEntry.genres).toEqual(book.genres);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple log calls don't interfere with each other
   */
  it('Property 6j: Multiple log calls are independent', () => {
    fc.assert(
      fc.property(
        fc.array(bookMetadataArb, { minLength: 2, maxLength: 5 }),
        filterConfigArb,
        (books, config) => {
          // Clear previous calls
          consoleLogSpy.mockClear();
          
          // Log multiple books
          const logEntries = books.map(book => {
            const filterResult = applyFilters(book, config);
            return logFilterDecision(book, filterResult);
          });
          
          // PROPERTY ASSERTION: Number of log entries must match number of books
          expect(logEntries.length).toBe(books.length);
          
          // PROPERTY ASSERTION: Each log entry must correspond to correct book
          for (let i = 0; i < books.length; i++) {
            expect(logEntries[i].identifier).toBe(books[i].identifier);
            expect(logEntries[i].title).toBe(books[i].title);
          }
          
          // PROPERTY ASSERTION: Console.log must have been called for each book
          expect(consoleLogSpy).toHaveBeenCalledTimes(books.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
