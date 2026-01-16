/**
 * Unit Tests for Filter Configuration API
 * 
 * Tests the admin API endpoints for managing ingestion filter configuration.
 * 
 * Requirements: 5.8.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the dependencies
vi.mock('../../../services/ingestion/genreTaxonomy.js', () => ({
  PRIMARY_GENRES: [
    'Philosophy',
    'Religion',
    'History',
    'Science',
    'Literature',
    'Fiction'
  ]
}));

vi.mock('../../../services/ingestion/ingestionFilter.js', () => ({
  validateGenreNames: (genres: string[]) => {
    const validGenres = ['Philosophy', 'Religion', 'History', 'Science', 'Literature', 'Fiction'];
    const invalidGenres = genres.filter(g => !validGenres.includes(g));
    return {
      valid: invalidGenres.length === 0,
      invalidGenres
    };
  }
}));

// Import after mocking
const { validateAuthorization, validateFilterConfig, getCurrentConfig } = await import('../../api/admin/ingestion/filters.js');

describe('Filter Configuration API - Unit Tests', () => {
  
  describe('validateAuthorization', () => {
    const originalSecret = process.env.ADMIN_HEALTH_SECRET;
    
    beforeEach(() => {
      // Reset environment
      process.env.ADMIN_HEALTH_SECRET = 'test-secret-123';
    });
    
    afterEach(() => {
      process.env.ADMIN_HEALTH_SECRET = originalSecret;
    });
    
    it('should reject when ADMIN_HEALTH_SECRET is not configured', () => {
      delete process.env.ADMIN_HEALTH_SECRET;
      
      const result = validateAuthorization('Bearer anything');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Service not configured');
    });
    
    it('should reject when authorization header is missing', () => {
      const result = validateAuthorization(undefined);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Authorization required');
    });
    
    it('should reject when authorization header is invalid', () => {
      const result = validateAuthorization('Bearer wrong-secret');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid authorization');
    });
    
    it('should accept valid authorization header', () => {
      const result = validateAuthorization('Bearer test-secret-123');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
  
  describe('validateFilterConfig', () => {
    
    it('should reject non-object configuration', () => {
      const result = validateFilterConfig(null);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });
    
    it('should reject when allowedGenres is not an array', () => {
      const config = {
        allowedGenres: 'not-an-array'
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('allowedGenres must be an array');
    });
    
    it('should reject invalid genre names', () => {
      const config = {
        allowedGenres: ['Philosophy', 'InvalidGenre', 'History']
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid genres: InvalidGenre');
    });
    
    it('should accept valid genre names', () => {
      const config = {
        allowedGenres: ['Philosophy', 'History', 'Science']
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject when allowedAuthors is not an array', () => {
      const config = {
        allowedAuthors: 'not-an-array'
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('allowedAuthors must be an array');
    });
    
    it('should reject empty author names', () => {
      const config = {
        allowedAuthors: ['Robin Sharma', '', '  ', 'Paulo Coelho']
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('All author names must be non-empty strings');
    });
    
    it('should reject non-string author names', () => {
      const config = {
        allowedAuthors: ['Robin Sharma', 123, 'Paulo Coelho']
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('All author names must be non-empty strings');
    });
    
    it('should accept valid author names', () => {
      const config = {
        allowedAuthors: ['Robin Sharma', 'Paulo Coelho', 'Dale Carnegie']
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject non-boolean enableGenreFilter', () => {
      const config = {
        enableGenreFilter: 'true'
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('enableGenreFilter must be a boolean');
    });
    
    it('should reject non-boolean enableAuthorFilter', () => {
      const config = {
        enableAuthorFilter: 1
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('enableAuthorFilter must be a boolean');
    });
    
    it('should accept complete valid configuration', () => {
      const config = {
        allowedGenres: ['Philosophy', 'History'],
        allowedAuthors: ['Robin Sharma', 'Paulo Coelho'],
        enableGenreFilter: true,
        enableAuthorFilter: false
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should accept empty arrays for filters', () => {
      const config = {
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: false,
        enableAuthorFilter: false
      };
      
      const result = validateFilterConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
  
  describe('getCurrentConfig', () => {
    const originalEnv = { ...process.env };
    
    beforeEach(() => {
      // Clear relevant environment variables
      delete process.env.INGEST_ALLOWED_GENRES;
      delete process.env.INGEST_ALLOWED_AUTHORS;
      delete process.env.ENABLE_GENRE_FILTER;
      delete process.env.ENABLE_AUTHOR_FILTER;
    });
    
    afterEach(() => {
      // Restore environment
      process.env = { ...originalEnv };
    });
    
    it('should return empty configuration when no environment variables set', () => {
      const config = getCurrentConfig();
      
      expect(config.allowedGenres).toEqual([]);
      expect(config.allowedAuthors).toEqual([]);
      expect(config.enableGenreFilter).toBe(false);
      expect(config.enableAuthorFilter).toBe(false);
    });
    
    it('should parse comma-separated genres from environment', () => {
      process.env.INGEST_ALLOWED_GENRES = 'Philosophy,History,Science';
      
      const config = getCurrentConfig();
      
      expect(config.allowedGenres).toEqual(['Philosophy', 'History', 'Science']);
    });
    
    it('should parse comma-separated authors from environment', () => {
      process.env.INGEST_ALLOWED_AUTHORS = 'Robin Sharma,Paulo Coelho,Dale Carnegie';
      
      const config = getCurrentConfig();
      
      expect(config.allowedAuthors).toEqual(['Robin Sharma', 'Paulo Coelho', 'Dale Carnegie']);
    });
    
    it('should trim whitespace from genres', () => {
      process.env.INGEST_ALLOWED_GENRES = ' Philosophy , History , Science ';
      
      const config = getCurrentConfig();
      
      expect(config.allowedGenres).toEqual(['Philosophy', 'History', 'Science']);
    });
    
    it('should trim whitespace from authors', () => {
      process.env.INGEST_ALLOWED_AUTHORS = ' Robin Sharma , Paulo Coelho ';
      
      const config = getCurrentConfig();
      
      expect(config.allowedAuthors).toEqual(['Robin Sharma', 'Paulo Coelho']);
    });
    
    it('should parse enable flags correctly', () => {
      process.env.ENABLE_GENRE_FILTER = 'true';
      process.env.ENABLE_AUTHOR_FILTER = 'true';
      
      const config = getCurrentConfig();
      
      expect(config.enableGenreFilter).toBe(true);
      expect(config.enableAuthorFilter).toBe(true);
    });
    
    it('should treat non-true values as false for enable flags', () => {
      process.env.ENABLE_GENRE_FILTER = 'false';
      process.env.ENABLE_AUTHOR_FILTER = 'yes';
      
      const config = getCurrentConfig();
      
      expect(config.enableGenreFilter).toBe(false);
      expect(config.enableAuthorFilter).toBe(false);
    });
  });
});
