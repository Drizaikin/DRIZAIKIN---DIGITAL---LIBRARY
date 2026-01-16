/**
 * Unit Tests for Environment Variable Loading
 * **Feature: ingestion-filtering**
 * **Validates: Requirements 5.1.6**
 * 
 * Tests loading filter configuration from environment variables,
 * fallback behavior, and handling of invalid environment values.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadFilterConfig,
  validateGenreNames,
  hasActiveFilters,
  getFilterSummary
} from '../../services/ingestion/ingestionFilter.js';

describe('Environment Variable Loading - Unit Tests', () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant environment variables before each test
    delete process.env.INGEST_ALLOWED_GENRES;
    delete process.env.INGEST_ALLOWED_AUTHORS;
    delete process.env.ENABLE_GENRE_FILTER;
    delete process.env.ENABLE_AUTHOR_FILTER;
  });

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });

  describe('Loading from Environment Variables', () => {
    it('should load genre filter configuration from INGEST_ALLOWED_GENRES', () => {
      process.env.INGEST_ALLOWED_GENRES = 'Fiction,Philosophy,History';
      process.env.ENABLE_GENRE_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual(['Fiction', 'Philosophy', 'History']);
      expect(config.enableGenreFilter).toBe(true);
    });

    it('should load author filter configuration from INGEST_ALLOWED_AUTHORS', () => {
      process.env.INGEST_ALLOWED_AUTHORS = 'Robin Sharma,Paulo Coelho,Dale Carnegie';
      process.env.ENABLE_AUTHOR_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedAuthors).toEqual(['Robin Sharma', 'Paulo Coelho', 'Dale Carnegie']);
      expect(config.enableAuthorFilter).toBe(true);
    });

    it('should load both genre and author filters simultaneously', () => {
      process.env.INGEST_ALLOWED_GENRES = 'Fiction,Science';
      process.env.INGEST_ALLOWED_AUTHORS = 'Robin Sharma';
      process.env.ENABLE_GENRE_FILTER = 'true';
      process.env.ENABLE_AUTHOR_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual(['Fiction', 'Science']);
      expect(config.allowedAuthors).toEqual(['Robin Sharma']);
      expect(config.enableGenreFilter).toBe(true);
      expect(config.enableAuthorFilter).toBe(true);
    });

    it('should handle single genre in INGEST_ALLOWED_GENRES', () => {
      process.env.INGEST_ALLOWED_GENRES = 'Fiction';
      process.env.ENABLE_GENRE_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual(['Fiction']);
    });

    it('should handle single author in INGEST_ALLOWED_AUTHORS', () => {
      process.env.INGEST_ALLOWED_AUTHORS = 'Robin Sharma';
      process.env.ENABLE_AUTHOR_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedAuthors).toEqual(['Robin Sharma']);
    });

    it('should trim whitespace from genre names', () => {
      process.env.INGEST_ALLOWED_GENRES = '  Fiction  ,  Philosophy  ,  History  ';
      process.env.ENABLE_GENRE_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual(['Fiction', 'Philosophy', 'History']);
    });

    it('should trim whitespace from author names', () => {
      process.env.INGEST_ALLOWED_AUTHORS = '  Robin Sharma  ,  Paulo Coelho  ';
      process.env.ENABLE_AUTHOR_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedAuthors).toEqual(['Robin Sharma', 'Paulo Coelho']);
    });

    it('should handle genres with special characters (ampersand)', () => {
      process.env.INGEST_ALLOWED_GENRES = 'Mystery & Thriller,Science Fiction & Fantasy';
      process.env.ENABLE_GENRE_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual(['Mystery & Thriller', 'Science Fiction & Fantasy']);
    });
  });

  describe('Fallback Behavior', () => {
    it('should return empty arrays when environment variables are not set', () => {
      // Environment variables are cleared in beforeEach

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual([]);
      expect(config.allowedAuthors).toEqual([]);
    });

    it('should return false for enable flags when not set', () => {
      // Environment variables are cleared in beforeEach

      const config = loadFilterConfig();

      expect(config.enableGenreFilter).toBe(false);
      expect(config.enableAuthorFilter).toBe(false);
    });

    it('should return empty arrays when environment variables are empty strings', () => {
      process.env.INGEST_ALLOWED_GENRES = '';
      process.env.INGEST_ALLOWED_AUTHORS = '';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual([]);
      expect(config.allowedAuthors).toEqual([]);
    });

    it('should return false for enable flags when set to empty string', () => {
      process.env.ENABLE_GENRE_FILTER = '';
      process.env.ENABLE_AUTHOR_FILTER = '';

      const config = loadFilterConfig();

      expect(config.enableGenreFilter).toBe(false);
      expect(config.enableAuthorFilter).toBe(false);
    });

    it('should allow all genres when INGEST_ALLOWED_GENRES is not set but filter is enabled', () => {
      process.env.ENABLE_GENRE_FILTER = 'true';
      // INGEST_ALLOWED_GENRES not set

      const config = loadFilterConfig();

      expect(config.enableGenreFilter).toBe(true);
      expect(config.allowedGenres).toEqual([]);
      // Empty allowed list means allow all
      expect(hasActiveFilters(config)).toBe(false);
    });

    it('should allow all authors when INGEST_ALLOWED_AUTHORS is not set but filter is enabled', () => {
      process.env.ENABLE_AUTHOR_FILTER = 'true';
      // INGEST_ALLOWED_AUTHORS not set

      const config = loadFilterConfig();

      expect(config.enableAuthorFilter).toBe(true);
      expect(config.allowedAuthors).toEqual([]);
      // Empty allowed list means allow all
      expect(hasActiveFilters(config)).toBe(false);
    });
  });

  describe('Invalid Environment Values', () => {
    it('should return false for enable flags when set to non-true values', () => {
      process.env.ENABLE_GENRE_FILTER = 'false';
      process.env.ENABLE_AUTHOR_FILTER = 'no';

      const config = loadFilterConfig();

      expect(config.enableGenreFilter).toBe(false);
      expect(config.enableAuthorFilter).toBe(false);
    });

    it('should return false for enable flags when set to invalid strings', () => {
      process.env.ENABLE_GENRE_FILTER = 'yes';
      process.env.ENABLE_AUTHOR_FILTER = '1';

      const config = loadFilterConfig();

      // Only 'true' (exact match) should enable the filter
      expect(config.enableGenreFilter).toBe(false);
      expect(config.enableAuthorFilter).toBe(false);
    });

    it('should return false for enable flags when set to TRUE (uppercase)', () => {
      process.env.ENABLE_GENRE_FILTER = 'TRUE';
      process.env.ENABLE_AUTHOR_FILTER = 'True';

      const config = loadFilterConfig();

      // Only lowercase 'true' should enable the filter
      expect(config.enableGenreFilter).toBe(false);
      expect(config.enableAuthorFilter).toBe(false);
    });

    it('should filter out empty entries from comma-separated genres', () => {
      process.env.INGEST_ALLOWED_GENRES = 'Fiction,,Philosophy,,,History';
      process.env.ENABLE_GENRE_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual(['Fiction', 'Philosophy', 'History']);
    });

    it('should filter out empty entries from comma-separated authors', () => {
      process.env.INGEST_ALLOWED_AUTHORS = 'Robin Sharma,,Paulo Coelho,,,';
      process.env.ENABLE_AUTHOR_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedAuthors).toEqual(['Robin Sharma', 'Paulo Coelho']);
    });

    it('should filter out whitespace-only entries from genres', () => {
      process.env.INGEST_ALLOWED_GENRES = 'Fiction,   ,Philosophy,  ,History';
      process.env.ENABLE_GENRE_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual(['Fiction', 'Philosophy', 'History']);
    });

    it('should filter out whitespace-only entries from authors', () => {
      process.env.INGEST_ALLOWED_AUTHORS = 'Robin Sharma,   ,Paulo Coelho';
      process.env.ENABLE_AUTHOR_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedAuthors).toEqual(['Robin Sharma', 'Paulo Coelho']);
    });

    it('should handle genres with only commas', () => {
      process.env.INGEST_ALLOWED_GENRES = ',,,';
      process.env.ENABLE_GENRE_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual([]);
    });

    it('should handle authors with only commas', () => {
      process.env.INGEST_ALLOWED_AUTHORS = ',,,';
      process.env.ENABLE_AUTHOR_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedAuthors).toEqual([]);
    });
  });

  describe('Genre Validation Against Taxonomy', () => {
    it('should validate valid genres from taxonomy', () => {
      // Using valid genres from PRIMARY_GENRES in genreTaxonomy.js
      const result = validateGenreNames(['Philosophy', 'History', 'Science']);
      
      expect(result.valid).toBe(true);
      expect(result.invalidGenres).toEqual([]);
    });

    it('should detect invalid genres not in taxonomy', () => {
      // 'Fiction' is not in the taxonomy, only Philosophy, History, etc.
      const result = validateGenreNames(['Philosophy', 'InvalidGenre', 'NotAGenre']);
      
      expect(result.valid).toBe(false);
      expect(result.invalidGenres).toContain('InvalidGenre');
      expect(result.invalidGenres).toContain('NotAGenre');
    });

    it('should validate genres case-insensitively', () => {
      // Using valid genres from taxonomy with different cases
      const result = validateGenreNames(['philosophy', 'HISTORY', 'ScIeNcE']);
      
      expect(result.valid).toBe(true);
      expect(result.invalidGenres).toEqual([]);
    });

    it('should handle empty genre array', () => {
      const result = validateGenreNames([]);
      
      expect(result.valid).toBe(true);
      expect(result.invalidGenres).toEqual([]);
    });

    it('should handle non-array input', () => {
      const result = validateGenreNames('not an array' as any);
      
      expect(result.valid).toBe(false);
    });
  });

  describe('Configuration Summary', () => {
    it('should generate correct summary for active genre filter', () => {
      process.env.INGEST_ALLOWED_GENRES = 'Fiction,Philosophy';
      process.env.ENABLE_GENRE_FILTER = 'true';

      const config = loadFilterConfig();
      const summary = getFilterSummary(config);

      expect(summary).toContain('Genre filter: 2 allowed genres');
      expect(summary).toContain('[Fiction, Philosophy]');
    });

    it('should generate correct summary for active author filter', () => {
      process.env.INGEST_ALLOWED_AUTHORS = 'Robin Sharma,Paulo Coelho';
      process.env.ENABLE_AUTHOR_FILTER = 'true';

      const config = loadFilterConfig();
      const summary = getFilterSummary(config);

      expect(summary).toContain('Author filter: 2 allowed authors');
      expect(summary).toContain('[Robin Sharma, Paulo Coelho]');
    });

    it('should generate correct summary when no filters are active', () => {
      // No environment variables set

      const config = loadFilterConfig();
      const summary = getFilterSummary(config);

      expect(summary).toContain('Genre filter: disabled (allow all)');
      expect(summary).toContain('Author filter: disabled (allow all)');
    });
  });

  describe('hasActiveFilters', () => {
    it('should return true when genre filter is properly configured', () => {
      process.env.INGEST_ALLOWED_GENRES = 'Fiction';
      process.env.ENABLE_GENRE_FILTER = 'true';

      const config = loadFilterConfig();

      expect(hasActiveFilters(config)).toBe(true);
    });

    it('should return true when author filter is properly configured', () => {
      process.env.INGEST_ALLOWED_AUTHORS = 'Robin Sharma';
      process.env.ENABLE_AUTHOR_FILTER = 'true';

      const config = loadFilterConfig();

      expect(hasActiveFilters(config)).toBe(true);
    });

    it('should return false when filters are enabled but lists are empty', () => {
      process.env.ENABLE_GENRE_FILTER = 'true';
      process.env.ENABLE_AUTHOR_FILTER = 'true';
      // No allowed genres or authors set

      const config = loadFilterConfig();

      expect(hasActiveFilters(config)).toBe(false);
    });

    it('should return false when no environment variables are set', () => {
      const config = loadFilterConfig();

      expect(hasActiveFilters(config)).toBe(false);
    });
  });
});
