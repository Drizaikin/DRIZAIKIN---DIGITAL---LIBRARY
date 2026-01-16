/**
 * Unit Tests for Bulk Category Update
 * **Feature: ingestion-filtering**
 * **Validates: Requirements 5.5.4, 5.5.6**
 * 
 * This test verifies the bulk category update functionality including
 * error handling and progress tracking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateAllCategories } from '../../services/ingestion/bulkCategoryUpdate.js';
import * as databaseWriter from '../../services/ingestion/databaseWriter.js';

// Mock the Supabase client
const mockSupabase = {
  from: vi.fn()
};

describe('Bulk Category Update - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getSupabase to return our mock client
    vi.spyOn(databaseWriter, 'getSupabase').mockReturnValue(mockSupabase as any);
  });

  /**
   * Test update with sample books
   * Requirements: 5.5.4
   */
  it('should update categories for sample books with genres', async () => {
    const sampleBooks = [
      { id: '1', genres: ['Fiction'] },
      { id: '2', genres: ['Mystery & Thriller', 'Fiction'] },
      { id: '3', genres: ['Science Fiction & Fantasy'] }
    ];

    // Mock the select query
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: sampleBooks,
        error: null
      })
    });

    // Mock the update queries
    const mockUpdate = vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ error: null })
    }));

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'books') {
        return {
          select: vi.fn().mockResolvedValue({
            data: sampleBooks,
            error: null
          }),
          update: mockUpdate
        };
      }
    });

    const result = await updateAllCategories();

    expect(result.updated).toBe(3);
    expect(result.errors).toBe(0);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  /**
   * Test update with books without genres (Uncategorized)
   * Requirements: 5.5.4
   */
  it('should set "Uncategorized" for books without genres', async () => {
    const sampleBooks = [
      { id: '1', genres: null },
      { id: '2', genres: [] },
      { id: '3', genres: ['Fiction'] }
    ];

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: sampleBooks,
        error: null
      })
    });

    const mockUpdate = vi.fn().mockImplementation((data) => ({
      eq: vi.fn().mockResolvedValue({ error: null })
    }));

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'books') {
        return {
          select: vi.fn().mockResolvedValue({
            data: sampleBooks,
            error: null
          }),
          update: mockUpdate
        };
      }
    });

    const result = await updateAllCategories();

    expect(result.updated).toBe(3);
    expect(result.errors).toBe(0);
    
    // Verify that Uncategorized was set for books without genres
    expect(mockUpdate).toHaveBeenCalledWith({ category: 'Uncategorized' });
    expect(mockUpdate).toHaveBeenCalledWith({ category: 'Fiction' });
  });

  /**
   * Test error handling - continues on individual book errors
   * Requirements: 5.5.4, 5.5.6
   */
  it('should handle errors gracefully and continue processing', async () => {
    const sampleBooks = [
      { id: '1', genres: ['Fiction'] },
      { id: '2', genres: ['Mystery & Thriller'] },
      { id: '3', genres: ['Science Fiction & Fantasy'] }
    ];

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: sampleBooks,
        error: null
      })
    });

    // Mock update to fail for the second book
    let callCount = 0;
    const mockUpdate = vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({ error: { message: 'Update failed' } });
        }
        return Promise.resolve({ error: null });
      })
    }));

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'books') {
        return {
          select: vi.fn().mockResolvedValue({
            data: sampleBooks,
            error: null
          }),
          update: mockUpdate
        };
      }
    });

    const result = await updateAllCategories();

    expect(result.updated).toBe(2);
    expect(result.errors).toBe(1);
    expect(result.details).toHaveLength(1);
    expect(result.details[0].bookId).toBe('2');
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  /**
   * Test progress tracking
   * Requirements: 5.5.6
   */
  it('should track progress correctly', async () => {
    // Create 150 books to test progress logging
    const sampleBooks = Array.from({ length: 150 }, (_, i) => ({
      id: `${i + 1}`,
      genres: ['Fiction']
    }));

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: sampleBooks,
        error: null
      })
    });

    const mockUpdate = vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ error: null })
    }));

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'books') {
        return {
          select: vi.fn().mockResolvedValue({
            data: sampleBooks,
            error: null
          }),
          update: mockUpdate
        };
      }
    });

    const consoleSpy = vi.spyOn(console, 'log');

    const result = await updateAllCategories();

    expect(result.updated).toBe(150);
    expect(result.errors).toBe(0);
    
    // Verify progress was logged at 100 books
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Progress: 100/150')
    );

    consoleSpy.mockRestore();
  });

  /**
   * Test handling of fetch errors
   * Requirements: 5.5.4
   */
  it('should handle fetch errors and return error details', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      })
    });

    const result = await updateAllCategories();

    expect(result.updated).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.details).toHaveLength(1);
    expect(result.details[0].error).toBe('Database connection failed');
  });

  /**
   * Test handling of empty book list
   * Requirements: 5.5.4
   */
  it('should handle empty book list gracefully', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [],
        error: null
      })
    });

    const result = await updateAllCategories();

    expect(result.updated).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.details).toHaveLength(0);
  });
});
