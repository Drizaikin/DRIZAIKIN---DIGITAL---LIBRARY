/**
 * Property-Based Tests for Filter Statistics Accuracy
 * **Feature: ingestion-filtering, Property 18: Filter Statistics Accuracy**
 * **Validates: Requirements 5.7.1, 5.7.2, 5.7.3**
 * 
 * This test verifies that:
 * - For any ingestion run, the sum of (books passed + books filtered by genre + books filtered by author) SHALL equal the total books evaluated
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyFilters } from '../../services/ingestion/ingestionFilter.js';
import { PRIMARY_GENRES } from '../../services/ingestion/genreTaxonomy.js';

/**
 * Mock types
 */
interface BookMetadata {
  identifier: string;
  title: string;
  author: string;
  genres: string[] | null;
}

interface FilterConfig {
  allowedGenres: string[];
  allowedAuthors: string[];
  enableGenreFilter: boolean;
  enableAuthorFilter: boolean;
}

interface FilterStatistics {
  totalEvaluated: number;
  passed: number;
  filteredByGenre: number;
  filteredByAuthor: number;
}

/**
 * Simulates processing a batch of books and collecting statistics
 */
function processBooksBatch(books: BookMetadata[], config: FilterConfig): FilterStatistics {
  const stats: FilterStatistics = {
    totalEvaluated: 0,
    passed: 0,
    filteredByGenre: 0,
    filteredByAuthor: 0
  };

  for (const book of books) {
    stats.totalEvaluated++;

    const result = applyFilters(book, config);

    if (result.passed) {
      stats.passed++;
    } else {
      // Determine which filter rejected the book
      if (result.reason && result.reason.includes('Genre filter')) {
        stats.filteredByGenre++;
      } else if (result.reason && result.reason.includes('Author filter')) {
        stats.filteredByAuthor++;
      }
    }
  }

  return stats;
}

/**
 * Generators
 */
const validGenreArb = fc.constantFrom(...PRIMARY_GENRES);
const genresArrayArb = fc.array(validGenreArb, { minLength: 1, maxLength: 3 });
const allowedGenresArb = fc.array(validGenreArb, { minLength: 1, maxLength: 5 });

const authorNameArb = fc.string({ minLength: 5, maxLength: 30 });
const allowedAuthorsArb = fc.array(authorNameArb, { minLength: 1, maxLength: 5 });

const bookArb = fc.record({
  identifier: fc.string({ minLength: 5, maxLength: 20 }),
  title: fc.string({ minLength: 5, maxLength: 50 }),
  author: authorNameArb,
  genres: fc.oneof(genresArrayArb, fc.constant(null))
});

const booksArrayArb = fc.array(bookArb, { minLength: 1, maxLength: 50 });

const filterConfigArb = fc.record({
  allowedGenres: fc.oneof(allowedGenresArb, fc.constant([])),
  allowedAuthors: fc.oneof(allowedAuthorsArb, fc.constant([])),
  enableGenreFilter: fc.boolean(),
  enableAuthorFilter: fc.boolean()
});

describe('Filter Statistics Accuracy - Property Tests', () => {
  /**
   * **Feature: ingestion-filtering, Property 18: Filter Statistics Accuracy**
   * **Validates: Requirements 5.7.1, 5.7.2, 5.7.3**
   * 
   * Property: For any ingestion run, the sum of (books passed + books filtered by genre + books filtered by author)
   * SHALL equal the total books evaluated
   */
  it('Property 18: Sum of passed and filtered books equals total evaluated', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        filterConfigArb,
        (books, config) => {
          // Process books and collect statistics
          const stats = processBooksBatch(books, config);

          // PROPERTY ASSERTION: Sum of outcomes equals total evaluated
          const sum = stats.passed + stats.filteredByGenre + stats.filteredByAuthor;
          expect(sum).toBe(stats.totalEvaluated);

          // ADDITIONAL ASSERTION: Total evaluated equals number of books
          expect(stats.totalEvaluated).toBe(books.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each book is counted exactly once in statistics
   */
  it('Property 18 (corollary): Each book is counted exactly once', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        filterConfigArb,
        (books, config) => {
          // Process books and collect statistics
          const stats = processBooksBatch(books, config);

          // PROPERTY ASSERTION: No book is double-counted
          expect(stats.passed + stats.filteredByGenre + stats.filteredByAuthor).toBe(stats.totalEvaluated);

          // ADDITIONAL ASSERTION: All counts are non-negative
          expect(stats.totalEvaluated).toBeGreaterThanOrEqual(0);
          expect(stats.passed).toBeGreaterThanOrEqual(0);
          expect(stats.filteredByGenre).toBeGreaterThanOrEqual(0);
          expect(stats.filteredByAuthor).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: With no filters active, all books pass
   */
  it('Property 18 (corollary): With no filters, passed equals total evaluated', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        fc.record({
          allowedGenres: fc.constant([]),
          allowedAuthors: fc.constant([]),
          enableGenreFilter: fc.constant(false),
          enableAuthorFilter: fc.constant(false)
        }),
        (books, config) => {
          // Process books and collect statistics
          const stats = processBooksBatch(books, config);

          // PROPERTY ASSERTION: All books pass when no filters are active
          expect(stats.passed).toBe(stats.totalEvaluated);
          expect(stats.filteredByGenre).toBe(0);
          expect(stats.filteredByAuthor).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Statistics are consistent across multiple runs with same data
   */
  it('Property 18 (corollary): Statistics are deterministic for same input', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        filterConfigArb,
        (books, config) => {
          // Process books twice
          const stats1 = processBooksBatch(books, config);
          const stats2 = processBooksBatch(books, config);

          // PROPERTY ASSERTION: Results are identical
          expect(stats1.totalEvaluated).toBe(stats2.totalEvaluated);
          expect(stats1.passed).toBe(stats2.passed);
          expect(stats1.filteredByGenre).toBe(stats2.filteredByGenre);
          expect(stats1.filteredByAuthor).toBe(stats2.filteredByAuthor);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty book list results in zero statistics
   */
  it('Property 18 (corollary): Empty book list results in all zeros', () => {
    fc.assert(
      fc.property(
        filterConfigArb,
        (config) => {
          // Process empty book list
          const stats = processBooksBatch([], config);

          // PROPERTY ASSERTION: All statistics are zero
          expect(stats.totalEvaluated).toBe(0);
          expect(stats.passed).toBe(0);
          expect(stats.filteredByGenre).toBe(0);
          expect(stats.filteredByAuthor).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: At least one statistic is non-zero for non-empty book list
   */
  it('Property 18 (corollary): Non-empty book list has at least one non-zero statistic', () => {
    fc.assert(
      fc.property(
        fc.array(bookArb, { minLength: 1, maxLength: 50 }),
        filterConfigArb,
        (books, config) => {
          // Process books
          const stats = processBooksBatch(books, config);

          // PROPERTY ASSERTION: Total evaluated is non-zero
          expect(stats.totalEvaluated).toBeGreaterThan(0);

          // PROPERTY ASSERTION: At least one outcome category is non-zero
          const hasNonZero = stats.passed > 0 || stats.filteredByGenre > 0 || stats.filteredByAuthor > 0;
          expect(hasNonZero).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre filter statistics are zero when genre filter is disabled
   */
  it('Property 18 (corollary): Genre filter disabled means zero genre filter rejections', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        fc.record({
          allowedGenres: allowedGenresArb,
          allowedAuthors: fc.constant([]),
          enableGenreFilter: fc.constant(false),
          enableAuthorFilter: fc.constant(false)
        }),
        (books, config) => {
          // Process books
          const stats = processBooksBatch(books, config);

          // PROPERTY ASSERTION: No books filtered by genre when filter is disabled
          expect(stats.filteredByGenre).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Author filter statistics are zero when author filter is disabled
   */
  it('Property 18 (corollary): Author filter disabled means zero author filter rejections', () => {
    fc.assert(
      fc.property(
        booksArrayArb,
        fc.record({
          allowedGenres: fc.constant([]),
          allowedAuthors: allowedAuthorsArb,
          enableGenreFilter: fc.constant(false),
          enableAuthorFilter: fc.constant(false)
        }),
        (books, config) => {
          // Process books
          const stats = processBooksBatch(books, config);

          // PROPERTY ASSERTION: No books filtered by author when filter is disabled
          expect(stats.filteredByAuthor).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
