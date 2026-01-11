/**
 * Property Tests for Genre Taxonomy Validation
 * 
 * Feature: ai-genre-classification
 * Property 1: Taxonomy Enforcement
 * Validates: Requirements 2.1, 2.2, 2.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  PRIMARY_GENRES,
  SUB_GENRES,
  validateGenre,
  validateGenres,
  validateSubgenre,
  isValidGenre,
  isValidSubgenre
} from '../../services/ingestion/genreTaxonomy.js';

describe('Genre Taxonomy Validation - Property Tests', () => {
  
  /**
   * Property 1a: Valid genres are accepted
   * For any genre from PRIMARY_GENRES, validateGenre returns the normalized form
   */
  it('Property 1a: Valid primary genres are accepted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PRIMARY_GENRES),
        (genre) => {
          const result = validateGenre(genre);
          expect(result).toBe(genre);
          expect(isValidGenre(genre)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1b: Case-insensitive matching works
   * For any genre, uppercase/lowercase variants should match
   */
  it('Property 1b: Genre validation is case-insensitive', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PRIMARY_GENRES),
        fc.constantFrom('upper', 'lower', 'mixed'),
        (genre, caseType) => {
          let testGenre: string;
          switch (caseType) {
            case 'upper':
              testGenre = genre.toUpperCase();
              break;
            case 'lower':
              testGenre = genre.toLowerCase();
              break;
            default:
              // Mixed case - alternate characters
              testGenre = genre.split('').map((c, i) => 
                i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
              ).join('');
          }
          
          const result = validateGenre(testGenre);
          expect(result).toBe(genre); // Returns normalized form
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1c: Invalid genres are rejected
   * For any string not in PRIMARY_GENRES, validateGenre returns null
   */
  it('Property 1c: Invalid genres are rejected', () => {
    const invalidGenres = [
      'InvalidGenre',
      'NotAGenre',
      'Fiction',
      'Non-Fiction',
      'Romance',
      'Thriller',
      'Horror',
      'Fantasy',
      'Sci-Fi',
      ''
    ];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...invalidGenres),
        (genre) => {
          const result = validateGenre(genre);
          expect(result).toBeNull();
          expect(isValidGenre(genre)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1d: Valid sub-genres are accepted
   * For any sub-genre from SUB_GENRES, validateSubgenre returns the normalized form
   */
  it('Property 1d: Valid sub-genres are accepted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SUB_GENRES),
        (subgenre) => {
          const result = validateSubgenre(subgenre);
          expect(result).toBe(subgenre);
          expect(isValidSubgenre(subgenre)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1e: Sub-genre validation is case-insensitive
   */
  it('Property 1e: Sub-genre validation is case-insensitive', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SUB_GENRES),
        (subgenre) => {
          const upperResult = validateSubgenre(subgenre.toUpperCase());
          const lowerResult = validateSubgenre(subgenre.toLowerCase());
          
          expect(upperResult).toBe(subgenre);
          expect(lowerResult).toBe(subgenre);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1f: Invalid sub-genres are rejected
   */
  it('Property 1f: Invalid sub-genres are rejected', () => {
    const invalidSubgenres = [
      'Modern',
      'Contemporary',
      'Postmodern',
      'Digital',
      'Invalid',
      ''
    ];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...invalidSubgenres),
        (subgenre) => {
          const result = validateSubgenre(subgenre);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Genre count bounds
   * validateGenres returns at most 3 genres
   */
  it('Property 2: validateGenres returns at most 3 genres', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 10 }),
        (genres) => {
          const result = validateGenres(genres);
          expect(result.length).toBeLessThanOrEqual(3);
          expect(result.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Filtering removes invalid genres
   * validateGenres only returns genres from PRIMARY_GENRES
   */
  it('Property 3: validateGenres filters out invalid genres', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constantFrom(...PRIMARY_GENRES),
            fc.constant('InvalidGenre'),
            fc.constant('NotReal')
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (mixedGenres) => {
          const result = validateGenres(mixedGenres);
          
          // All results must be valid genres
          for (const genre of result) {
            expect(PRIMARY_GENRES).toContain(genre);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Duplicate genres are removed
   */
  it('Property 4: validateGenres removes duplicate genres', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PRIMARY_GENRES),
        (genre) => {
          const duplicates = [genre, genre, genre, genre];
          const result = validateGenres(duplicates);
          
          expect(result.length).toBe(1);
          expect(result[0]).toBe(genre);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Empty array returns empty
   */
  it('Property 5: validateGenres handles empty input', () => {
    expect(validateGenres([])).toEqual([]);
    expect(validateGenres(null as any)).toEqual([]);
    expect(validateGenres(undefined as any)).toEqual([]);
  });

  /**
   * Property 6: Null/undefined handling
   */
  it('Property 6: Null and undefined inputs are handled gracefully', () => {
    expect(validateGenre(null as any)).toBeNull();
    expect(validateGenre(undefined as any)).toBeNull();
    expect(validateGenre('')).toBeNull();
    
    expect(validateSubgenre(null as any)).toBeNull();
    expect(validateSubgenre(undefined as any)).toBeNull();
    expect(validateSubgenre('')).toBeNull();
  });
});
