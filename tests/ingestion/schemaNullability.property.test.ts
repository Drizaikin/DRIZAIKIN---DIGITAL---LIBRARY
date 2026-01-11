/**
 * Property-Based Tests for Schema Nullability
 * **Feature: public-domain-book-ingestion, Property 8: New Schema Fields Are Nullable**
 * **Validates: Requirements 11.3**
 * 
 * This test verifies that books can be inserted with null values for the new
 * ingestion tracking fields (source, source_identifier, pdf_url, language),
 * ensuring backward compatibility with manual admin uploads.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase: SupabaseClient;
let schemaReady = false;

// Test data tracking for cleanup
const createdBookIds: string[] = [];

beforeAll(async () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in .env.local');
  }
  supabase = createClient(supabaseUrl, supabaseKey);
  
  // Check if the new columns exist in the books table
  schemaReady = await checkSchemaReady();
  
  if (!schemaReady) {
    console.warn('WARNING: New ingestion columns do not exist. Please run supabase_public_domain_ingestion.sql first.');
  }
});

afterEach(async () => {
  // Clean up created books after each test
  for (const bookId of createdBookIds) {
    await supabase.from('books').delete().eq('id', bookId);
  }
  createdBookIds.length = 0;
});

afterAll(async () => {
  // Final cleanup
  for (const bookId of createdBookIds) {
    await supabase.from('books').delete().eq('id', bookId);
  }
});

/**
 * Check if the new schema columns exist
 */
async function checkSchemaReady(): Promise<boolean> {
  try {
    // Try to select the new columns - if they don't exist, this will fail
    const { error } = await supabase
      .from('books')
      .select('source, source_identifier, pdf_url, language')
      .limit(1);
    
    return !error;
  } catch {
    return false;
  }
}

/**
 * Helper to create a book with null ingestion fields (simulating manual upload)
 */
async function createBookWithNullIngestionFields(
  title: string,
  author: string,
  copiesAvailable: number
): Promise<{ success: boolean; bookId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('books')
      .insert({
        title,
        author,
        copies_available: copiesAvailable,
        total_copies: copiesAvailable,
        // Explicitly NOT setting source, source_identifier, pdf_url, language
        // They should default to null
      })
      .select('id, source, source_identifier, pdf_url, language')
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    createdBookIds.push(data.id);
    return { success: true, bookId: data.id };
  } catch (err) {
    return { success: false, error: `Unexpected error: ${err}` };
  }
}

/**
 * Helper to verify a book's ingestion fields are null
 */
async function verifyBookIngestionFieldsNull(bookId: string): Promise<{
  source: string | null;
  source_identifier: string | null;
  pdf_url: string | null;
  language: string | null;
}> {
  const { data, error } = await supabase
    .from('books')
    .select('source, source_identifier, pdf_url, language')
    .eq('id', bookId)
    .single();
  
  if (error) throw new Error(`Failed to get book: ${error.message}`);
  
  return {
    source: data.source,
    source_identifier: data.source_identifier,
    pdf_url: data.pdf_url,
    language: data.language
  };
}

/**
 * Helper to verify a book can be queried normally
 */
async function verifyBookQueryable(bookId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, copies_available')
    .eq('id', bookId)
    .single();
  
  return !error && data !== null;
}

describe('Schema Nullability - Property Tests', () => {
  /**
   * **Feature: public-domain-book-ingestion, Property 8: New Schema Fields Are Nullable**
   * **Validates: Requirements 11.3**
   * 
   * Property: For any book inserted via manual admin upload (without source tracking):
   * - The source field MAY be null
   * - The source_identifier field MAY be null
   * - The pdf_url field MAY be null
   * - The language field MAY be null
   * - The book SHALL be successfully inserted and queryable
   */
  it('Property 8: New Schema Fields Are Nullable - books can be inserted with null ingestion fields', async () => {
    // Fail test if schema is not ready - migration must be run first
    if (!schemaReady) {
      throw new Error(
        'PREREQUISITE NOT MET: New ingestion columns do not exist in books table. ' +
        'Please run supabase_public_domain_ingestion.sql in your Supabase SQL Editor first.'
      );
    }
    
    await fc.assert(
      fc.asyncProperty(
        // Generate random book title (non-empty string)
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        // Generate random author name (non-empty string)
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        // Generate random copies_available between 1 and 100
        fc.integer({ min: 1, max: 100 }),
        // Generate unique suffix for title to avoid conflicts
        fc.integer({ min: 1, max: 999999 }),
        async (baseTitle, author, copiesAvailable, uniqueSuffix) => {
          // Create unique title to avoid conflicts
          const timestamp = Date.now();
          const title = `${baseTitle}_PBT_${timestamp}_${uniqueSuffix}`;
          
          // Create book WITHOUT setting ingestion fields (simulating manual upload)
          const result = await createBookWithNullIngestionFields(title, author, copiesAvailable);
          
          // PROPERTY ASSERTION 1: Book should be successfully inserted
          if (!result.success) {
            throw new Error(`Failed to insert book with null ingestion fields: ${result.error}`);
          }
          
          expect(result.success).toBe(true);
          expect(result.bookId).toBeDefined();
          
          // PROPERTY ASSERTION 2: All ingestion fields should be null
          const fields = await verifyBookIngestionFieldsNull(result.bookId!);
          expect(fields.source).toBeNull();
          expect(fields.source_identifier).toBeNull();
          expect(fields.pdf_url).toBeNull();
          expect(fields.language).toBeNull();
          
          // PROPERTY ASSERTION 3: Book should be queryable
          const isQueryable = await verifyBookQueryable(result.bookId!);
          expect(isQueryable).toBe(true);
          
          // Cleanup for this iteration
          await supabase.from('books').delete().eq('id', result.bookId);
          const idx = createdBookIds.indexOf(result.bookId!);
          if (idx > -1) createdBookIds.splice(idx, 1);
        }
      ),
      { numRuns: 20 } // Reduced from 100 due to database operation overhead per iteration
    );
  }, 180000); // 3 minute timeout for database operations
});
