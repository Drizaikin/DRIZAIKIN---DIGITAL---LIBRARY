/**
 * Property-Based Tests for Combined Filter Logic
 * **Feature: ingestion-filtering, Property 17: Combined Filter Logic**
 * **Validates: Requirements 5.6.2, 5.6.3, 5.6.5**
 * 
 * This test verifies that:
 * - For any book, when both genre and author filters are enabled, the book SHALL pass only if it passes BOTH filters
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyFilters } from '../../services/ingestion/ingestionFilter.js';
import { PRIMARY_GENRES } from '../../services/ingestion/genreTaxonomy.js';

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
  genres: genresArrayArb
});

/**
 * Generator for configuration with both filters enabled
 */
const bothFiltersEnabledArb = fc.record({
  allowedGenres: allowedGenresArb,
  allowedAuthors: allowedAuthorsArb,
  enableGenreFilter: fc.constant(true),
  enableAuthorFilter: fc.constant(true)
});

/**
 * Generator for configuration with only genre filter enabled
 */
const onlyGenreFilterArb = fc.record({
  allowedGenres: allowedGenresArb,
  allowedAuthors: fc.constant([]),
  enableGenreFilter: fc.constant(true),
  enableAuthorFilter: fc.constant(false)
});

/**
 * Generator for configuration with only author filter enabled
 */
const onlyAuthorFilterArb = fc.record({
  allowedGenres: fc.constant([]),
  allowedAuthors: allowedAuthorsArb,
  enableGenreFilter: fc.constant(false),
  enableAuthorFilter: fc.constant(true)
});

describe('Combined Filter Logic - Property Tests', () => {
  /**
   * **Feature: ingestion-filtering, Property 17: Combined Filter Logic**
   * **Validates: Requirements 5.6.2, 5.6.3, 5.6.5**
   * 
   * Property: For any book, when both genre and author filters are enabled,
   * the book SHALL pass only if it passes BOTH filters
   */
  it('Property 17: Book passes combined filters only if it passes both genre AND author filters', () => {
    fc.assert(
      fc.property(
        bookArb,
        bothFiltersEnabledArb,
        (book, config) => {
          // Apply filters
          const result = applyFilters(book, config);

          // Calculate expected results for each filter independently
          const allowedGenresLower = config.allowedGenres.map(g => g.toLowerCase());
          const genreMatch = book.genres.some(genre => 
            allowedGenresLower.includes(genre.toLowerCase())
          );

          const normalizedAuthor = book.author.toLowerCase();
          const authorMatch = config.allowedAuthors.some(allowed => 
            normalizedAuthor.includes(allowed.toLowerCase())
          );

          // PROPERTY ASSERTION: Book passes if and only if BOTH filters pass
          const expectedPass = genreMatch && authorMatch;
          expect(result.passed).toBe(expectedPass);

          // ADDITIONAL ASSERTION: If failed, reason should indicate which filter failed
          if (!result.passed) {
            expect(result.reason).toBeDefined();
            if (!genreMatch) {
              expect(result.reason).toContain('Genre filter failed');
            } else if (!authorMatch) {
              expect(result.reason).toContain('Author filter failed');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When only genre filter is enabled, author filter should not affect result
   */
  it('Property 17 (corollary): With only genre filter enabled, author does not affect result', () => {
    fc.assert(
      fc.property(
        bookArb,
        onlyGenreFilterArb,
        (book, config) => {
          // Apply filters
          const result = applyFilters(book, config);

          // Calculate expected result based on genre only
          const allowedGenresLower = config.allowedGenres.map(g => g.toLowerCase());
          const genreMatch = book.genres.some(genre => 
            allowedGenresLower.includes(genre.toLowerCase())
          );

          // PROPERTY ASSERTION: Result depends only on genre filter
          expect(result.passed).toBe(genreMatch);

          // ADDITIONAL ASSERTION: Reason should only mention genre if failed
          if (!result.passed) {
            expect(result.reason).toContain('Genre filter failed');
            expect(result.reason).not.toContain('Author filter failed');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When only author filter is enabled, genre filter should not affect result
   */
  it('Property 17 (corollary): With only author filter enabled, genre does not affect result', () => {
    fc.assert(
      fc.property(
        bookArb,
        onlyAuthorFilterArb,
        (book, config) => {
          // Apply filters
          const result = applyFilters(book, config);

          // Calculate expected result based on author only
          const normalizedAuthor = book.author.toLowerCase();
          const authorMatch = config.allowedAuthors.some(allowed => 
            normalizedAuthor.includes(allowed.toLowerCase())
          );

          // PROPERTY ASSERTION: Result depends only on author filter
          expect(result.passed).toBe(authorMatch);

          // ADDITIONAL ASSERTION: Reason should only mention author if failed
          if (!result.passed) {
            expect(result.reason).toContain('Author filter failed');
            expect(result.reason).not.toContain('Genre filter failed');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre filter is evaluated before author filter (fail-fast)
   */
  it('Property 17 (corollary): Genre filter is evaluated before author filter', () => {
    fc.assert(
      fc.property(
        bookArb,
        bothFiltersEnabledArb,
        (book, config) => {
          // Apply filters
          const result = applyFilters(book, config);

          // Calculate genre match
          const allowedGenresLower = config.allowedGenres.map(g => g.toLowerCase());
          const genreMatch = book.genres.some(genre => 
            allowedGenresLower.includes(genre.toLowerCase())
          );

          // PROPERTY ASSERTION: If genre filter fails, reason should mention genre (not author)
          if (!genreMatch) {
            expect(result.passed).toBe(false);
            expect(result.reason).toContain('Genre filter failed');
            // Author filter should not be mentioned because genre failed first
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Passing genre filter but failing author filter results in overall failure
   */
  it('Property 17 (corollary): Passing genre but failing author results in failure', () => {
    fc.assert(
      fc.property(
        fc.record({
          identifier: fc.string({ minLength: 5, maxLength: 20 }),
          title: fc.string({ minLength: 5, maxLength: 50 }),
          author: fc.constant('Different Author'),  // Will not match
          genres: fc.array(fc.constantFrom('Fiction'), { minLength: 1, maxLength: 1 })  // Will match
        }),
        fc.record({
          allowedGenres: fc.constant(['Fiction']),
          allowedAuthors: fc.constant(['Approved Author']),
          enableGenreFilter: fc.constant(true),
          enableAuthorFilter: fc.constant(true)
        }),
        (book, config) => {
          // Apply filters
          const result = applyFilters(book, config);

          // PROPERTY ASSERTION: Book should fail overall
          expect(result.passed).toBe(false);
          expect(result.reason).toContain('Author filter failed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Passing both filters results in success
   */
  it('Property 17 (corollary): Passing both genre and author filters results in success', () => {
    fc.assert(
      fc.property(
        fc.record({
          identifier: fc.string({ minLength: 5, maxLength: 20 }),
          title: fc.string({ minLength: 5, maxLength: 50 }),
          author: fc.constant('Approved Author'),  // Will match
          genres: fc.array(fc.constantFrom('Fiction'), { minLength: 1, maxLength: 1 })  // Will match
        }),
        fc.record({
          allowedGenres: fc.constant(['Fiction']),
          allowedAuthors: fc.constant(['Approved Author']),
          enableGenreFilter: fc.constant(true),
          enableAuthorFilter: fc.constant(true)
        }),
        (book, config) => {
          // Apply filters
          const result = applyFilters(book, config);

          // PROPERTY ASSERTION: Book should pass
          expect(result.passed).toBe(true);
          expect(result.reason).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
