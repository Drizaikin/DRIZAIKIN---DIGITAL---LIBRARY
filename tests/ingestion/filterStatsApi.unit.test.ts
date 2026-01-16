/**
 * Unit Tests for Filter Statistics API
 * 
 * Tests the admin API endpoint for retrieving ingestion filter statistics.
 * 
 * Requirements: 5.7.4, 5.7.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn()
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

// Import after mocking
const { validateAuthorization, computeFilterStatistics } = await import('../../api/admin/ingestion/filter-stats.js');

describe('Filter Statistics API - Unit Tests', () => {
  
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
  
  describe('computeFilterStatistics', () => {
    const originalEnv = { ...process.env };
    
    beforeEach(() => {
      // Set up environment
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_KEY = 'test-key';
      
      // Reset mocks
      vi.clearAllMocks();
    });
    
    afterEach(() => {
      process.env = { ...originalEnv };
    });
    
    it('should return empty statistics when no logs available', async () => {
      // Mock empty logs response
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });
      
      const stats = await computeFilterStatistics(10);
      
      expect(stats.totalEvaluated).toBe(0);
      expect(stats.passed).toBe(0);
      expect(stats.filtered).toBe(0);
      expect(stats.filteredByGenre).toBe(0);
      expect(stats.filteredByAuthor).toBe(0);
      expect(stats.jobsAnalyzed).toBe(0);
      expect(stats.topFilteredGenres).toEqual([]);
      expect(stats.topFilteredAuthors).toEqual([]);
    });
    
    it('should compute statistics from single job log', async () => {
      // Mock single job log
      const mockLogs = [
        {
          id: 'job-1',
          books_processed: 100,
          books_added: 60,
          books_skipped: 20,
          books_failed: 5
          // filtered = 100 - (60 + 20 + 5) = 15
        }
      ];
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockLogs,
              error: null
            })
          })
        })
      });
      
      const stats = await computeFilterStatistics(10);
      
      expect(stats.totalEvaluated).toBe(100);
      expect(stats.passed).toBe(60);
      expect(stats.filtered).toBe(15);
      expect(stats.jobsAnalyzed).toBe(1);
    });
    
    it('should aggregate statistics from multiple job logs', async () => {
      // Mock multiple job logs
      const mockLogs = [
        {
          id: 'job-1',
          books_processed: 100,
          books_added: 60,
          books_skipped: 20,
          books_failed: 5
          // filtered = 15
        },
        {
          id: 'job-2',
          books_processed: 150,
          books_added: 80,
          books_skipped: 30,
          books_failed: 10
          // filtered = 30
        },
        {
          id: 'job-3',
          books_processed: 200,
          books_added: 120,
          books_skipped: 40,
          books_failed: 15
          // filtered = 25
        }
      ];
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockLogs,
              error: null
            })
          })
        })
      });
      
      const stats = await computeFilterStatistics(10);
      
      expect(stats.totalEvaluated).toBe(450); // 100 + 150 + 200
      expect(stats.passed).toBe(260); // 60 + 80 + 120
      expect(stats.filtered).toBe(70); // 15 + 30 + 25
      expect(stats.jobsAnalyzed).toBe(3);
    });
    
    it('should handle logs with null values', async () => {
      // Mock logs with null/undefined values
      const mockLogs = [
        {
          id: 'job-1',
          books_processed: null,
          books_added: null,
          books_skipped: null,
          books_failed: null
        },
        {
          id: 'job-2',
          books_processed: 100,
          books_added: 50,
          books_skipped: 25,
          books_failed: 10
        }
      ];
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockLogs,
              error: null
            })
          })
        })
      });
      
      const stats = await computeFilterStatistics(10);
      
      expect(stats.totalEvaluated).toBe(100);
      expect(stats.passed).toBe(50);
      expect(stats.filtered).toBe(15); // 100 - (50 + 25 + 10)
      expect(stats.jobsAnalyzed).toBe(2);
    });
    
    it('should not return negative filtered counts', async () => {
      // Mock log where processed < (added + skipped + failed)
      const mockLogs = [
        {
          id: 'job-1',
          books_processed: 50,
          books_added: 30,
          books_skipped: 20,
          books_failed: 10
          // Sum = 60, which is > processed (50)
          // Should result in filtered = 0, not negative
        }
      ];
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockLogs,
              error: null
            })
          })
        })
      });
      
      const stats = await computeFilterStatistics(10);
      
      expect(stats.filtered).toBe(0);
      expect(stats.filtered).toBeGreaterThanOrEqual(0);
    });
    
    it('should throw error when database query fails', async () => {
      // Mock database error
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      });
      
      await expect(computeFilterStatistics(10)).rejects.toThrow('Failed to fetch ingestion logs');
    });
    
    it('should respect the limit parameter', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null
      });
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: mockLimit
          })
        })
      });
      
      await computeFilterStatistics(25);
      
      expect(mockLimit).toHaveBeenCalledWith(25);
    });
    
    it('should include note about detailed statistics', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });
      
      const stats = await computeFilterStatistics(10);
      
      expect(stats.note).toBeDefined();
      expect(stats.note).toContain('ingestion_filter_stats');
    });
    
    it('should return zero for genre and author specific counts', async () => {
      // Since detailed filter data isn't stored yet, these should be 0
      const mockLogs = [
        {
          id: 'job-1',
          books_processed: 100,
          books_added: 60,
          books_skipped: 20,
          books_failed: 5
        }
      ];
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockLogs,
              error: null
            })
          })
        })
      });
      
      const stats = await computeFilterStatistics(10);
      
      expect(stats.filteredByGenre).toBe(0);
      expect(stats.filteredByAuthor).toBe(0);
      expect(stats.topFilteredGenres).toEqual([]);
      expect(stats.topFilteredAuthors).toEqual([]);
    });
  });
});
