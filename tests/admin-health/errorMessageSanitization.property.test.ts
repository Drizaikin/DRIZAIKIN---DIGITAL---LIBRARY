/**
 * Property-Based Tests for Error Message Sanitization
 * **Feature: admin-health-dashboard, Property 5: Error Message Sanitization**
 * **Validates: Requirements 1.5, 6.5**
 * 
 * This test verifies that for any error displayed in the error summary,
 * the message SHALL NOT contain stack traces, file paths, or sensitive credentials.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Import the sanitizeErrorMessage function from healthService
import { sanitizeErrorMessage } from '../../services/admin/healthService.js';

// Patterns that should NOT appear in sanitized output
const SENSITIVE_PATTERNS = {
  // Windows file paths
  windowsPath: /[A-Za-z]:\\[^\s]+/,
  // Unix file paths (more than one level deep)
  unixPath: /\/[^\s]+\/[^\s]+/,
  // Stack traces (lines starting with "at ")
  stackTrace: /\s+at\s+/,
  // Long alphanumeric strings (potential API keys)
  apiKey: /[a-zA-Z0-9]{32,}/,
  // URLs with credentials
  urlWithCredentials: /https?:\/\/[^:]+:[^@]+@/,
};

// Generator for error messages with sensitive data
const sensitiveErrorMessageArb = fc.oneof(
  // Windows file paths
  fc.tuple(
    fc.constantFrom('C', 'D', 'E'),
    fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), { minLength: 1, maxLength: 5 })
  ).map(([drive, parts]) => `Error at ${drive}:\\${parts.join('\\')}\\file.js:123`),
  
  // Unix file paths
  fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), { minLength: 2, maxLength: 5 })
    .map(parts => `Error in /${parts.join('/')}/module.ts`),
  
  // Stack traces
  fc.tuple(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.string({ minLength: 1, maxLength: 20 })
  ).map(([fn, file]) => `Error occurred\n    at ${fn} (${file}:10:5)\n    at Object.<anonymous>`),
  
  // API keys (long alphanumeric strings)
  fc.stringMatching(/^[a-zA-Z0-9]{32,64}$/)
    .map(key => `API Error: Invalid key ${key}`),
  
  // URLs with credentials
  fc.tuple(
    fc.stringMatching(/^[a-zA-Z0-9]+$/),
    fc.stringMatching(/^[a-zA-Z0-9]+$/)
  ).map(([user, pass]) => `Connection failed: https://${user}:${pass}@api.example.com/v1`),
  
  // Combined sensitive data
  fc.tuple(
    fc.constantFrom('C', 'D'),
    fc.stringMatching(/^[a-zA-Z0-9]{32,40}$/)
  ).map(([drive, key]) => `Error at ${drive}:\\Users\\admin\\project\\src\\index.js with key ${key}`)
);

// Generator for normal error messages (without sensitive data)
const normalErrorMessageArb = fc.oneof(
  fc.constant('Connection timeout'),
  fc.constant('Database query failed'),
  fc.constant('Invalid input format'),
  fc.constant('Resource not found'),
  fc.constant('Permission denied'),
  fc.string({ minLength: 1, maxLength: 100 }).filter(s => 
    !SENSITIVE_PATTERNS.windowsPath.test(s) &&
    !SENSITIVE_PATTERNS.unixPath.test(s) &&
    !SENSITIVE_PATTERNS.stackTrace.test(s) &&
    !SENSITIVE_PATTERNS.apiKey.test(s) &&
    !SENSITIVE_PATTERNS.urlWithCredentials.test(s)
  )
);

// Generator for null/undefined/empty values
const emptyValueArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(''),
  fc.constant('   ')
);

describe('Error Message Sanitization - Property Tests', () => {
  /**
   * **Feature: admin-health-dashboard, Property 5: Error Message Sanitization**
   * **Validates: Requirements 1.5, 6.5**
   * 
   * Property: Sanitized messages SHALL NOT contain Windows file paths
   */
  it('Property 5a: Sanitized messages do not contain Windows file paths', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom('C', 'D', 'E', 'F'),
          fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), { minLength: 1, maxLength: 5 })
        ).map(([drive, parts]) => `Error at ${drive}:\\${parts.join('\\')}\\file.js:123`),
        (errorMessage) => {
          const sanitized = sanitizeErrorMessage(errorMessage);
          
          // Should not contain Windows paths
          expect(SENSITIVE_PATTERNS.windowsPath.test(sanitized)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 6.5**
   * 
   * Property: Sanitized messages SHALL NOT contain Unix file paths
   */
  it('Property 5b: Sanitized messages do not contain Unix file paths', () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]+$/), { minLength: 2, maxLength: 5 })
          .map(parts => `Error in /${parts.join('/')}/module.ts`),
        (errorMessage) => {
          const sanitized = sanitizeErrorMessage(errorMessage);
          
          // Should not contain Unix paths (more than one level deep)
          expect(SENSITIVE_PATTERNS.unixPath.test(sanitized)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 6.5**
   * 
   * Property: Sanitized messages SHALL NOT contain stack traces
   */
  it('Property 5c: Sanitized messages do not contain stack traces', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9_]+$/),
          fc.stringMatching(/^[a-zA-Z0-9_]+$/)
        ).map(([fn, file]) => `Error occurred\n    at ${fn} (${file}:10:5)\n    at Object.<anonymous>`),
        (errorMessage) => {
          const sanitized = sanitizeErrorMessage(errorMessage);
          
          // Should not contain stack trace patterns
          expect(SENSITIVE_PATTERNS.stackTrace.test(sanitized)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 6.5**
   * 
   * Property: Sanitized messages SHALL NOT contain potential API keys
   */
  it('Property 5d: Sanitized messages do not contain API keys', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9]{32,64}$/)
          .map(key => `API Error: Invalid key ${key}`),
        (errorMessage) => {
          const sanitized = sanitizeErrorMessage(errorMessage);
          
          // Should not contain long alphanumeric strings (potential API keys)
          expect(SENSITIVE_PATTERNS.apiKey.test(sanitized)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 6.5**
   * 
   * Property: Sanitized messages SHALL NOT contain URLs with credentials
   */
  it('Property 5e: Sanitized messages do not contain URLs with credentials', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9]+$/),
          fc.stringMatching(/^[a-zA-Z0-9]+$/)
        ).map(([user, pass]) => `Connection failed: https://${user}:${pass}@api.example.com/v1`),
        (errorMessage) => {
          const sanitized = sanitizeErrorMessage(errorMessage);
          
          // Should not contain URLs with embedded credentials
          expect(SENSITIVE_PATTERNS.urlWithCredentials.test(sanitized)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 6.5**
   * 
   * Property: Sanitized messages are truncated to reasonable length
   */
  it('Property 5f: Sanitized messages are truncated to reasonable length', () => {
    fc.assert(
      fc.property(
        // Generate very long error messages
        fc.string({ minLength: 300, maxLength: 1000 }),
        (errorMessage) => {
          const sanitized = sanitizeErrorMessage(errorMessage);
          
          // Should be truncated to 200 chars + "..."
          expect(sanitized.length).toBeLessThanOrEqual(203);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.5, 6.5**
   * 
   * Property: Null/undefined/empty inputs return 'Unknown error'
   */
  it('Property 5g: Empty inputs return Unknown error', () => {
    fc.assert(
      fc.property(
        emptyValueArb,
        (errorMessage) => {
          const sanitized = sanitizeErrorMessage(errorMessage);
          
          // Should return 'Unknown error' for empty/null/undefined
          expect(sanitized).toBe('Unknown error');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Normal error messages are preserved (minus any accidental sensitive data)
   */
  it('Property 5h: Normal messages are preserved when no sensitive data', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'Connection timeout',
          'Database query failed',
          'Invalid input format',
          'Resource not found',
          'Permission denied'
        ),
        (errorMessage) => {
          const sanitized = sanitizeErrorMessage(errorMessage);
          
          // Normal messages should be preserved
          expect(sanitized).toBe(errorMessage);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sanitized output is always a non-empty string
   */
  it('Property 5i: Sanitized output is always a non-empty string', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          sensitiveErrorMessageArb,
          normalErrorMessageArb,
          emptyValueArb,
          fc.string()
        ),
        (errorMessage) => {
          const sanitized = sanitizeErrorMessage(errorMessage);
          
          // Should always return a non-empty string
          expect(typeof sanitized).toBe('string');
          expect(sanitized.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
