/**
 * Unit Tests for Category Sync
 * **Feature: ingestion-filtering**
 * **Validates: Requirements 5.4.1, 5.4.5**
 * 
 * This test verifies that the category field is automatically synced with the first genre
 * from the genres array, or set to "Uncategorized" when genres are empty.
 */

import { describe, it, expect } from 'vitest';
import { syncCategory } from '../../services/ingestion/databaseWriter.js';

describe('Category Sync - Unit Tests', () => {
  /**
   * Test category sync with 1 genre
   * Requirements: 5.4.1, 5.4.5
   */
  it('should sync category with first genre when genres array has 1 genre', () => {
    const genres = ['Fiction'];
    const result = syncCategory(genres);
    expect(result).toBe('Fiction');
  });

  /**
   * Test category sync with 2 genres
   * Requirements: 5.4.1, 5.4.5
   */
  it('should sync category with first genre when genres array has 2 genres', () => {
    const genres = ['Mystery & Thriller', 'Fiction'];
    const result = syncCategory(genres);
    expect(result).toBe('Mystery & Thriller');
  });

  /**
   * Test category sync with 3 genres
   * Requirements: 5.4.1, 5.4.5
   */
  it('should sync category with first genre when genres array has 3 genres', () => {
    const genres = ['Science Fiction & Fantasy', 'Fiction', 'Adventure'];
    const result = syncCategory(genres);
    expect(result).toBe('Science Fiction & Fantasy');
  });

  /**
   * Test "Uncategorized" default for empty genres array
   * Requirements: 5.4.1, 5.4.5
   */
  it('should return "Uncategorized" when genres array is empty', () => {
    const genres: string[] = [];
    const result = syncCategory(genres);
    expect(result).toBe('Uncategorized');
  });

  /**
   * Test "Uncategorized" default for null genres
   * Requirements: 5.4.1, 5.4.5
   */
  it('should return "Uncategorized" when genres is null', () => {
    const result = syncCategory(null);
    expect(result).toBe('Uncategorized');
  });

  /**
   * Test "Uncategorized" default for undefined genres
   * Requirements: 5.4.1, 5.4.5
   */
  it('should return "Uncategorized" when genres is undefined', () => {
    const result = syncCategory(undefined);
    expect(result).toBe('Uncategorized');
  });
});
