/**
 * Property-Based Tests for Bulk Update Category Sync
 * **Feature: ingestion-filtering, Property 14: Bulk Update Category Sync**
 * **Validates: Requirements 5.5.2, 5.5.3**
 * 
 * This test verifies that:
 * - For any book processed by the bulk update function, the category field SHALL be set to
 *   the first genre if genres exist, otherwise "Uncategorized"
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
 * Generator for arrays of 1-3 genres (matching AI classification bounds)
 */
const genresArrayArb = fc.array(validGenreArb, { minLength: 1, maxLength: 3 });

/**
 * Generator for empty genres (null or empty array)
 */
const emptyGenresArb = fc.constantFrom(null, []);

/**
 * Generator for a book with genres
 */
const bookWithGenresArb = fc.record({
  id: fc.uuid(),
  genres: genresArrayArb
});

/**
 * Generator for a book without genres
 */
const bookWithoutGenresArb = fc.record({
  id: fc.uuid(),
  genres: emptyGenresArb
});

/**
 * Generator for a mixed list of books (some with genres, some without)
 */
const booksListArb = fc.array(
  fc.oneof(bookWithGenresArb, bookWithoutGenresArb),
  { minLength: 1, maxLength: 50 }
);

// Mock the Supabase client
const mockSupabase = {
  from: vi.fn()
};

describe('Bulk Update Category Sync - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getSupabase to return our mock client
    vi.spyOn(databaseWriter, 'getSupabase').mockReturnValue(mockSupabase as any);
  });

  /**
   * **Feature: ingestion-filtering, Property 14: Bulk Update Category Sync**
   * **Validates: Requirements 5.5.2, 5.5.3**
   * 
   * Property: For any book processed by the bulk update function,
   * the category field SHALL be set to the first genre if genres exist,
   * otherwise "Uncategorized"
   */
  it('Property 14: Bulk update sets category to first genre or "Uncategorized"', async () => {
    await fc.assert(
      fc.asyncProperty(
        booksListArb,
        async (books) => {
          // Track what categories were set for each book
          const categoryUpdates = new Map<string, string>();

          // Set up the mock for this iteration
          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: vi.fn().mockImplementation((data: any) => {
                  // Capture the category from the update data
                  const category = data.category;
                  return {
                    eq: vi.fn().mockImplementation((_field: string, id: string) => {
                      // Store the category for this book ID
                      categoryUpdates.set(id, category);
                      return Promise.resolve({ error: null });
                    })
                  };
                })
              };
            }
          });

          // Run the bulk update
          const result = await updateAllCategories();

          // PROPERTY ASSERTION: All books should be updated successfully
          expect(result.updated).toBe(books.length);
          expect(result.errors).toBe(0);

          // PROPERTY ASSERTION: For each book, verify the category was set correctly
          for (const book of books) {
            const setCategory = categoryUpdates.get(book.id);
            
            if (book.genres && book.genres.length > 0) {
              // Book has genres: category should be first genre
              expect(setCategory).toBe(book.genres[0]);
              expect(PRIMARY_GENRES).toContain(setCategory!);
            } else {
              // Book has no genres: category should be "Uncategorized"
              expect(setCategory).toBe('Uncategorized');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bulk update correctly handles books with only genres
   */
  it('Property 14a: Bulk update sets first genre for all books with genres', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(bookWithGenresArb, { minLength: 1, maxLength: 30 }),
        async (books) => {
          const categoryUpdates = new Map<string, string>();

          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: vi.fn().mockImplementation((data: any) => {
                  // Capture the category from the update data
                  const category = data.category;
                  return {
                    eq: vi.fn().mockImplementation((_field: string, id: string) => {
                      // Store the category for this book ID
                      categoryUpdates.set(id, category);
                      return Promise.resolve({ error: null });
                    })
                  };
                })
              };
            }
          });

          await updateAllCategories();

          // PROPERTY ASSERTION: Every book should have category = genres[0]
          for (const book of books) {
            const setCategory = categoryUpdates.get(book.id);
            expect(setCategory).toBe(book.genres[0]);
            expect(PRIMARY_GENRES).toContain(setCategory!);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bulk update correctly handles books without genres
   */
  it('Property 14b: Bulk update sets "Uncategorized" for all books without genres', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(bookWithoutGenresArb, { minLength: 1, maxLength: 30 }),
        async (books) => {
          const categoryUpdates = new Map<string, string>();

          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: vi.fn().mockImplementation((data: any) => {
                  // Capture the category from the update data
                  const category = data.category;
                  return {
                    eq: vi.fn().mockImplementation((_field: string, id: string) => {
                      // Store the category for this book ID
                      categoryUpdates.set(id, category);
                      return Promise.resolve({ error: null });
                    })
                  };
                })
              };
            }
          });

          await updateAllCategories();

          // PROPERTY ASSERTION: Every book should have category = "Uncategorized"
          for (const book of books) {
            const setCategory = categoryUpdates.get(book.id);
            expect(setCategory).toBe('Uncategorized');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bulk update processes all books exactly once
   */
  it('Property 14c: Bulk update processes each book exactly once', async () => {
    await fc.assert(
      fc.asyncProperty(
        booksListArb,
        async (books) => {
          const processedBooks = new Set<string>();

          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: vi.fn().mockImplementation((_data: any) => ({
                  eq: vi.fn().mockImplementation((_field: string, id: string) => {
                    processedBooks.add(id);
                    return Promise.resolve({ error: null });
                  })
                }))
              };
            }
          });

          await updateAllCategories();

          // PROPERTY ASSERTION: Each book ID should be processed exactly once
          expect(processedBooks.size).toBe(books.length);
          for (const book of books) {
            expect(processedBooks.has(book.id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bulk update result counts match input
   */
  it('Property 14d: Bulk update result counts match input book count', async () => {
    await fc.assert(
      fc.asyncProperty(
        booksListArb,
        async (books) => {
          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: vi.fn().mockImplementation(() => ({
                  eq: vi.fn().mockResolvedValue({ error: null })
                }))
              };
            }
          });

          const result = await updateAllCategories();

          // PROPERTY ASSERTION: Updated count should equal input count
          expect(result.updated).toBe(books.length);
          expect(result.errors).toBe(0);
          expect(result.updated + result.errors).toBe(books.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Category values are always valid (either from taxonomy or "Uncategorized")
   */
  it('Property 14e: All set categories are valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        booksListArb,
        async (books) => {
          const categoryUpdates: string[] = [];

          mockSupabase.from.mockImplementation((table) => {
            if (table === 'books') {
              return {
                select: vi.fn().mockResolvedValue({
                  data: books,
                  error: null
                }),
                update: vi.fn().mockImplementation((data: any) => {
                  // Capture the category from the update data
                  const category = data.category;
                  return {
                    eq: vi.fn().mockImplementation(() => {
                      // Store the category
                      categoryUpdates.push(category);
                      return Promise.resolve({ error: null });
                    })
                  };
                })
              };
            }
          });

          await updateAllCategories();

          // PROPERTY ASSERTION: Every category is either from taxonomy or "Uncategorized"
          for (const category of categoryUpdates) {
            const isValid = PRIMARY_GENRES.includes(category) || category === 'Uncategorized';
            expect(isValid).toBe(true);
            expect(typeof category).toBe('string');
            expect(category.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
