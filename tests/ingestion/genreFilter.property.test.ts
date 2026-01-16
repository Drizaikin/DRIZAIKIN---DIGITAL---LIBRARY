/**
 * Property-Based Tests for Genre Filter
 * **Feature: ingestion-filtering, Property 1: Genre Filter Correctness**
 * **Feature: ingestion-filtering, Property 2: Empty Genre Filter Allows All**
 * **Validates: Requirements 5.1.2, 5.1.3, 5.6.2**
 * 
 * This test verifies that:
 * - For any book with genres G and filter configuration with allowed genres A (where A is non-empty),
 *   the book SHALL pass the genre filter if and only if there exists at least one genre g in G such that g is in A
 * - For any book, when the allowed genres list is empty, the genre filter SHALL pass the book
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { checkGenreFilter } from '../../services/ingestion/ingestionFilter.js';
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
 * Generator for allowed genres configuration (1-10 genres)
 */
const allowedGenresArb = fc.array(validGenreArb, { minLength: 1, maxLength: 10 });

/**
 * Generator for filter configuration with non-empty allowed genres
 */
const activeGenreFilterConfigArb = fc.record({
  allowedGenres: allowedGenresArb,
  enableGenreFilter: fc.constant(true),
  allowedAuthors: fc.constant([]),
  enableAuthorFilter: fc.constant(false)
});

/**
 * Generator for filter configuration with empty allowed genres
 */
const emptyGenreFilterConfigArb = fc.record({
  allowedGenres: fc.constant([]),
  enableGenreFilter: fc.constant(true),
  allowedAuthors: fc.constant([]),
  enableAuthorFilter: fc.constant(false)
});

/**
 * Generator for disabled filter configuration
 */
const disabledGenreFilterConfigArb = fc.record({
  allowedGenres: allowedGenresArb,
  enableGenreFilter: fc.constant(false),
  allowedAuthors: fc.constant([]),
  enableAuthorFilter: fc.constant(false)
});

describe('Genre Filter - Property Tests', () => {
  /**
   * **Feature: ingestion-filtering, Property 1: Genre Filter Correctness**
   * **Validates: Requirements 5.1.2, 5.6.2**
   * 
   * Property: For any book with genres G and filter configuration with allowed genres A (where A is non-empty),
   * the book SHALL pass the genre filter if and only if there exists at least one genre g in G such that g is in A
   */
  it('Property 1: Genre filter passes if and only if book has at least one matching genre', () => {
    fc.assert(
      fc.property(
        genresArrayArb,
        activeGenreFilterConfigArb,
        (bookGenres, config) => {
          // Call checkGenreFilter
          const result = checkGenreFilter(bookGenres, config);
          
          // Calculate expected result: does ANY book genre match ANY allowed genre?
          const allowedGenresLower = config.allowedGenres.map(g => g.toLowerCase());
          const hasMatch = bookGenres.some(genre => 
            allowedGenresLower.includes(genre.toLowerCase())
          );
          
          // PROPERTY ASSERTION: Result must match expected
          expect(result.passed).toBe(hasMatch);
          
          // ADDITIONAL ASSERTION: If failed, reason should be provided
          if (!hasMatch) {
            expect(result.reason).toBeDefined();
            expect(result.reason).toContain('Genre not in allowed list');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ingestion-filtering, Property 2: Empty Genre Filter Allows All**
   * **Validates: Requirements 5.1.3**
   * 
   * Property: For any book, when the allowed genres list is empty, the genre filter SHALL pass the book
   */
  it('Property 2: Empty allowed genres list allows all books', () => {
    fc.assert(
      fc.property(
        genresArrayArb,
        emptyGenreFilterConfigArb,
        (bookGenres, config) => {
          // Call checkGenreFilter with empty allowed genres
          const result = checkGenreFilter(bookGenres, config);
          
          // PROPERTY ASSERTION: Must always pass
          expect(result.passed).toBe(true);
          
          // PROPERTY ASSERTION: No reason should be provided for passing
          expect(result.reason).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Disabled genre filter allows all books regardless of genres
   */
  it('Property 1a: Disabled genre filter allows all books', () => {
    fc.assert(
      fc.property(
        genresArrayArb,
        disabledGenreFilterConfigArb,
        (bookGenres, config) => {
          // Call checkGenreFilter with disabled filter
          const result = checkGenreFilter(bookGenres, config);
          
          // PROPERTY ASSERTION: Must always pass when disabled
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre filter is case-insensitive
   */
  it('Property 1b: Genre filter matching is case-insensitive', () => {
    fc.assert(
      fc.property(
        validGenreArb,
        fc.constantFrom('lower', 'upper', 'mixed'),
        (genre, caseType) => {
          // Transform genre to different case
          let bookGenre: string;
          let allowedGenre: string;
          
          if (caseType === 'lower') {
            bookGenre = genre.toLowerCase();
            allowedGenre = genre.toUpperCase();
          } else if (caseType === 'upper') {
            bookGenre = genre.toUpperCase();
            allowedGenre = genre.toLowerCase();
          } else {
            // Mixed case
            bookGenre = genre;
            allowedGenre = genre.split('').map((c, i) => 
              i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
            ).join('');
          }
          
          const config = {
            allowedGenres: [allowedGenre],
            enableGenreFilter: true,
            allowedAuthors: [],
            enableAuthorFilter: false
          };
          
          const result = checkGenreFilter([bookGenre], config);
          
          // PROPERTY ASSERTION: Must pass despite case differences
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre filter with multiple book genres passes if ANY match
   */
  it('Property 1c: Filter passes if ANY book genre matches allowed genres', () => {
    fc.assert(
      fc.property(
        validGenreArb,
        fc.array(validGenreArb, { minLength: 1, maxLength: 2 }),
        fc.array(validGenreArb, { minLength: 1, maxLength: 5 }),
        (matchingGenre, nonMatchingGenres, allowedGenres) => {
          // Ensure nonMatchingGenres don't include matchingGenre or allowedGenres
          const filteredNonMatching = nonMatchingGenres.filter(g => 
            g.toLowerCase() !== matchingGenre.toLowerCase() &&
            !allowedGenres.some(a => a.toLowerCase() === g.toLowerCase())
          );
          
          // Create book genres: some non-matching + one matching
          const bookGenres = [...filteredNonMatching, matchingGenre];
          
          // Ensure matchingGenre is in allowedGenres
          const finalAllowedGenres = [...allowedGenres, matchingGenre];
          
          const config = {
            allowedGenres: finalAllowedGenres,
            enableGenreFilter: true,
            allowedAuthors: [],
            enableAuthorFilter: false
          };
          
          const result = checkGenreFilter(bookGenres, config);
          
          // PROPERTY ASSERTION: Must pass because at least one genre matches
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre filter fails when NO book genres match allowed genres
   */
  it('Property 1d: Filter fails when NO book genres match allowed genres', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(PRIMARY_GENRES, { minLength: 2, maxLength: PRIMARY_GENRES.length }),
        fc.integer({ min: 1, max: 3 }),
        (shuffledGenres, splitPoint) => {
          // Split genres into two disjoint sets
          const bookGenres = shuffledGenres.slice(0, splitPoint);
          const allowedGenres = shuffledGenres.slice(splitPoint, splitPoint + 3);
          
          // Skip if sets overlap (edge case)
          const hasOverlap = bookGenres.some(bg => 
            allowedGenres.some(ag => ag.toLowerCase() === bg.toLowerCase())
          );
          
          if (hasOverlap || allowedGenres.length === 0) {
            return; // Skip this test case
          }
          
          const config = {
            allowedGenres,
            enableGenreFilter: true,
            allowedAuthors: [],
            enableAuthorFilter: false
          };
          
          const result = checkGenreFilter(bookGenres, config);
          
          // PROPERTY ASSERTION: Must fail because no genres match
          expect(result.passed).toBe(false);
          expect(result.reason).toContain('Genre not in allowed list');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre filter with empty book genres always fails (when filter is active)
   */
  it('Property 1e: Filter fails for books with no genres when filter is active', () => {
    fc.assert(
      fc.property(
        allowedGenresArb,
        (allowedGenres) => {
          const config = {
            allowedGenres,
            enableGenreFilter: true,
            allowedAuthors: [],
            enableAuthorFilter: false
          };
          
          // Test with empty array
          const result1 = checkGenreFilter([], config);
          expect(result1.passed).toBe(false);
          expect(result1.reason).toBe('Book has no genres');
          
          // Test with null
          const result2 = checkGenreFilter(null as any, config);
          expect(result2.passed).toBe(false);
          expect(result2.reason).toBe('Book has no genres');
          
          // Test with undefined
          const result3 = checkGenreFilter(undefined as any, config);
          expect(result3.passed).toBe(false);
          expect(result3.reason).toBe('Book has no genres');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre filter is deterministic (same input always produces same output)
   */
  it('Property 1f: Genre filter is deterministic', () => {
    fc.assert(
      fc.property(
        genresArrayArb,
        activeGenreFilterConfigArb,
        (bookGenres, config) => {
          // Call checkGenreFilter twice with same inputs
          const result1 = checkGenreFilter(bookGenres, config);
          const result2 = checkGenreFilter(bookGenres, config);
          
          // PROPERTY ASSERTION: Results must be identical
          expect(result1.passed).toBe(result2.passed);
          expect(result1.reason).toBe(result2.reason);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre filter result structure is always valid
   */
  it('Property 1g: Genre filter always returns valid result structure', () => {
    fc.assert(
      fc.property(
        fc.oneof(genresArrayArb, fc.constant([])),
        fc.oneof(activeGenreFilterConfigArb, emptyGenreFilterConfigArb, disabledGenreFilterConfigArb),
        (bookGenres, config) => {
          const result = checkGenreFilter(bookGenres, config);
          
          // PROPERTY ASSERTION: Result must have 'passed' boolean
          expect(typeof result.passed).toBe('boolean');
          
          // PROPERTY ASSERTION: If failed, must have reason
          if (!result.passed) {
            expect(typeof result.reason).toBe('string');
            expect(result.reason!.length).toBeGreaterThan(0);
          }
          
          // PROPERTY ASSERTION: If passed, reason should be undefined
          if (result.passed) {
            expect(result.reason).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre filter with single matching genre always passes
   */
  it('Property 1h: Filter passes when book has exactly one matching genre', () => {
    fc.assert(
      fc.property(
        validGenreArb,
        allowedGenresArb,
        (matchingGenre, otherAllowedGenres) => {
          // Ensure matchingGenre is in allowed list
          const allowedGenres = [...otherAllowedGenres, matchingGenre];
          
          const config = {
            allowedGenres,
            enableGenreFilter: true,
            allowedAuthors: [],
            enableAuthorFilter: false
          };
          
          // Book has only the matching genre
          const result = checkGenreFilter([matchingGenre], config);
          
          // PROPERTY ASSERTION: Must pass
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Genre filter order independence (order of genres doesn't matter)
   */
  it('Property 1i: Filter result is independent of genre order', () => {
    fc.assert(
      fc.property(
        fc.array(validGenreArb, { minLength: 2, maxLength: 3 }),
        allowedGenresArb,
        (bookGenres, allowedGenres) => {
          // Remove duplicates
          const uniqueBookGenres = [...new Set(bookGenres)];
          
          if (uniqueBookGenres.length < 2) {
            return; // Skip if not enough unique genres
          }
          
          const config = {
            allowedGenres,
            enableGenreFilter: true,
            allowedAuthors: [],
            enableAuthorFilter: false
          };
          
          // Test with original order
          const result1 = checkGenreFilter(uniqueBookGenres, config);
          
          // Test with reversed order
          const reversedGenres = [...uniqueBookGenres].reverse();
          const result2 = checkGenreFilter(reversedGenres, config);
          
          // PROPERTY ASSERTION: Results must be the same
          expect(result1.passed).toBe(result2.passed);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty allowed genres with disabled filter still allows all
   */
  it('Property 2a: Empty allowed genres with disabled filter allows all', () => {
    fc.assert(
      fc.property(
        genresArrayArb,
        (bookGenres) => {
          const config = {
            allowedGenres: [],
            enableGenreFilter: false,
            allowedAuthors: [],
            enableAuthorFilter: false
          };
          
          const result = checkGenreFilter(bookGenres, config);
          
          // PROPERTY ASSERTION: Must pass
          expect(result.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
