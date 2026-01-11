/**
 * Property-Based Tests for PDF URL Construction
 * **Feature: public-domain-book-ingestion, Property 1: PDF URL Construction**
 * **Validates: Requirements 1.4**
 * 
 * This test verifies that for any valid Internet Archive identifier,
 * the constructed PDF URL follows the pattern:
 * https://archive.org/download/{identifier}/{identifier}.pdf
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Import the function under test
import { getPdfUrl } from '../../services/ingestion/internetArchiveFetcher.js';

/**
 * Generator for valid Internet Archive identifiers
 * Internet Archive identifiers typically:
 * - Contain alphanumeric characters, underscores, and hyphens
 * - Are between 1 and 200 characters
 * - Don't contain spaces or special URL characters
 */
const validIdentifierArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

describe('PDF URL Construction - Property Tests', () => {
  /**
   * **Feature: public-domain-book-ingestion, Property 1: PDF URL Construction**
   * **Validates: Requirements 1.4**
   * 
   * Property: For any valid Internet Archive identifier, the constructed PDF URL
   * SHALL follow the pattern https://archive.org/download/{identifier}/{identifier}.pdf
   */
  it('Property 1: PDF URL follows correct pattern for any valid identifier', () => {
    fc.assert(
      fc.property(validIdentifierArb, (identifier) => {
        const url = getPdfUrl(identifier);
        
        // PROPERTY ASSERTION 1: URL should start with the correct base
        expect(url.startsWith('https://archive.org/download/')).toBe(true);
        
        // PROPERTY ASSERTION 2: URL should end with .pdf
        expect(url.endsWith('.pdf')).toBe(true);
        
        // PROPERTY ASSERTION 3: URL should contain the identifier twice
        // (once in the path, once in the filename)
        const expectedUrl = `https://archive.org/download/${identifier}/${identifier}.pdf`;
        expect(url).toBe(expectedUrl);
        
        // PROPERTY ASSERTION 4: URL should be a valid URL
        expect(() => new URL(url)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: The identifier appears exactly twice in the URL path
   * (once as directory, once as filename)
   */
  it('Property 1b: Identifier appears exactly twice in URL path', () => {
    fc.assert(
      fc.property(validIdentifierArb, (identifier) => {
        const url = getPdfUrl(identifier);
        
        // Remove the base URL to get just the path
        const path = url.replace('https://archive.org/download/', '');
        
        // The path should be exactly: {identifier}/{identifier}.pdf
        const expectedPath = `${identifier}/${identifier}.pdf`;
        expect(path).toBe(expectedPath);
        
        // Verify the structure: directory/filename.pdf
        const pathParts = path.split('/');
        expect(pathParts.length).toBe(2);
        expect(pathParts[0]).toBe(identifier); // directory name
        expect(pathParts[1]).toBe(`${identifier}.pdf`); // filename
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: URL is deterministic - same identifier always produces same URL
   */
  it('Property 1c: URL construction is deterministic', () => {
    fc.assert(
      fc.property(validIdentifierArb, (identifier) => {
        const url1 = getPdfUrl(identifier);
        const url2 = getPdfUrl(identifier);
        
        expect(url1).toBe(url2);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: Function should throw for invalid identifiers
   */
  it('throws error for empty string identifier', () => {
    expect(() => getPdfUrl('')).toThrow('Invalid identifier');
  });

  it('throws error for null identifier', () => {
    expect(() => getPdfUrl(null)).toThrow('Invalid identifier');
  });

  it('throws error for undefined identifier', () => {
    expect(() => getPdfUrl(undefined)).toThrow('Invalid identifier');
  });
});
