/**
 * Property-Based Tests for PDF Validation
 * **Feature: ai-book-extraction, Property 2: PDF Validation**
 * **Validates: Requirements 1.2**
 * 
 * This test verifies that the PDF crawler only queues files that are valid PDF documents,
 * verified by content-type header or file extension (.pdf).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isPdfUrl,
  filterPdfLinks,
  extractLinksFromHtml,
  toAbsoluteUrl
} from '../../services/pdfCrawlerService';

// Common file extensions that are NOT PDFs
const NON_PDF_EXTENSIONS = [
  '.html', '.htm', '.txt', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
  '.mp3', '.mp4', '.avi', '.mov', '.zip', '.rar',
  '.js', '.css', '.json', '.xml', '.csv', '.md'
];

// Valid PDF content types
const PDF_CONTENT_TYPES = [
  'application/pdf',
  'application/PDF',
  'APPLICATION/PDF',
  'application/pdf; charset=utf-8',
  'application/pdf;charset=binary'
];

// Non-PDF content types
const NON_PDF_CONTENT_TYPES = [
  'text/html',
  'text/plain',
  'application/json',
  'application/xml',
  'image/jpeg',
  'image/png',
  'application/octet-stream',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Arbitrary generators
const urlPathSegmentArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z0-9_-]+$/.test(s));

const domainArb = fc.tuple(
  fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[a-z0-9]+$/.test(s)),
  fc.constantFrom('.com', '.org', '.net', '.edu', '.io', '.co.uk')
).map(([name, tld]) => `${name}${tld}`);

const baseUrlArb = fc.tuple(
  fc.constantFrom('http://', 'https://'),
  domainArb
).map(([protocol, domain]) => `${protocol}${domain}`);

describe('PDF Validation - Property Tests', () => {
  /**
   * **Feature: ai-book-extraction, Property 2: PDF Validation**
   * **Validates: Requirements 1.2**
   * 
   * Property: For any URL ending with .pdf extension, isPdfUrl SHALL return true.
   */
  it('Property 2: URLs with .pdf extension are identified as PDFs', () => {
    fc.assert(
      fc.property(
        baseUrlArb,
        fc.array(urlPathSegmentArb, { minLength: 0, maxLength: 5 }),
        urlPathSegmentArb,
        (baseUrl, pathSegments, filename) => {
          const path = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '';
          const pdfUrl = `${baseUrl}${path}/${filename}.pdf`;
          
          // PROPERTY ASSERTION: URLs ending in .pdf must be identified as PDFs
          expect(isPdfUrl(pdfUrl)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 2: PDF Validation**
   * **Validates: Requirements 1.2**
   * 
   * Property: For any URL ending with .PDF (uppercase) extension, isPdfUrl SHALL return true.
   */
  it('Property 2: URLs with .PDF (uppercase) extension are identified as PDFs', () => {
    fc.assert(
      fc.property(
        baseUrlArb,
        fc.array(urlPathSegmentArb, { minLength: 0, maxLength: 5 }),
        urlPathSegmentArb,
        (baseUrl, pathSegments, filename) => {
          const path = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '';
          const pdfUrl = `${baseUrl}${path}/${filename}.PDF`;
          
          // PROPERTY ASSERTION: URLs ending in .PDF (uppercase) must be identified as PDFs
          expect(isPdfUrl(pdfUrl)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 2: PDF Validation**
   * **Validates: Requirements 1.2**
   * 
   * Property: For any URL with application/pdf content-type, isPdfUrl SHALL return true
   * regardless of file extension.
   */
  it('Property 2: URLs with application/pdf content-type are identified as PDFs', () => {
    fc.assert(
      fc.property(
        baseUrlArb,
        fc.array(urlPathSegmentArb, { minLength: 0, maxLength: 5 }),
        urlPathSegmentArb,
        fc.constantFrom(...NON_PDF_EXTENSIONS),
        fc.constantFrom(...PDF_CONTENT_TYPES),
        (baseUrl, pathSegments, filename, extension, contentType) => {
          const path = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '';
          // URL with non-PDF extension but PDF content-type
          const url = `${baseUrl}${path}/${filename}${extension}`;
          
          // PROPERTY ASSERTION: URLs with PDF content-type must be identified as PDFs
          expect(isPdfUrl(url, contentType)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 2: PDF Validation**
   * **Validates: Requirements 1.2**
   * 
   * Property: For any URL without .pdf extension AND without PDF content-type,
   * isPdfUrl SHALL return false.
   */
  it('Property 2: URLs without .pdf extension and without PDF content-type are NOT identified as PDFs', () => {
    fc.assert(
      fc.property(
        baseUrlArb,
        fc.array(urlPathSegmentArb, { minLength: 0, maxLength: 5 }),
        urlPathSegmentArb,
        fc.constantFrom(...NON_PDF_EXTENSIONS),
        fc.option(fc.constantFrom(...NON_PDF_CONTENT_TYPES), { nil: undefined }),
        (baseUrl, pathSegments, filename, extension, contentType) => {
          const path = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '';
          const nonPdfUrl = `${baseUrl}${path}/${filename}${extension}`;
          
          // PROPERTY ASSERTION: Non-PDF URLs must NOT be identified as PDFs
          expect(isPdfUrl(nonPdfUrl, contentType)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 2: PDF Validation**
   * **Validates: Requirements 1.2**
   * 
   * Property: For any list of mixed URLs, filterPdfLinks SHALL return only URLs
   * that end with .pdf extension.
   */
  it('Property 2: filterPdfLinks returns only PDF URLs from mixed list', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            baseUrlArb,
            urlPathSegmentArb,
            fc.boolean()
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (urlSpecs) => {
          const urls = urlSpecs.map(([base, filename, isPdf]) => 
            `${base}/${filename}${isPdf ? '.pdf' : '.html'}`
          );
          
          const expectedPdfCount = urlSpecs.filter(([, , isPdf]) => isPdf).length;
          const filteredUrls = filterPdfLinks(urls);
          
          // PROPERTY ASSERTION: Filtered count must match expected PDF count
          expect(filteredUrls.length).toBe(expectedPdfCount);
          
          // PROPERTY ASSERTION: All filtered URLs must end with .pdf
          for (const url of filteredUrls) {
            expect(url.toLowerCase().endsWith('.pdf')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 2: PDF Validation**
   * **Validates: Requirements 1.2**
   * 
   * Property: For any HTML containing anchor tags with PDF links,
   * extractLinksFromHtml followed by filterPdfLinks SHALL extract only PDF URLs.
   */
  it('Property 2: HTML parsing extracts and filters only PDF links', () => {
    fc.assert(
      fc.property(
        baseUrlArb,
        fc.array(
          fc.tuple(
            urlPathSegmentArb,
            fc.boolean()
          ),
          { minLength: 1, maxLength: 10 }
        ),
        (baseUrl, linkSpecs) => {
          // Generate HTML with mixed links
          const links = linkSpecs.map(([filename, isPdf]) => ({
            href: `/${filename}${isPdf ? '.pdf' : '.html'}`,
            isPdf
          }));
          
          const html = `
            <html>
              <body>
                ${links.map(l => `<a href="${l.href}">Link</a>`).join('\n')}
              </body>
            </html>
          `;
          
          const extractedLinks = extractLinksFromHtml(html, baseUrl);
          const pdfLinks = filterPdfLinks(extractedLinks);
          
          const expectedPdfCount = linkSpecs.filter(([, isPdf]) => isPdf).length;
          
          // PROPERTY ASSERTION: Extracted PDF count must match expected
          expect(pdfLinks.length).toBe(expectedPdfCount);
          
          // PROPERTY ASSERTION: All extracted PDF links must be valid absolute URLs ending in .pdf
          for (const url of pdfLinks) {
            expect(url.toLowerCase().endsWith('.pdf')).toBe(true);
            expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 2: PDF Validation**
   * **Validates: Requirements 1.2**
   * 
   * Property: For any relative PDF URL, toAbsoluteUrl SHALL convert it to a valid
   * absolute URL while preserving the .pdf extension.
   */
  it('Property 2: Relative PDF URLs are correctly converted to absolute URLs', () => {
    fc.assert(
      fc.property(
        baseUrlArb,
        fc.array(urlPathSegmentArb, { minLength: 0, maxLength: 3 }),
        urlPathSegmentArb,
        (baseUrl, pathSegments, filename) => {
          const relativePath = pathSegments.length > 0 
            ? `${pathSegments.join('/')}/${filename}.pdf`
            : `${filename}.pdf`;
          
          const absoluteUrl = toAbsoluteUrl(relativePath, baseUrl);
          
          // PROPERTY ASSERTION: Converted URL must be absolute
          expect(absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')).toBe(true);
          
          // PROPERTY ASSERTION: Converted URL must preserve .pdf extension
          expect(absoluteUrl.toLowerCase().endsWith('.pdf')).toBe(true);
          
          // PROPERTY ASSERTION: Converted URL must be a valid PDF URL
          expect(isPdfUrl(absoluteUrl)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 2: PDF Validation**
   * **Validates: Requirements 1.2**
   * 
   * Property: For any URL with query parameters, isPdfUrl SHALL correctly identify
   * PDFs based on the path (ignoring query string).
   */
  it('Property 2: URLs with query parameters are correctly validated', () => {
    fc.assert(
      fc.property(
        baseUrlArb,
        urlPathSegmentArb,
        fc.boolean(),
        fc.array(
          fc.tuple(urlPathSegmentArb, urlPathSegmentArb),
          { minLength: 1, maxLength: 3 }
        ),
        (baseUrl, filename, isPdf, queryParams) => {
          const extension = isPdf ? '.pdf' : '.html';
          const queryString = queryParams.map(([k, v]) => `${k}=${v}`).join('&');
          const url = `${baseUrl}/${filename}${extension}?${queryString}`;
          
          // PROPERTY ASSERTION: PDF detection must work correctly with query params
          expect(isPdfUrl(url)).toBe(isPdf);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 2: PDF Validation**
   * **Validates: Requirements 1.2**
   * 
   * Property: For any URL with fragment identifiers, isPdfUrl SHALL correctly identify
   * PDFs based on the path (ignoring fragment).
   */
  it('Property 2: URLs with fragment identifiers are correctly validated', () => {
    fc.assert(
      fc.property(
        baseUrlArb,
        urlPathSegmentArb,
        fc.boolean(),
        urlPathSegmentArb,
        (baseUrl, filename, isPdf, fragment) => {
          const extension = isPdf ? '.pdf' : '.html';
          const url = `${baseUrl}/${filename}${extension}#${fragment}`;
          
          // PROPERTY ASSERTION: PDF detection must work correctly with fragments
          expect(isPdfUrl(url)).toBe(isPdf);
        }
      ),
      { numRuns: 100 }
    );
  });
});
