/**
 * Deduplication Engine Service
 * 
 * Prevents duplicate book entries using source_identifier.
 * Checks against the database to ensure idempotent ingestion.
 * 
 * Requirements: 3.1, 3.2
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side operations
let supabase = null;

/**
 * Initialize the Supabase client
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase service key
 */
export function initSupabase(url, key) {
  if (!url || !key) {
    throw new Error('Supabase URL and key are required');
  }
  supabase = createClient(url, key);
  return supabase;
}

/**
 * Get the Supabase client instance
 * @returns {Object} Supabase client
 */
export function getSupabase() {
  if (!supabase) {
    // Try to initialize from environment variables
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (url && key) {
      return initSupabase(url, key);
    }
    throw new Error('Supabase client not initialized. Call initSupabase() first.');
  }
  return supabase;
}

/**
 * Checks if a book already exists in the database by source_identifier
 * @param {string} sourceIdentifier - Internet Archive identifier
 * @returns {Promise<boolean>} True if book exists
 */
export async function bookExists(sourceIdentifier) {
  if (!sourceIdentifier || typeof sourceIdentifier !== 'string') {
    return false;
  }

  const client = getSupabase();
  
  const { data, error } = await client
    .from('books')
    .select('id')
    .eq('source_identifier', sourceIdentifier)
    .maybeSingle();
  
  if (error) {
    console.error('[DeduplicationEngine] Error checking book existence:', error.message);
    throw error;
  }
  
  return data !== null;
}

/**
 * Filters out books that already exist in the database
 * @param {Array<Object>} books - Array of book metadata with identifier field
 * @returns {Promise<Array<Object>>} Filtered array of new books
 */
export async function filterNewBooks(books) {
  if (!Array.isArray(books) || books.length === 0) {
    return [];
  }

  const client = getSupabase();
  
  // Extract all identifiers
  const identifiers = books
    .map(book => book.identifier)
    .filter(id => id && typeof id === 'string');
  
  if (identifiers.length === 0) {
    return [];
  }

  // Batch query for existing identifiers
  const { data: existingBooks, error } = await client
    .from('books')
    .select('source_identifier')
    .in('source_identifier', identifiers);
  
  if (error) {
    console.error('[DeduplicationEngine] Error filtering books:', error.message);
    throw error;
  }
  
  // Create a Set of existing identifiers for O(1) lookup
  const existingIdentifiers = new Set(
    (existingBooks || []).map(book => book.source_identifier)
  );
  
  // Filter out books that already exist
  const newBooks = books.filter(book => 
    book.identifier && !existingIdentifiers.has(book.identifier)
  );
  
  console.log(`[DeduplicationEngine] Filtered ${books.length} books: ${newBooks.length} new, ${books.length - newBooks.length} duplicates`);
  
  return newBooks;
}

/**
 * Gets the count of existing books with a specific source
 * @param {string} source - Source name (e.g., 'internet_archive')
 * @returns {Promise<number>} Count of books from this source
 */
export async function getSourceBookCount(source) {
  const client = getSupabase();
  
  const { count, error } = await client
    .from('books')
    .select('*', { count: 'exact', head: true })
    .eq('source', source);
  
  if (error) {
    console.error('[DeduplicationEngine] Error getting source book count:', error.message);
    throw error;
  }
  
  return count || 0;
}
