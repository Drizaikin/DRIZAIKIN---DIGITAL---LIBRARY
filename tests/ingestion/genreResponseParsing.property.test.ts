/**
 * Property Tests for Genre Response Parsing
 * 
 * Feature: ai-genre-classification
 * Property 6: Response Format Validation
 * Validates: Requirements 6.2, 6.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseResponse, buildPrompt } from '../../services/ingestion/genreClassifier.js';
import { PRIMARY_GENRES, SUB_GENRES } from '../../services/ingestion/genreTaxonomy.js';

describe('Genre Response Parsing - Property Tests', () => {
  
  /**
   * Property 6a: Valid JSON with valid genres is accepted
   */
  it('Property 6a: Valid JSON with valid genres is parsed correctly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...PRIMARY_GENRES), { minLength: 1, maxLength: 3 }),
        fc.option(fc.constantFrom(...SUB_GENRES), { nil: undefined }),
        (genres, subgenre) => {
          const response = JSON.stringify({
            genres: genres,
            subgenre: subgenre || null
          });
          
          const result = parseResponse(response);
          
          expect(result).not.toBeNull();
          expect(result!.genres.length).toBeGreaterThanOrEqual(1);
          expect(result!.genres.length).toBeLessThanOrEqual(3);
          
          // All genres should be valid
          for (const genre of result!.genres) {
            expect(PRIMARY_GENRES).toContain(genre);
          }
          
          // Subgenre should be valid or null
          if (result!.subgenre) {
            expect(SUB_GENRES).toContain(result!.subgenre);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6b: Invalid JSON is rejected
   */
  it('Property 6b: Invalid JSON is rejected', () => {
    const invalidResponses = [
      'not json at all',
      '{ invalid json }',
      '{"genres": }',
      'undefined',
      '',
      '   ',
      'null'
    ];
    
    for (const response of invalidResponses) {
      const result = parseResponse(response);
      expect(result).toBeNull();
    }
  });

  /**
   * Property 6c: JSON without genres array is rejected
   */
  it('Property 6c: JSON without genres array is rejected', () => {
    const invalidStructures = [
      '{"subgenre": "Ancient"}',
      '{"genre": "Philosophy"}',
      '{"genres": "Philosophy"}', // String instead of array
      '{"genres": null}',
      '{}',
      '{"other": "field"}'
    ];
    
    for (const response of invalidStructures) {
      const result = parseResponse(response);
      expect(result).toBeNull();
    }
  });

  /**
   * Property 6d: JSON with all invalid genres returns null
   */
  it('Property 6d: JSON with all invalid genres returns null', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constant('InvalidGenre'), { minLength: 1, maxLength: 3 }),
        (invalidGenres) => {
          const response = JSON.stringify({
            genres: invalidGenres,
            subgenre: null
          });
          
          const result = parseResponse(response);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6e: Mixed valid/invalid genres filters correctly
   */
  it('Property 6e: Mixed valid/invalid genres filters correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PRIMARY_GENRES),
        (validGenre) => {
          const response = JSON.stringify({
            genres: ['InvalidGenre1', validGenre, 'InvalidGenre2'],
            subgenre: null
          });
          
          const result = parseResponse(response);
          
          expect(result).not.toBeNull();
          expect(result!.genres).toContain(validGenre);
          expect(result!.genres).not.toContain('InvalidGenre1');
          expect(result!.genres).not.toContain('InvalidGenre2');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6f: JSON embedded in text is extracted
   */
  it('Property 6f: JSON embedded in text is extracted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PRIMARY_GENRES),
        (genre) => {
          const responses = [
            `Here is the classification: {"genres": ["${genre}"], "subgenre": null}`,
            `{"genres": ["${genre}"], "subgenre": null} is my answer`,
            `Based on analysis, {"genres": ["${genre}"], "subgenre": "Ancient"} seems appropriate.`
          ];
          
          for (const response of responses) {
            const result = parseResponse(response);
            expect(result).not.toBeNull();
            expect(result!.genres).toContain(genre);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6g: Null and undefined inputs are handled
   */
  it('Property 6g: Null and undefined inputs are handled gracefully', () => {
    expect(parseResponse(null as any)).toBeNull();
    expect(parseResponse(undefined as any)).toBeNull();
    expect(parseResponse('')).toBeNull();
  });

  /**
   * Property 6h: buildPrompt includes all required fields
   */
  it('Property 6h: buildPrompt includes book metadata and taxonomy', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          author: fc.string({ minLength: 1, maxLength: 50 }),
          year: fc.option(fc.integer({ min: 1000, max: 1927 }), { nil: undefined }),
          description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined })
        }),
        (book) => {
          const prompt = buildPrompt(book);
          
          // Should contain book info
          expect(prompt).toContain(book.title);
          expect(prompt).toContain(book.author);
          
          // Should contain taxonomy
          expect(prompt).toContain('Philosophy');
          expect(prompt).toContain('Religion');
          expect(prompt).toContain('Ancient');
          expect(prompt).toContain('Medieval');
          
          // Should contain format instructions
          expect(prompt).toContain('JSON');
          expect(prompt).toContain('genres');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6i: Genre count is limited to 3
   */
  it('Property 6i: More than 3 genres are truncated to 3', () => {
    const response = JSON.stringify({
      genres: ['Philosophy', 'Religion', 'History', 'Science', 'Literature'],
      subgenre: null
    });
    
    const result = parseResponse(response);
    
    expect(result).not.toBeNull();
    expect(result!.genres.length).toBe(3);
  });
});
