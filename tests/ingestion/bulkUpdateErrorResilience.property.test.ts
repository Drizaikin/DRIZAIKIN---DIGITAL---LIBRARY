/**
 * Property-Based Tests for Bulk Update Error Resilience
 * **Feature: ingestion-filtering, Property 15: Bulk Update Error Resilience**
 * **Validates: Requirements 5.5.5**
 * 
 * This test verifies that:
 * - For any error encountered during bulk category update, the update process
 *   SHALL continue processing remaining books
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { updateAllCategories } from '../../services/ingestion/bulkCategoryUpdate.js';
import * as databaseWriter from '../../services/ingestion/databaseWriter.js';
import { PRIMARY_GENRES } from '../../services/ingestion/genreTaxonomy.js';

/**
 * Generator for valid genre names from the taxonomy
 */
const validGenreArb = fc.constantFrom(...PRIMARY_GENRES);

/**
 * Generator for arrays of 1-3 genres
 */
const genresArrayArb = fc.array(validGenreArb, { minLength: 1, maxLength: 3 });

/**
 * Generator for empty genres (null or empty array)
 */
const emptyGenresArb = fc.constantFrom(null, []);

/**
 * Generator for a book
 */
const bookArb = fc.record({
  id: fc.uuid(),
  genres: fc.oneof(genresArrayArb, emptyGenresArb)
});

/**
 * Generator for a list of books
 */
const booksListArb = fc.array(bookArb, { minLength: 3, maxLength: 20 });

// Mock the Supabase client
const mockSupabase = {
  from: vi.fn()
};

describe('Bulk Update Error Resilience - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getSupabase to return our mock client
    vi.spyOn(databaseWriter, 'getSupabase').mockReturnValue(mockSupabase as any);
  });

  /**
   * **Feature: ingestion-filtering, Property 15: Bulk Update Error Resilience**
   * **Validates: Requirements 5.5.5**
   * 
   * Property: For any error encountered during bulk category update,
   * the update process SHALL continue processing remaining books
   */
  it('Property 15: Bulk update continues processing after errors', () => {
    fc.assert(
      fc.property(
        booksListArb,
        fc.integer({ min: 0, max: 100 }), // Error percentage (0-100)
        async (books, errorPercentage) => {
          // Skip if no books
          if (books.length === 0) return true;

          let updateCallCount = 0;
          const failedBookIds = new Set<string>();

          // Mock the select query to return our generated books
          mockSupabase.from.mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: books,
              error: null
            })
          });

          // Mock the update queries to fail for some books based on error percentage
          const mockUpdate = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation((field: string, id: string) => {
              updateCallCount++;
              
              // Fail this update based on error percentage
              const shouldFail = (Math.random() * 100) < errorPercentage;
              
              if (shouldFail) {
                failedBookIds.add(id);
                return Promise.resolve({ 
                  error: { message: `Simulated error for book ${id}` } 
                });
              }
              
              return Promise.resolve({ error: null });
            })
          }));

          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: mockUpdate
              };
            }
          });

          // Run the bulk update
          const result = await updateAllCategories();

          // PROPERTY ASSERTION: All books should be attempted (updated + errors = total)
          expect(result.updated + result.errors).toBe(books.length);

          // PROPERTY ASSERTION: Update was called for each book
          expect(updateCallCount).toBe(books.length);

          // PROPERTY ASSERTION: Error count matches failed books
          expect(result.errors).toBe(failedBookIds.size);

          // PROPERTY ASSERTION: Updated count is correct
          expect(result.updated).toBe(books.length - failedBookIds.size);

          // PROPERTY ASSERTION: Error details are provided for failed books
          expect(result.details.length).toBe(failedBookIds.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bulk update processes all books even when first book fails
   */
  it('Property 15a: Bulk update continues when first book fails', () => {
    fc.assert(
      fc.property(
        booksListArb,
        async (books) => {
          // Skip if less than 2 books
          if (books.length < 2) return true;

          let updateCallCount = 0;

          mockSupabase.from.mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: books,
              error: null
            })
          });

          // Mock update to fail only for the first book
          const mockUpdate = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation((field: string, id: string) => {
              updateCallCount++;
              
              // Fail only the first book
              if (updateCallCount === 1) {
                return Promise.resolve({ 
                  error: { message: 'First book error' } 
                });
              }
              
              return Promise.resolve({ error: null });
            })
          }));

          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: mockUpdate
              };
            }
          });

          const result = await updateAllCategories();

          // PROPERTY ASSERTION: All books were attempted
          expect(updateCallCount).toBe(books.length);

          // PROPERTY ASSERTION: Exactly 1 error
          expect(result.errors).toBe(1);

          // PROPERTY ASSERTION: All other books succeeded
          expect(result.updated).toBe(books.length - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bulk update processes all books even when last book fails
   */
  it('Property 15b: Bulk update continues when last book fails', () => {
    fc.assert(
      fc.property(
        booksListArb,
        async (books) => {
          // Skip if less than 2 books
          if (books.length < 2) return true;

          let updateCallCount = 0;

          mockSupabase.from.mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: books,
              error: null
            })
          });

          // Mock update to fail only for the last book
          const mockUpdate = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation((field: string, id: string) => {
              updateCallCount++;
              
              // Fail only the last book
              if (updateCallCount === books.length) {
                return Promise.resolve({ 
                  error: { message: 'Last book error' } 
                });
              }
              
              return Promise.resolve({ error: null });
            })
          }));

          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: mockUpdate
              };
            }
          });

          const result = await updateAllCategories();

          // PROPERTY ASSERTION: All books were attempted
          expect(updateCallCount).toBe(books.length);

          // PROPERTY ASSERTION: Exactly 1 error
          expect(result.errors).toBe(1);

          // PROPERTY ASSERTION: All other books succeeded
          expect(result.updated).toBe(books.length - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bulk update processes all books even when middle books fail
   */
  it('Property 15c: Bulk update continues when middle books fail', () => {
    fc.assert(
      fc.property(
        fc.array(bookArb, { minLength: 5, maxLength: 20 }),
        async (books) => {
          let updateCallCount = 0;
          const middleStart = Math.floor(books.length / 3);
          const middleEnd = Math.floor(2 * books.length / 3);

          mockSupabase.from.mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: books,
              error: null
            })
          });

          // Mock update to fail for middle third of books
          const mockUpdate = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation((field: string, id: string) => {
              updateCallCount++;
              
              // Fail for middle third
              if (updateCallCount > middleStart && updateCallCount <= middleEnd) {
                return Promise.resolve({ 
                  error: { message: `Middle book error ${updateCallCount}` } 
                });
              }
              
              return Promise.resolve({ error: null });
            })
          }));

          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: mockUpdate
              };
            }
          });

          const result = await updateAllCategories();

          // PROPERTY ASSERTION: All books were attempted
          expect(updateCallCount).toBe(books.length);

          // PROPERTY ASSERTION: Error count matches middle third
          const expectedErrors = middleEnd - middleStart;
          expect(result.errors).toBe(expectedErrors);

          // PROPERTY ASSERTION: Success count is correct
          expect(result.updated).toBe(books.length - expectedErrors);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bulk update provides error details for all failed books
   */
  it('Property 15d: Error details provided for all failures', () => {
    fc.assert(
      fc.property(
        booksListArb,
        fc.integer({ min: 1, max: 100 }), // Error percentage
        async (books, errorPercentage) => {
          // Skip if no books
          if (books.length === 0) return true;

          const failedBookIds = new Set<string>();

          mockSupabase.from.mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: books,
              error: null
            })
          });

          const mockUpdate = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation((field: string, id: string) => {
              const shouldFail = (Math.random() * 100) < errorPercentage;
              
              if (shouldFail) {
                failedBookIds.add(id);
                return Promise.resolve({ 
                  error: { message: `Error for ${id}` } 
                });
              }
              
              return Promise.resolve({ error: null });
            })
          }));

          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: mockUpdate
              };
            }
          });

          const result = await updateAllCategories();

          // PROPERTY ASSERTION: Error details array length matches error count
          expect(result.details.length).toBe(result.errors);
          expect(result.details.length).toBe(failedBookIds.size);

          // PROPERTY ASSERTION: Each error detail has bookId and error message
          for (const detail of result.details) {
            expect(detail).toHaveProperty('bookId');
            expect(detail).toHaveProperty('error');
            expect(typeof detail.bookId).toBe('string');
            expect(typeof detail.error).toBe('string');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bulk update never stops early due to errors
   */
  it('Property 15e: Update never stops early regardless of error rate', () => {
    fc.assert(
      fc.property(
        booksListArb,
        fc.integer({ min: 0, max: 100 }),
        async (books, errorPercentage) => {
          if (books.length === 0) return true;

          let updateCallCount = 0;

          mockSupabase.from.mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: books,
              error: null
            })
          });

          const mockUpdate = vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation(() => {
              updateCallCount++;
              const shouldFail = (Math.random() * 100) < errorPercentage;
              return Promise.resolve({ 
                error: shouldFail ? { message: 'Error' } : null 
              });
            })
          }));

          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: mockUpdate
              };
            }
          });

          await updateAllCategories();

          // PROPERTY ASSERTION: Update was called exactly once per book
          expect(updateCallCount).toBe(books.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
