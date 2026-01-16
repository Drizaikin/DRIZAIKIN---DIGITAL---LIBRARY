/**
 * Unit Tests for Ingestion Filter Module
 * **Feature: ingestion-filtering**
 * **Validates: Requirements 5.1.1-5.1.7, 5.2.1-5.2.7**
 * 
 * Tests genre filtering, author filtering, filter combinations, and logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadFilterConfig,
  validateGenreNames,
  checkGenreFilter,
  checkAuthorFilter,
  applyFilters,
  logFilterDecision,
  getFilterSummary,
  hasActiveFilters
} from '../../services/ingestion/ingestionFilter.js';

describe('Ingestion Filter Module - Unit Tests', () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear console.log spy
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });

  describe('loadFilterConfig', () => {
    it('should load genre filter from environment variables', () => {
      process.env.INGEST_ALLOWED_GENRES = 'Fiction,Mystery & Thriller,Science';
      process.env.ENABLE_GENRE_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual(['Fiction', 'Mystery & Thriller', 'Science']);
      expect(config.enableGenreFilter).toBe(true);
    });

    it('should load author filter from environment variables', () => {
      process.env.INGEST_ALLOWED_AUTHORS = 'Robin Sharma,Paulo Coelho,Dale Carnegie';
      process.env.ENABLE_AUTHOR_FILTER = 'true';

      const config = loadFilterConfig();

      expect(config.allowedAuthors).toEqual(['Robin Sharma', 'Paulo Coelho', 'Dale Carnegie']);
      expect(config.enableAuthorFilter).toBe(true);
    });

    it('should handle empty environment variables', () => {
      process.env.INGEST_ALLOWED_GENRES = '';
      process.env.INGEST_ALLOWED_AUTHORS = '';
      process.env.ENABLE_GENRE_FILTER = 'false';
      process.env.ENABLE_AUTHOR_FILTER = 'false';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual([]);
      expect(config.allowedAuthors).toEqual([]);
      expect(config.enableGenreFilter).toBe(false);
      expect(config.enableAuthorFilter).toBe(false);
    });

    it('should trim whitespace from genre and author names', () => {
      process.env.INGEST_ALLOWED_GENRES = '  Fiction  ,  Mystery & Thriller  ';
      process.env.INGEST_ALLOWED_AUTHORS = '  Robin Sharma  ,  Paulo Coelho  ';

      const config = loadFilterConfig();

      expect(config.allowedGenres).toEqual(['Fiction', 'Mystery & Thriller']);
      expect(config.allowedAuthors).toEqual(['Robin Sharma', 'Paulo Coelho']);
    });
  });

  describe('validateGenreNames', () => {
    it('should validate correct genre names', () => {
      const result = validateGenreNames(['Philosophy', 'History', 'Science']);
      expect(result.valid).toBe(true);
      expect(result.invalidGenres).toEqual([]);
    });

    it('should detect invalid genre names', () => {
      const result = validateGenreNames(['Fiction', 'InvalidGenre', 'Philosophy']);
      expect(result.valid).toBe(false);
      expect(result.invalidGenres).toContain('InvalidGenre');
    });

    it('should handle case-insensitive validation', () => {
      const result = validateGenreNames(['philosophy', 'HISTORY', 'Science']);
      expect(result.valid).toBe(true);
      expect(result.invalidGenres).toEqual([]);
    });

    it('should handle non-array input', () => {
      const result = validateGenreNames('not an array' as any);
      expect(result.valid).toBe(false);
    });
  });

  describe('checkGenreFilter - Various Configurations', () => {
    it('should pass when filter is disabled', () => {
      const config = {
        allowedGenres: ['Philosophy'],
        enableGenreFilter: false,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      const result = checkGenreFilter(['History'], config);

      expect(result.passed).toBe(true);
    });

    it('should pass when allowed genres list is empty (allow all)', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: true,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      const result = checkGenreFilter(['History'], config);

      expect(result.passed).toBe(true);
    });

    it('should pass when book genre matches allowed genre', () => {
      const config = {
        allowedGenres: ['Philosophy', 'History', 'Science'],
        enableGenreFilter: true,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      const result = checkGenreFilter(['History'], config);

      expect(result.passed).toBe(true);
    });

    it('should pass when any book genre matches allowed genres', () => {
      const config = {
        allowedGenres: ['Philosophy', 'History'],
        enableGenreFilter: true,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      const result = checkGenreFilter(['Science', 'History', 'Mathematics'], config);

      expect(result.passed).toBe(true);
    });

    it('should fail when no book genres match allowed genres', () => {
      const config = {
        allowedGenres: ['Philosophy', 'History'],
        enableGenreFilter: true,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      const result = checkGenreFilter(['Science', 'Mathematics'], config);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Genre not in allowed list');
    });

    it('should fail when book has no genres', () => {
      const config = {
        allowedGenres: ['Philosophy'],
        enableGenreFilter: true,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      const result = checkGenreFilter([], config);

      expect(result.passed).toBe(false);
      expect(result.reason).toBe('Book has no genres');
    });

    it('should handle case-insensitive genre matching', () => {
      const config = {
        allowedGenres: ['Philosophy', 'HISTORY'],
        enableGenreFilter: true,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      const result = checkGenreFilter(['history', 'PHILOSOPHY'], config);

      expect(result.passed).toBe(true);
    });
  });

  describe('checkAuthorFilter - Case Variations', () => {
    it('should pass when filter is disabled', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: false
      };

      const result = checkAuthorFilter('Paulo Coelho', config);

      expect(result.passed).toBe(true);
    });

    it('should pass when allowed authors list is empty (allow all)', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: [],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('Any Author', config);

      expect(result.passed).toBe(true);
    });

    it('should pass with exact case-insensitive match', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('ROBIN SHARMA', config);

      expect(result.passed).toBe(true);
    });

    it('should pass with lowercase book author', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('robin sharma', config);

      expect(result.passed).toBe(true);
    });

    it('should pass with mixed case variations', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['RoBiN sHaRmA'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('Robin Sharma', config);

      expect(result.passed).toBe(true);
    });

    it('should fail when author does not match', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('Paulo Coelho', config);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Author not in allowed list');
    });

    it('should fail when book has no author', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('', config);

      expect(result.passed).toBe(false);
      expect(result.reason).toBe('Book has no author');
    });
  });

  describe('checkAuthorFilter - Partial Name Matching', () => {
    it('should pass with partial last name match', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Sharma'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('Robin Sharma', config);

      expect(result.passed).toBe(true);
    });

    it('should pass with partial first name match', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Robin'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('Robin Sharma', config);

      expect(result.passed).toBe(true);
    });

    it('should pass with partial middle name match', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Kumar'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('Rajesh Kumar Sharma', config);

      expect(result.passed).toBe(true);
    });

    it('should pass when allowed author is substring of book author', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Coelho'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('Paulo Coelho de Souza', config);

      expect(result.passed).toBe(true);
    });

    it('should fail when partial match is not found', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Smith'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('Robin Sharma', config);

      expect(result.passed).toBe(false);
    });

    it('should handle partial match with case insensitivity', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['sharma'],
        enableAuthorFilter: true
      };

      const result = checkAuthorFilter('ROBIN SHARMA', config);

      expect(result.passed).toBe(true);
    });
  });

  describe('applyFilters - Combined Filters', () => {
    it('should pass when both filters pass', () => {
      const config = {
        allowedGenres: ['Philosophy', 'History'],
        enableGenreFilter: true,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      const book = {
        identifier: 'test-book-1',
        title: 'Test Book',
        author: 'Robin Sharma',
        genres: ['Philosophy']
      };

      const result = applyFilters(book, config);

      expect(result.passed).toBe(true);
      expect(result.filters.genre.passed).toBe(true);
      expect(result.filters.author.passed).toBe(true);
    });

    it('should fail when genre filter fails', () => {
      const config = {
        allowedGenres: ['Philosophy'],
        enableGenreFilter: true,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      const book = {
        identifier: 'test-book-2',
        title: 'Test Book',
        author: 'Robin Sharma',
        genres: ['Science']
      };

      const result = applyFilters(book, config);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Genre filter failed');
      expect(result.filters.genre.passed).toBe(false);
    });

    it('should fail when author filter fails', () => {
      const config = {
        allowedGenres: ['Philosophy'],
        enableGenreFilter: true,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      const book = {
        identifier: 'test-book-3',
        title: 'Test Book',
        author: 'Paulo Coelho',
        genres: ['Philosophy']
      };

      const result = applyFilters(book, config);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Author filter failed');
      expect(result.filters.author.passed).toBe(false);
    });

    it('should fail when both filters fail', () => {
      const config = {
        allowedGenres: ['Philosophy'],
        enableGenreFilter: true,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      const book = {
        identifier: 'test-book-4',
        title: 'Test Book',
        author: 'Paulo Coelho',
        genres: ['Science']
      };

      const result = applyFilters(book, config);

      expect(result.passed).toBe(false);
      // Genre filter is checked first, so it should fail on genre
      expect(result.reason).toContain('Genre filter failed');
    });

    it('should pass when both filters are disabled', () => {
      const config = {
        allowedGenres: ['Philosophy'],
        enableGenreFilter: false,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: false
      };

      const book = {
        identifier: 'test-book-5',
        title: 'Test Book',
        author: 'Paulo Coelho',
        genres: ['Science']
      };

      const result = applyFilters(book, config);

      expect(result.passed).toBe(true);
    });
  });

  describe('logFilterDecision - Filter Logging', () => {
    it('should log passed filter decision', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const book = {
        identifier: 'test-book-1',
        title: 'Test Book',
        author: 'Robin Sharma',
        genres: ['Philosophy']
      };

      const filterResult = {
        passed: true,
        filters: {}
      };

      const logEntry = logFilterDecision(book, filterResult);

      expect(logEntry.status).toBe('PASSED');
      expect(logEntry.identifier).toBe('test-book-1');
      expect(logEntry.title).toBe('Test Book');
      expect(logEntry.author).toBe('Robin Sharma');
      expect(logEntry.genres).toEqual(['Philosophy']);
      expect(logEntry.reason).toBe('Passed all filters');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[IngestionFilter] PASSED: Test Book (test-book-1)')
      );

      consoleSpy.mockRestore();
    });

    it('should log filtered decision with reason', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const book = {
        identifier: 'test-book-2',
        title: 'Filtered Book',
        author: 'Unknown Author',
        genres: ['Science']
      };

      const filterResult = {
        passed: false,
        reason: 'Genre filter failed: Genre not in allowed list',
        filters: {}
      };

      const logEntry = logFilterDecision(book, filterResult);

      expect(logEntry.status).toBe('FILTERED');
      expect(logEntry.identifier).toBe('test-book-2');
      expect(logEntry.title).toBe('Filtered Book');
      expect(logEntry.reason).toBe('Genre filter failed: Genre not in allowed list');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[IngestionFilter] FILTERED: Filtered Book (test-book-2) - Genre filter failed')
      );

      consoleSpy.mockRestore();
    });

    it('should handle book with no author', () => {
      const book = {
        identifier: 'test-book-3',
        title: 'No Author Book',
        genres: ['Philosophy']
      };

      const filterResult = {
        passed: true,
        filters: {}
      };

      const logEntry = logFilterDecision(book, filterResult);

      expect(logEntry.author).toBe('Unknown');
    });

    it('should include timestamp in log entry', () => {
      const book = {
        identifier: 'test-book-4',
        title: 'Test Book',
        author: 'Test Author',
        genres: ['Philosophy']
      };

      const filterResult = {
        passed: true,
        filters: {}
      };

      const logEntry = logFilterDecision(book, filterResult);

      expect(logEntry.timestamp).toBeDefined();
      expect(new Date(logEntry.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('getFilterSummary', () => {
    it('should summarize active genre filter', () => {
      const config = {
        allowedGenres: ['Philosophy', 'History'],
        enableGenreFilter: true,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      const summary = getFilterSummary(config);

      expect(summary).toContain('Genre filter: 2 allowed genres');
      expect(summary).toContain('[Philosophy, History]');
      expect(summary).toContain('Author filter: disabled (allow all)');
    });

    it('should summarize active author filter', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Robin Sharma', 'Paulo Coelho'],
        enableAuthorFilter: true
      };

      const summary = getFilterSummary(config);

      expect(summary).toContain('Genre filter: disabled (allow all)');
      expect(summary).toContain('Author filter: 2 allowed authors');
      expect(summary).toContain('[Robin Sharma, Paulo Coelho]');
    });

    it('should summarize both filters active', () => {
      const config = {
        allowedGenres: ['Philosophy'],
        enableGenreFilter: true,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      const summary = getFilterSummary(config);

      expect(summary).toContain('Genre filter: 1 allowed genres');
      expect(summary).toContain('Author filter: 1 allowed authors');
    });

    it('should summarize no filters active', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      const summary = getFilterSummary(config);

      expect(summary).toContain('Genre filter: disabled (allow all)');
      expect(summary).toContain('Author filter: disabled (allow all)');
    });
  });

  describe('hasActiveFilters', () => {
    it('should return true when genre filter is active', () => {
      const config = {
        allowedGenres: ['Philosophy'],
        enableGenreFilter: true,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      expect(hasActiveFilters(config)).toBe(true);
    });

    it('should return true when author filter is active', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      expect(hasActiveFilters(config)).toBe(true);
    });

    it('should return true when both filters are active', () => {
      const config = {
        allowedGenres: ['Philosophy'],
        enableGenreFilter: true,
        allowedAuthors: ['Robin Sharma'],
        enableAuthorFilter: true
      };

      expect(hasActiveFilters(config)).toBe(true);
    });

    it('should return false when no filters are active', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: false,
        allowedAuthors: [],
        enableAuthorFilter: false
      };

      expect(hasActiveFilters(config)).toBe(false);
    });

    it('should return false when filters are enabled but lists are empty', () => {
      const config = {
        allowedGenres: [],
        enableGenreFilter: true,
        allowedAuthors: [],
        enableAuthorFilter: true
      };

      expect(hasActiveFilters(config)).toBe(false);
    });
  });
});
