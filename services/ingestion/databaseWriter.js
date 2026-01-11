/**
 * Database Writer Service
 * 
 * Inserts book records into Supabase Postgres.
 * Logs ingestion job results for tracking.
 * 
 * Requirements: 6.1, 6.2, 6.3
 */

import { createClient } from '@supabase/supabase-js';

// Source identifier for Internet Archive books
const INTERNET_ARCHIVE_SOURCE = 'internet_archive';

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
 * Inserts a book record into the database
 * @param {Object} book - Book data to insert
 * @param {string} book.title - Book title (required)
 * @param {string} book.author - Book author (required)
 * @param {number} [book.year] - Publication year
 * @param {string} [book.language] - Language code
 * @param {string} book.source_identifier - Internet Archive identifier (required)
 * @param {string} book.pdf_url - Public URL to PDF (required)
 * @param {string} [book.description] - Book description
 * @param {string} [book.cover_url] - Cover image URL
 * @param {string} [book.category_id] - Category UUID
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function insertBook(book) {
  if (!book || typeof book !== 'object') {
    return { success: false, error: 'Invalid book data: must be an object' };
  }
  
  // Validate required fields
  if (!book.title || typeof book.title !== 'string') {
    return { success: false, error: 'Invalid book data: title is required' };
  }
  
  if (!book.author || typeof book.author !== 'string') {
    return { success: false, error: 'Invalid book data: author is required' };
  }
  
  if (!book.source_identifier || typeof book.source_identifier !== 'string') {
    return { success: false, error: 'Invalid book data: source_identifier is required' };
  }
  
  if (!book.pdf_url || typeof book.pdf_url !== 'string') {
    return { success: false, error: 'Invalid book data: pdf_url is required' };
  }

  const client = getSupabase();
  
  // Prepare book record with defaults
  const bookRecord = {
    title: book.title.trim(),
    author: book.author.trim(),
    published_year: book.year || null,
    language: book.language || null,
    source: INTERNET_ARCHIVE_SOURCE, // Requirement 6.2: Set source to "internet_archive"
    source_identifier: book.source_identifier,
    pdf_url: book.pdf_url,
    description: book.description || null,
    cover_url: book.cover_url || 'https://picsum.photos/seed/book/400/600',
    category_id: book.category_id || null,
    total_copies: book.total_copies || 1,
    copies_available: book.copies_available || 1,
    popularity: book.popularity || 0
  };
  
  console.log(`[DatabaseWriter] Inserting book: ${bookRecord.title}`);
  
  try {
    const { data, error } = await client
      .from('books')
      .insert(bookRecord)
      .select('id')
      .single();
    
    if (error) {
      // Handle duplicate key error gracefully
      if (error.code === '23505') { // Unique violation
        console.log(`[DatabaseWriter] Book already exists: ${book.source_identifier}`);
        return { success: false, error: 'Book already exists (duplicate source_identifier)' };
      }
      
      console.error(`[DatabaseWriter] Insert error: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    console.log(`[DatabaseWriter] Book inserted successfully: ${data.id}`);
    return { success: true, id: data.id };
  } catch (error) {
    console.error(`[DatabaseWriter] Unexpected error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Creates a new ingestion job log entry
 * @param {string} jobType - Type of job ('scheduled' or 'manual')
 * @returns {Promise<{success: boolean, jobId?: string, error?: string}>}
 */
export async function createJobLog(jobType = 'scheduled') {
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('ingestion_logs')
      .insert({
        job_type: jobType,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`[DatabaseWriter] Error creating job log: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    console.log(`[DatabaseWriter] Created job log: ${data.id}`);
    return { success: true, jobId: data.id };
  } catch (error) {
    console.error(`[DatabaseWriter] Unexpected error creating job log: ${error.message}`);
    return { success: false, error: error.message };
  }
}


/**
 * Logs ingestion job results
 * @param {Object} result - Job execution results
 * @param {string} result.jobId - Job ID from createJobLog
 * @param {string} result.status - Job status ('completed', 'failed', 'partial')
 * @param {number} result.processed - Total books processed
 * @param {number} result.added - Books successfully added
 * @param {number} result.skipped - Books skipped (duplicates)
 * @param {number} result.failed - Books that failed
 * @param {Array<{identifier: string, error: string}>} [result.errors] - Error details
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function logJobResult(result) {
  if (!result || typeof result !== 'object') {
    return { success: false, error: 'Invalid result: must be an object' };
  }
  
  if (!result.jobId || typeof result.jobId !== 'string') {
    return { success: false, error: 'Invalid result: jobId is required' };
  }

  const client = getSupabase();
  
  // Prepare update data
  const updateData = {
    status: result.status || 'completed',
    completed_at: new Date().toISOString(),
    books_processed: result.processed || 0,
    books_added: result.added || 0,
    books_skipped: result.skipped || 0,
    books_failed: result.failed || 0,
    error_details: result.errors && result.errors.length > 0 ? result.errors : null
  };
  
  console.log(`[DatabaseWriter] Logging job result: ${result.jobId} - ${updateData.status}`);
  console.log(`[DatabaseWriter] Stats: processed=${updateData.books_processed}, added=${updateData.books_added}, skipped=${updateData.books_skipped}, failed=${updateData.books_failed}`);
  
  try {
    const { error } = await client
      .from('ingestion_logs')
      .update(updateData)
      .eq('id', result.jobId);
    
    if (error) {
      console.error(`[DatabaseWriter] Error logging job result: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    console.log(`[DatabaseWriter] Job result logged successfully`);
    return { success: true };
  } catch (error) {
    console.error(`[DatabaseWriter] Unexpected error logging job result: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Gets recent ingestion job logs
 * @param {number} limit - Maximum number of logs to return (default: 10)
 * @returns {Promise<Array<Object>>} Array of job logs
 */
export async function getRecentJobLogs(limit = 10) {
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('ingestion_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error(`[DatabaseWriter] Error fetching job logs: ${error.message}`);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error(`[DatabaseWriter] Unexpected error fetching job logs: ${error.message}`);
    return [];
  }
}

/**
 * Gets a specific job log by ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>} Job log or null if not found
 */
export async function getJobLog(jobId) {
  if (!jobId || typeof jobId !== 'string') {
    return null;
  }

  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('ingestion_logs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (error) {
      console.error(`[DatabaseWriter] Error fetching job log: ${error.message}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`[DatabaseWriter] Unexpected error fetching job log: ${error.message}`);
    return null;
  }
}

export { INTERNET_ARCHIVE_SOURCE };
