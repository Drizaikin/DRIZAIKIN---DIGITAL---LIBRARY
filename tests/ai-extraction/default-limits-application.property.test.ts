/**
 * Property-Based Tests for Default Limits Application
 * **Feature: ai-book-extraction, Property 8: Default Limits Application**
 * **Validates: Requirements 2.6**
 * 
 * This test verifies that extraction jobs created without explicit limits
 * receive default limits of 60 minutes and 100 books.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  applyDefaultLimits,
  JobOptions,
  DEFAULT_MAX_TIME_MINUTES,
  DEFAULT_MAX_BOOKS
} from '../../services/extractionService';

describe('Default Limits Application - Property Tests', () => {
  /**
   * **Feature: ai-book-extraction, Property 8: Default Limits Application**
   * **Validates: Requirements 2.6**
   * 
   * Property: For any extraction job created without explicit limits,
   * the system SHALL apply default limits of 60 minutes and 100 books.
   */
  it('Property 8: Empty options receive default limits of 60 minutes and 100 books', () => {
    // When no options are provided, defaults should be applied
    const result = applyDefaultLimits({});
    
    expect(result.maxTimeMinutes).toBe(DEFAULT_MAX_TIME_MINUTES);
    expect(result.maxBooks).toBe(DEFAULT_MAX_BOOKS);
    expect(result.maxTimeMinutes).toBe(60);
    expect(result.maxBooks).toBe(100);
  });

  /**
   * **Feature: ai-book-extraction, Property 8: Default Limits Application**
   * **Validates: Requirements 2.6**
   * 
   * Property: For any extraction job created with undefined options,
   * the system SHALL apply default limits of 60 minutes and 100 books.
   */
  it('Property 8: Undefined options receive default limits', () => {
    const result = applyDefaultLimits(undefined);
    
    expect(result.maxTimeMinutes).toBe(60);
    expect(result.maxBooks).toBe(100);
  });

  /**
   * **Feature: ai-book-extraction, Property 8: Default Limits Application**
   * **Validates: Requirements 2.6**
   * 
   * Property: For any extraction job created with only maxTimeMinutes specified,
   * the system SHALL apply the default maxBooks limit of 100.
   */
  it('Property 8: Only maxTimeMinutes specified applies default maxBooks', () => {
    fc.assert(
      fc.property(
        // Any valid time limit from 1 to 1440 minutes (24 hours)
        fc.integer({ min: 1, max: 1440 }),
        (maxTimeMinutes) => {
          const options: JobOptions = { maxTimeMinutes };
          const result = applyDefaultLimits(options);
          
          // PROPERTY ASSERTION: Specified time limit is preserved
          expect(result.maxTimeMinutes).toBe(maxTimeMinutes);
          // PROPERTY ASSERTION: Default book limit is applied
          expect(result.maxBooks).toBe(DEFAULT_MAX_BOOKS);
          expect(result.maxBooks).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 8: Default Limits Application**
   * **Validates: Requirements 2.6**
   * 
   * Property: For any extraction job created with only maxBooks specified,
   * the system SHALL apply the default maxTimeMinutes limit of 60.
   */
  it('Property 8: Only maxBooks specified applies default maxTimeMinutes', () => {
    fc.assert(
      fc.property(
        // Any valid book limit from 1 to 10000 books
        fc.integer({ min: 1, max: 10000 }),
        (maxBooks) => {
          const options: JobOptions = { maxBooks };
          const result = applyDefaultLimits(options);
          
          // PROPERTY ASSERTION: Specified book limit is preserved
          expect(result.maxBooks).toBe(maxBooks);
          // PROPERTY ASSERTION: Default time limit is applied
          expect(result.maxTimeMinutes).toBe(DEFAULT_MAX_TIME_MINUTES);
          expect(result.maxTimeMinutes).toBe(60);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 8: Default Limits Application**
   * **Validates: Requirements 2.6**
   * 
   * Property: For any extraction job created with both limits specified,
   * the system SHALL preserve both user-specified values.
   */
  it('Property 8: Both limits specified preserves user values', () => {
    fc.assert(
      fc.property(
        // Any valid time limit from 1 to 1440 minutes
        fc.integer({ min: 1, max: 1440 }),
        // Any valid book limit from 1 to 10000 books
        fc.integer({ min: 1, max: 10000 }),
        (maxTimeMinutes, maxBooks) => {
          const options: JobOptions = { maxTimeMinutes, maxBooks };
          const result = applyDefaultLimits(options);
          
          // PROPERTY ASSERTION: Both specified limits are preserved
          expect(result.maxTimeMinutes).toBe(maxTimeMinutes);
          expect(result.maxBooks).toBe(maxBooks);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 8: Default Limits Application**
   * **Validates: Requirements 2.6**
   * 
   * Property: The applyDefaultLimits function SHALL always return
   * a complete JobOptions object with both limits defined (never undefined).
   */
  it('Property 8: Result always has both limits defined', () => {
    fc.assert(
      fc.property(
        // Generate random options with optional fields
        fc.record({
          maxTimeMinutes: fc.option(fc.integer({ min: 1, max: 1440 }), { nil: undefined }),
          maxBooks: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined })
        }),
        (options) => {
          const result = applyDefaultLimits(options);
          
          // PROPERTY ASSERTION: Result always has both limits defined
          expect(result.maxTimeMinutes).toBeDefined();
          expect(result.maxBooks).toBeDefined();
          expect(typeof result.maxTimeMinutes).toBe('number');
          expect(typeof result.maxBooks).toBe('number');
          expect(result.maxTimeMinutes).toBeGreaterThan(0);
          expect(result.maxBooks).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: ai-book-extraction, Property 8: Default Limits Application**
   * **Validates: Requirements 2.6**
   * 
   * Property: The default constants SHALL match the specification values.
   */
  it('Property 8: Default constants match specification (60 minutes, 100 books)', () => {
    // Verify the constants are correctly defined per Requirements 2.6
    expect(DEFAULT_MAX_TIME_MINUTES).toBe(60);
    expect(DEFAULT_MAX_BOOKS).toBe(100);
  });
});
