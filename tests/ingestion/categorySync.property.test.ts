/**
 * Property-Based Tests for Category Sync
 * **Feature: ingestion-filtering, Property 12: Category Sync with First Genre**
 * **Feature: ingestion-filtering, Property 13: Uncategorized Default**
 * **Validates: Requirements 5.4.1, 5.4.2, 5.4.5, 5.5.3**
 * 
 * This test verifies that:
 * - For any book with genres array G (where G is non-empty), the category field SHALL equal G[0]
 * - For any book with empty or null genres array, the category field SHALL be set to "Uncategorized"
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { syncCategory } from '../../services/ingestion/databaseWriter.js';
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
 * Generator for empty genres arrays (various forms)
 */
const emptyGenresArb = fc.constantFrom(
  [],
  null,
  undefined
);

describe('Category Sync - Property Tests', () => {
  /**
   * **Feature: ingestion-filtering, Property 12: Category Sync with First Genre**
   * **Validates: Requirements 5.4.1, 5.4.2, 5.4.5**
   * 
   * Property: For any book with genres array G (where G is non-empty),
   * the category field SHALL equal G[0]
   */
  it('Property 12: Category syncs with first genre for any non-empty genres array', () => {
    fc.assert(
      fc.property(
        genresArrayArb,
        (genres) => {
          // Call syncCategory with the generated genres array
          const category = syncCategory(genres);
          
          // PROPERTY ASSERTION: Category must equal the first genre
          expect(category).toBe(genres[0]);
          
          // ADDITIONAL ASSERTION: Category must be a valid genre from taxonomy
          expect(PRIMARY_GENRES).toContain(category);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ingestion-filtering, Property 13: Uncategorized Default**
   * **Validates: Requirements 5.4.1, 5.4.2, 5.4.5, 5.5.3**
   * 
   * Property: For any book with empty or null genres array,
   * the category field SHALL be set to "Uncategorized"
   */
  it('Property 13: Category is "Uncategorized" for any empty or null genres', () => {
    fc.assert(
      fc.property(
        emptyGenresArb,
        (genres) => {
          // Call syncCategory with empty/null genres
          const category = syncCategory(genres);
          
          // PROPERTY ASSERTION: Category must be "Uncategorized"
          expect(category).toBe('Uncategorized');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Category sync is deterministic (same input always produces same output)
   */
  it('Property 12a: Category sync is deterministic', () => {
    fc.assert(
      fc.property(
        fc.oneof(genresArrayArb, emptyGenresArb),
        (genres) => {
          // Call syncCategory twice with same input
          const category1 = syncCategory(genres);
          const category2 = syncCategory(genres);
          
          // PROPERTY ASSERTION: Results must be identical
          expect(category1).toBe(category2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Category sync only depends on first genre (rest are ignored)
   */
  it('Property 12b: Category sync only depends on first genre', () => {
    fc.assert(
      fc.property(
        validGenreArb,
        fc.array(validGenreArb, { minLength: 0, maxLength: 2 }),
        (firstGenre, restGenres) => {
          // Create two arrays with same first genre but different rest
          const genres1 = [firstGenre, ...restGenres];
          const genres2 = [firstGenre]; // Only first genre
          
          // Call syncCategory on both
          const category1 = syncCategory(genres1);
          const category2 = syncCategory(genres2);
          
          // PROPERTY ASSERTION: Both must produce same category
          expect(category1).toBe(category2);
          expect(category1).toBe(firstGenre);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Category sync preserves genre string exactly (no transformation)
   */
  it('Property 12c: Category sync preserves first genre exactly', () => {
    fc.assert(
      fc.property(
        genresArrayArb,
        (genres) => {
          const category = syncCategory(genres);
          const firstGenre = genres[0];
          
          // PROPERTY ASSERTION: Category must be exactly equal (no case change, trim, etc.)
          expect(category).toBe(firstGenre);
          expect(category.length).toBe(firstGenre.length);
          
          // Character-by-character comparison
          for (let i = 0; i < category.length; i++) {
            expect(category[i]).toBe(firstGenre[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Category sync handles all valid genre combinations
   */
  it('Property 12d: Category sync handles all valid genre combinations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.shuffledSubarray(PRIMARY_GENRES, { minLength: 1, maxLength: 3 }),
        (numGenres, shuffledGenres) => {
          // Take exactly numGenres from shuffled array
          const genres = shuffledGenres.slice(0, numGenres);
          
          const category = syncCategory(genres);
          
          // PROPERTY ASSERTION: Category is the first genre
          expect(category).toBe(genres[0]);
          
          // PROPERTY ASSERTION: Category is from the taxonomy
          expect(PRIMARY_GENRES).toContain(category);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty array always produces "Uncategorized" regardless of array type
   */
  it('Property 13a: Empty arrays always produce "Uncategorized"', () => {
    fc.assert(
      fc.property(
        fc.constant([]),
        (emptyArray) => {
          const category = syncCategory(emptyArray);
          
          // PROPERTY ASSERTION: Must be "Uncategorized"
          expect(category).toBe('Uncategorized');
          
          // PROPERTY ASSERTION: Must be exactly this string
          expect(category.length).toBe('Uncategorized'.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Category sync result is always a non-empty string
   */
  it('Property 12e: Category sync always returns non-empty string', () => {
    fc.assert(
      fc.property(
        fc.oneof(genresArrayArb, emptyGenresArb),
        (genres) => {
          const category = syncCategory(genres);
          
          // PROPERTY ASSERTION: Result is a string
          expect(typeof category).toBe('string');
          
          // PROPERTY ASSERTION: Result is non-empty
          expect(category.length).toBeGreaterThan(0);
          
          // PROPERTY ASSERTION: Result is either a valid genre or "Uncategorized"
          const isValid = PRIMARY_GENRES.includes(category) || category === 'Uncategorized';
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
