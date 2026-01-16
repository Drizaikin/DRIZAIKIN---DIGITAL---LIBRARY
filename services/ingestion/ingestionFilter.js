/**
 * Ingestion Filter Module
 * 
 * Provides configurable filtering for book ingestion based on genre and author criteria.
 * Filters are applied after AI classification but before PDF download to save bandwidth.
 * 
 * Requirements: 5.1.1-5.1.7, 5.2.1-5.2.7, 5.6.1-5.6.6, 5.7.5
 */

import { validateGenres, PRIMARY_GENRES } from './genreTaxonomy.js';
import { createClient } from '@supabase/supabase-js';

// Supabase client for filter stats logging
let supabaseClient = null;

/**
 * Initializes the Supabase client for filter stats logging
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase service key
 */
export function initFilterStatsClient(url, key) {
  if (url && key) {
    supabaseClient = createClient(url, key);
  }
}

/**
 * Gets the Supabase client, initializing from environment if needed
 * @returns {Object|null} Supabase client or null if not configured
 */
function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  if (url && key) {
    supabaseClient = createClient(url, key);
    return supabaseClient;
  }
  
  return null;
}

/**
 * Loads filter configuration from environment variables
 * @returns {Object} Filter configuration
 */
export function loadFilterConfig() {
  // Parse allowed genres from environment (comma-separated)
  const allowedGenresStr = process.env.INGEST_ALLOWED_GENRES || '';
  const allowedGenres = allowedGenresStr
    .split(',')
    .map(g => g.trim())
    .filter(g => g.length > 0);
  
  // Parse allowed authors from environment (comma-separated)
  const allowedAuthorsStr = process.env.INGEST_ALLOWED_AUTHORS || '';
  const allowedAuthors = allowedAuthorsStr
    .split(',')
    .map(a => a.trim())
    .filter(a => a.length > 0);
  
  // Parse enable flags
  const enableGenreFilter = process.env.ENABLE_GENRE_FILTER === 'true';
  const enableAuthorFilter = process.env.ENABLE_AUTHOR_FILTER === 'true';
  
  return {
    allowedGenres,
    allowedAuthors,
    enableGenreFilter,
    enableAuthorFilter
  };
}

/**
 * Validates genre names against taxonomy
 * @param {string[]} genres - Genre names to validate
 * @returns {{valid: boolean, invalidGenres: string[]}}
 */
export function validateGenreNames(genres) {
  if (!Array.isArray(genres)) {
    return { valid: false, invalidGenres: [] };
  }
  
  const invalidGenres = [];
  const genreSet = new Set(PRIMARY_GENRES.map(g => g.toLowerCase()));
  
  for (const genre of genres) {
    // Trim whitespace before validation (consistent with validateGenre in genreTaxonomy.js)
    const trimmedGenre = typeof genre === 'string' ? genre.trim() : genre;
    if (!trimmedGenre || !genreSet.has(trimmedGenre.toLowerCase())) {
      invalidGenres.push(genre);
    }
  }
  
  return {
    valid: invalidGenres.length === 0,
    invalidGenres
  };
}

/**
 * Checks if a book passes the genre filter
 * @param {string[]} bookGenres - Book's genres
 * @param {Object} config - Filter configuration
 * @returns {{passed: boolean, reason?: string}}
 */
export function checkGenreFilter(bookGenres, config) {
  // If filter is disabled, pass
  if (!config.enableGenreFilter) {
    return { passed: true };
  }
  
  // If allowed genres list is empty, allow all (Requirement 5.1.3)
  if (!config.allowedGenres || config.allowedGenres.length === 0) {
    return { passed: true };
  }
  
  // If book has no genres, fail the filter
  if (!bookGenres || bookGenres.length === 0) {
    return { 
      passed: false, 
      reason: 'Book has no genres' 
    };
  }
  
  // Check if ANY of the book's genres match allowed genres (Requirement 5.1.2)
  const allowedGenresLower = config.allowedGenres.map(g => g.toLowerCase());
  const hasMatch = bookGenres.some(genre => 
    allowedGenresLower.includes(genre.toLowerCase())
  );
  
  if (hasMatch) {
    return { passed: true };
  }
  
  return { 
    passed: false, 
    reason: `Genre not in allowed list. Book genres: [${bookGenres.join(', ')}], Allowed: [${config.allowedGenres.join(', ')}]` 
  };
}

/**
 * Checks if a book passes the author filter
 * @param {string} bookAuthor - Book's author
 * @param {Object} config - Filter configuration
 * @returns {{passed: boolean, reason?: string}}
 */
export function checkAuthorFilter(bookAuthor, config) {
  // If filter is disabled, pass
  if (!config.enableAuthorFilter) {
    return { passed: true };
  }
  
  // If allowed authors list is empty, allow all (Requirement 5.2.3)
  if (!config.allowedAuthors || config.allowedAuthors.length === 0) {
    return { passed: true };
  }
  
  // If book has no author, fail the filter
  if (!bookAuthor || typeof bookAuthor !== 'string') {
    return { 
      passed: false, 
      reason: 'Book has no author' 
    };
  }
  
  // Normalize book author (lowercase, trim) (Requirement 5.2.5)
  const normalizedBookAuthor = bookAuthor.toLowerCase().trim();
  
  // Check if ANY allowed author is a substring of book's author (Requirements 5.2.2, 5.2.6)
  const hasMatch = config.allowedAuthors.some(allowedAuthor => {
    const normalizedAllowed = allowedAuthor.toLowerCase().trim();
    return normalizedBookAuthor.includes(normalizedAllowed);
  });
  
  if (hasMatch) {
    return { passed: true };
  }
  
  return { 
    passed: false, 
    reason: `Author not in allowed list. Book author: "${bookAuthor}", Allowed: [${config.allowedAuthors.join(', ')}]` 
  };
}

/**
 * Applies all configured filters to a book
 * @param {Object} book - Book metadata
 * @param {string} book.identifier - Book identifier
 * @param {string} book.title - Book title
 * @param {string} [book.author] - Book author
 * @param {string[]} [book.genres] - Book genres
 * @param {Object} config - Filter configuration
 * @returns {{passed: boolean, reason?: string, filters: Object}}
 */
export function applyFilters(book, config) {
  const filterResults = {
    genre: null,
    author: null
  };
  
  // Apply genre filter (Requirement 5.6.2)
  const genreResult = checkGenreFilter(book.genres, config);
  filterResults.genre = genreResult;
  
  if (!genreResult.passed) {
    return {
      passed: false,
      reason: `Genre filter failed: ${genreResult.reason}`,
      filters: filterResults
    };
  }
  
  // Apply author filter (Requirement 5.6.3)
  const authorResult = checkAuthorFilter(book.author, config);
  filterResults.author = authorResult;
  
  if (!authorResult.passed) {
    return {
      passed: false,
      reason: `Author filter failed: ${authorResult.reason}`,
      filters: filterResults
    };
  }
  
  // All filters passed (Requirement 5.6.5)
  return {
    passed: true,
    filters: filterResults
  };
}

/**
 * Logs filter decision for audit trail
 * @param {Object} book - Book metadata
 * @param {Object} filterResult - Result from applyFilters
 * @param {string} [jobId] - Optional job ID for linking to ingestion_logs
 * @returns {Object} Log entry object
 */
export function logFilterDecision(book, filterResult, jobId = null) {
  const timestamp = new Date().toISOString();
  const status = filterResult.passed ? 'PASSED' : 'FILTERED';
  
  // Determine filter result type for database
  let filterResultType = 'passed';
  if (!filterResult.passed) {
    if (filterResult.reason && filterResult.reason.includes('Genre filter')) {
      filterResultType = 'filtered_genre';
    } else if (filterResult.reason && filterResult.reason.includes('Author filter')) {
      filterResultType = 'filtered_author';
    }
  }
  
  const logEntry = {
    timestamp,
    status,
    identifier: book.identifier,
    title: book.title,
    author: book.author || 'Unknown',
    genres: book.genres || [],
    reason: filterResult.reason || 'Passed all filters',
    filterResultType,
    jobId
  };
  
  // Log to console (Requirements 5.1.7, 5.2.7, 5.6.4)
  if (filterResult.passed) {
    console.log(`[IngestionFilter] ${status}: ${book.title} (${book.identifier})`);
  } else {
    console.log(`[IngestionFilter] ${status}: ${book.title} (${book.identifier}) - ${filterResult.reason}`);
  }
  
  // Return log entry for potential database storage
  return logEntry;
}

/**
 * Saves filter decision to the database for audit trail and statistics
 * @param {Object} book - Book metadata
 * @param {Object} filterResult - Result from applyFilters
 * @param {string} [jobId] - Optional job ID for linking to ingestion_logs
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveFilterDecision(book, filterResult, jobId = null) {
  const client = getSupabaseClient();
  
  if (!client) {
    console.warn('[IngestionFilter] Supabase client not configured, skipping database logging');
    return { success: false, error: 'Supabase client not configured' };
  }
  
  try {
    // Determine filter result type
    let filterResultType = 'passed';
    if (!filterResult.passed) {
      if (filterResult.reason && filterResult.reason.includes('Genre filter')) {
        filterResultType = 'filtered_genre';
      } else if (filterResult.reason && filterResult.reason.includes('Author filter')) {
        filterResultType = 'filtered_author';
      }
    }
    
    const record = {
      job_id: jobId || null,
      book_identifier: book.identifier,
      book_title: book.title || null,
      book_author: book.author || null,
      book_genres: book.genres || null,
      filter_result: filterResultType,
      filter_reason: filterResult.reason || null
    };
    
    const { error } = await client
      .from('ingestion_filter_stats')
      .insert(record);
    
    if (error) {
      console.error(`[IngestionFilter] Failed to save filter decision: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error(`[IngestionFilter] Error saving filter decision: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Logs and saves filter decision (combines console logging and database storage)
 * @param {Object} book - Book metadata
 * @param {Object} filterResult - Result from applyFilters
 * @param {string} [jobId] - Optional job ID for linking to ingestion_logs
 * @returns {Promise<Object>} Log entry object
 */
export async function logAndSaveFilterDecision(book, filterResult, jobId = null) {
  // Log to console
  const logEntry = logFilterDecision(book, filterResult, jobId);
  
  // Save to database (non-blocking, don't fail if database save fails)
  try {
    await saveFilterDecision(book, filterResult, jobId);
  } catch (error) {
    console.warn(`[IngestionFilter] Database save failed (non-blocking): ${error.message}`);
  }
  
  return logEntry;
}

/**
 * Gets a summary of the current filter configuration
 * @param {Object} config - Filter configuration
 * @returns {string} Human-readable summary
 */
export function getFilterSummary(config) {
  const parts = [];
  
  if (config.enableGenreFilter && config.allowedGenres.length > 0) {
    parts.push(`Genre filter: ${config.allowedGenres.length} allowed genres [${config.allowedGenres.join(', ')}]`);
  } else {
    parts.push('Genre filter: disabled (allow all)');
  }
  
  if (config.enableAuthorFilter && config.allowedAuthors.length > 0) {
    parts.push(`Author filter: ${config.allowedAuthors.length} allowed authors [${config.allowedAuthors.join(', ')}]`);
  } else {
    parts.push('Author filter: disabled (allow all)');
  }
  
  return parts.join(', ');
}

/**
 * Checks if any filters are active
 * @param {Object} config - Filter configuration
 * @returns {boolean} True if any filter is active
 */
export function hasActiveFilters(config) {
  const genreActive = config.enableGenreFilter && config.allowedGenres.length > 0;
  const authorActive = config.enableAuthorFilter && config.allowedAuthors.length > 0;
  return genreActive || authorActive;
}
