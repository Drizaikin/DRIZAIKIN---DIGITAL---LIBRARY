/**
 * Integration test for Bulk Category Update
 * 
 * Tests the complete flow of bulk category updates
 * Requirements: 5.5.1-5.5.6
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { updateAllCategories } from '../../services/ingestion/bulkCategoryUpdate.js';
import { initSupabase } from '../../services/ingestion/databaseWriter.js';

describe('Bulk Category Update Integration', () => {
  // Skip if no database connection available
  const hasDatabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY;

  beforeAll(() => {
    if (hasDatabase) {
      initSupabase(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
    }
  });

  it.skipIf(!hasDatabase)('should successfully update categories in database', async () => {
    // This test requires a real database connection
    // It will be skipped in CI/CD if database is not available
    
    const result = await updateAllCategories();
    
    // Verify result structure
    expect(result).toHaveProperty('updated');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('details');
    
    // Verify result types
    expect(typeof result.updated).toBe('number');
    expect(typeof result.errors).toBe('number');
    expect(Array.isArray(result.details)).toBe(true);
    
    // Verify non-negative counts
    expect(result.updated).toBeGreaterThanOrEqual(0);
    expect(result.errors).toBeGreaterThanOrEqual(0);
    
    console.log('Bulk update result:', result);
  }, 60000); // 60 second timeout for large databases

  it.skipIf(!hasDatabase)('should provide progress feedback structure', async () => {
    // Mock console.log to capture progress messages
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    try {
      await updateAllCategories();
      
      // Verify progress messages were logged
      const hasStartMessage = logs.some(log => log.includes('Starting bulk category update'));
      const hasCompleteMessage = logs.some(log => log.includes('Update complete'));
      
      expect(hasStartMessage).toBe(true);
      expect(hasCompleteMessage).toBe(true);
    } finally {
      console.log = originalLog;
    }
  }, 60000);
});
