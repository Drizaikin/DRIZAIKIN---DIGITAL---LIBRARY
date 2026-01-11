/**
 * Property-Based Tests for Filename Sanitization
 * **Feature: public-domain-book-ingestion, Property 2: Filename Sanitization Produces Safe Paths**
 * **Validates: Requirements 4.4, 5.2**
 * 
 * This test verifies that for any input string (identifier), the sanitized filename:
 * - Contains only alphanumeric characters, hyphens, and underscores
 * - Does not contain path traversal sequences (../, ..\)
 * - Does not exceed 200 characters in length
 * - Produces a valid storage path when combined with the bucket structure
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Import the functions under test
import { sanitizeFilename, isValidFilename, MAX_FILENAME_LENGTH } from '../../services/ingestion/pdfValidator.js';

// Safe filename pattern
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]+$/;

describe('Filename Sanitization - Property Tests', () => {
  /**
   * **Feature: public-domain-book-ingestion, Property 2: Filename Sanitization Produces Safe Paths**
   * **Validates: Requirements 4.4, 5.2**
   * 
   * Property: For any input string, the sanitized filename SHALL contain only
   * alphanumeric characters, hyphens, and underscores.
   */
  it('Property 2a: Sanitized filename contains only safe characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (input) => {
          const sanitized = sanitizeFilename(input);
          
          // PROPERTY ASSERTION: Result should only contain safe characters
          expect(SAFE_FILENAME_REGEX.test(sanitized)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sanitized filename does not contain path traversal sequences
   */
  it('Property 2b: Sanitized filename has no path traversal sequences', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (input) => {
          const sanitized = sanitizeFilename(input);
          
          // PROPERTY ASSERTION: No path traversal sequences
          expect(sanitized.includes('..')).toBe(false);
          expect(sanitized.includes('/')).toBe(false);
          expect(sanitized.includes('\\')).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sanitized filename does not exceed maximum length
   */
  it('Property 2c: Sanitized filename respects maximum length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1000 }),
        (input) => {
          const sanitized = sanitizeFilename(input);
          
          // PROPERTY ASSERTION: Length should not exceed MAX_FILENAME_LENGTH
          expect(sanitized.length).toBeLessThanOrEqual(MAX_FILENAME_LENGTH);
          expect(sanitized.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sanitized filename produces valid storage path
   */
  it('Property 2d: Sanitized filename produces valid storage path', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (input) => {
          const sanitized = sanitizeFilename(input);
          
          // Construct the full storage path
          const storagePath = `internet_archive/${sanitized}.pdf`;
          
          // PROPERTY ASSERTION: Path should be valid
          expect(storagePath.includes('..')).toBe(false);
          expect(storagePath.includes('//')).toBe(false);
          expect(storagePath.startsWith('internet_archive/')).toBe(true);
          expect(storagePath.endsWith('.pdf')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: isValidFilename correctly validates sanitized filenames
   */
  it('Property 2e: isValidFilename accepts all sanitized filenames', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (input) => {
          const sanitized = sanitizeFilename(input);
          
          // PROPERTY ASSERTION: Sanitized filename should pass validation
          expect(isValidFilename(sanitized)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sanitization is idempotent - sanitizing twice gives same result
   */
  it('Property 2f: Sanitization is idempotent', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (input) => {
          const sanitized1 = sanitizeFilename(input);
          const sanitized2 = sanitizeFilename(sanitized1);
          
          // PROPERTY ASSERTION: Sanitizing twice should give same result
          expect(sanitized2).toBe(sanitized1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: Path traversal attempts should be neutralized
   */
  it('neutralizes path traversal attempts', () => {
    const maliciousInputs = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      'foo/../bar',
      'foo/./bar',
      '....//....//etc',
      'valid_name/../../../secret'
    ];

    for (const input of maliciousInputs) {
      const sanitized = sanitizeFilename(input);
      expect(sanitized.includes('..')).toBe(false);
      expect(sanitized.includes('/')).toBe(false);
      expect(sanitized.includes('\\')).toBe(false);
      expect(isValidFilename(sanitized)).toBe(true);
    }
  });

  /**
   * Edge case: Special characters should be replaced
   */
  it('replaces special characters with underscores', () => {
    const specialInputs = [
      'hello world',
      'file@name#test',
      'book (2023)',
      'test<script>alert</script>',
      'name$with%special^chars'
    ];

    for (const input of specialInputs) {
      const sanitized = sanitizeFilename(input);
      expect(SAFE_FILENAME_REGEX.test(sanitized)).toBe(true);
    }
  });

  /**
   * Edge case: Empty or whitespace-only input
   */
  it('handles empty or whitespace-only input', () => {
    expect(() => sanitizeFilename('')).toThrow('Invalid identifier');
    
    // Whitespace-only should produce 'unnamed' after sanitization
    const whitespaceResult = sanitizeFilename('   ');
    expect(whitespaceResult).toBe('unnamed');
    expect(isValidFilename(whitespaceResult)).toBe(true);
  });
});
