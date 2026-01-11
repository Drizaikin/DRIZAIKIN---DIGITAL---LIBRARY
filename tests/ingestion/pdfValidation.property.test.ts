/**
 * Property-Based Tests for PDF Validation
 * **Feature: public-domain-book-ingestion, Property 7: Empty or Invalid PDFs Are Rejected**
 * **Validates: Requirements 4.2, 4.3**
 * 
 * This test verifies that for any PDF download that returns:
 * - Empty content (0 bytes)
 * - Non-PDF content (missing PDF header)
 * 
 * The validator SHALL return null/failure and the book SHALL be counted as "failed"
 * without database insertion.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Import the functions under test
import { isValidPdf, PDF_MAGIC_BYTES } from '../../services/ingestion/pdfValidator.js';

// Valid PDF magic bytes: %PDF
const VALID_PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

describe('PDF Validation - Property Tests', () => {
  /**
   * **Feature: public-domain-book-ingestion, Property 7: Empty or Invalid PDFs Are Rejected**
   * **Validates: Requirements 4.2, 4.3**
   * 
   * Property: For any empty buffer (0 bytes), isValidPdf SHALL return false.
   */
  it('Property 7a: Empty buffers are rejected', () => {
    // Empty buffer
    expect(isValidPdf(Buffer.alloc(0))).toBe(false);
    expect(isValidPdf(new Uint8Array(0))).toBe(false);
    
    // Null/undefined
    expect(isValidPdf(null as any)).toBe(false);
    expect(isValidPdf(undefined as any)).toBe(false);
  });

  /**
   * Property: For any buffer that doesn't start with PDF magic bytes,
   * isValidPdf SHALL return false.
   */
  it('Property 7b: Non-PDF content is rejected', () => {
    fc.assert(
      fc.property(
        // Generate random bytes that don't start with %PDF
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 1000 })
          .filter(bytes => {
            // Filter out arrays that happen to start with PDF magic bytes
            if (bytes.length < 4) return true;
            return !(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46);
          }),
        (bytes) => {
          const buffer = Buffer.from(bytes);
          
          // PROPERTY ASSERTION: Non-PDF content should be rejected
          expect(isValidPdf(buffer)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any buffer that starts with valid PDF magic bytes,
   * isValidPdf SHALL return true.
   */
  it('Property 7c: Valid PDF headers are accepted', () => {
    fc.assert(
      fc.property(
        // Generate random content after the PDF header
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 0, maxLength: 1000 }),
        (contentBytes) => {
          // Create buffer with valid PDF header + random content
          const buffer = Buffer.concat([
            VALID_PDF_HEADER,
            Buffer.from(contentBytes)
          ]);
          
          // PROPERTY ASSERTION: Valid PDF header should be accepted
          expect(isValidPdf(buffer)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Buffers shorter than 4 bytes cannot be valid PDFs
   */
  it('Property 7d: Buffers shorter than 4 bytes are rejected', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 3 }),
        (bytes) => {
          const buffer = Buffer.from(bytes);
          
          // PROPERTY ASSERTION: Short buffers should be rejected
          expect(isValidPdf(buffer)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Partial PDF headers are rejected
   */
  it('Property 7e: Partial PDF headers are rejected', () => {
    // Test each partial header
    const partialHeaders = [
      [0x25],                     // Just %
      [0x25, 0x50],               // %P
      [0x25, 0x50, 0x44],         // %PD
    ];

    for (const partial of partialHeaders) {
      const buffer = Buffer.from(partial);
      expect(isValidPdf(buffer)).toBe(false);
    }
  });

  /**
   * Property: Wrong magic bytes are rejected even if similar
   */
  it('Property 7f: Similar but wrong magic bytes are rejected', () => {
    fc.assert(
      fc.property(
        // Generate 4 bytes that are close to but not exactly PDF magic bytes
        fc.tuple(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 })
        ).filter(([a, b, c, d]) => {
          // Filter out the exact PDF magic bytes
          return !(a === 0x25 && b === 0x50 && c === 0x44 && d === 0x46);
        }),
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 0, maxLength: 100 }),
        ([a, b, c, d], rest) => {
          const buffer = Buffer.from([a, b, c, d, ...rest]);
          
          // PROPERTY ASSERTION: Wrong magic bytes should be rejected
          expect(isValidPdf(buffer)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: Common non-PDF file types should be rejected
   */
  it('rejects common non-PDF file types', () => {
    const nonPdfHeaders = [
      // PNG
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      // JPEG
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),
      // GIF
      Buffer.from([0x47, 0x49, 0x46, 0x38]),
      // ZIP
      Buffer.from([0x50, 0x4B, 0x03, 0x04]),
      // HTML
      Buffer.from('<html>'),
      // Plain text
      Buffer.from('Hello, World!'),
      // JSON
      Buffer.from('{"key": "value"}'),
    ];

    for (const header of nonPdfHeaders) {
      expect(isValidPdf(header)).toBe(false);
    }
  });

  /**
   * Edge case: Valid PDF with various content lengths
   */
  it('accepts valid PDFs of various sizes', () => {
    const sizes = [4, 10, 100, 1000, 10000];
    
    for (const size of sizes) {
      const content = Buffer.alloc(size - 4); // Subtract header size
      const buffer = Buffer.concat([VALID_PDF_HEADER, content]);
      
      expect(isValidPdf(buffer)).toBe(true);
    }
  });
});
