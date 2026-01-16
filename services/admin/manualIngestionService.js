/**
 * Manual Ingestion Service
 * 
 * Manages the manual book ingestion queue for admin-triggered imports.
 * Integrates with the existing Ingestion_Service pipeline.
 * Applies AI genre classification and determines access_type.
 * 
 * Requirements: 5.2, 5.3, 5.6, 10.4, 10.5, 10.6
 */

import { createClient } from '@supabase/supabase-js';
import { classifyBook, isClassificationEnabled } from '../ingestion/genreClassifier.js';
import { generateDescription, isDescriptionGenerationEnabled } from '../ingestion/descriptionGenerator.js';
import { downloadAndValidate, sanitizeFilename } from '../ingestion/pdfValidator.js';
import { uploadPdf, initSupabase as initStorage } from '../ingestion/storageUploader.js';
import { insertBook, initSupabase as initDb } from '../ingestion/databaseWriter.js';
import { logCreate } from './auditLogService.js';

// Configuration
const VALID_SOURCES = ['internet_archive', 'open_library', 'google_books', 'manual'];
const VALID_STATUSES = ['pending', 'processing', 'completed', 'failed'];
const PUBLIC_DOMAIN_CUTOFF_YEAR = 1928;

let supabase = null;

/**
 * Initialize Supabase client
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase service key
 */
export function initSupabase(url, key) {
  if (!url || !key) {
    throw new Error('Supabase URL and key are required');
  }
  supabase = createClient(url, key);
  // Also initialize dependent services
  initStorage(url, key);
  initDb(url, key);
  return supabase;
}

/**
 * Get the Supabase client instance
 * @returns {Object} Supabase client
 */
export function getSupabase() {
  if (!supabase) {
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
 * Determines access type based on publication year and licensing
 * Requirements: 10.4, 10.5, 10.6
 * 
 * @param {number|null} year - Publication year
 * @param {string} source - Book source
 * @param {Object} [metadata] - Additional metadata for licensing info
 * @returns {string} Access type: 'public_domain', 'open_access', or 'preview_only'
 */
export function determineAccessType(year, source, metadata = {}) {
  // Books published before 1928 are public domain in the US
  if (year && year < PUBLIC_DOMAIN_CUTOFF_YEAR) {
    return 'public_domain';
  }
  
  // Check for explicit licensing info in metadata
  if (metadata.license) {
    const licenseLower = metadata.license.toLowerCase();
    if (licenseLower.includes('public domain') || licenseLower.includes('cc0')) {
      return 'public_domain';
    }
    if (licenseLower.includes('creative commons') || licenseLower.includes('open access')) {
      return 'open_access';
    }
  }
  
  // Internet Archive books are typically open access or public domain
  if (source === 'internet_archive') {
    // If year is unknown or after 1927, assume open access for IA
    return year ? 'open_access' : 'public_domain';
  }
  
  // Open Library books may have various access levels
  if (source === 'open_library') {
    if (metadata.availability === 'full') {
      return 'open_access';
    }
    return 'preview_only';
  }
  
  // Google Books typically offers preview only for modern books
  if (source === 'google_books') {
    if (metadata.isEbook && metadata.saleability === 'FREE') {
      return 'open_access';
    }
    return 'preview_only';
  }
  
  // Default for manual uploads or unknown sources
  if (source === 'manual') {
    return 'open_access';
  }
  
  // Default to preview_only for modern books from unknown sources
  return year && year >= PUBLIC_DOMAIN_CUTOFF_YEAR ? 'preview_only' : 'public_domain';
}

/**
 * Checks if a book already exists in the library
 * @param {string} identifier - Book identifier
 * @param {string} source - Book source
 * @returns {Promise<{exists: boolean, bookId?: string}>}
 */
export async function checkDuplicate(identifier, source) {
  const client = getSupabase();
  
  try {
    const { data, error } = await client
      .from('books')
      .select('id')
      .eq('source_identifier', identifier)
      .maybeSingle();
    
    if (error) {
      console.error(`[ManualIngestion] Error checking duplicate: ${error.message}`);
      return { exists: false };
    }
    
    return {
      exists: !!data,
      bookId: data?.id
    };
  } catch (error) {
    console.error(`[ManualIngestion] Unexpected error checking duplicate: ${error.message}`);
    return { exists: false };
  }
}


/**
 * Adds a book to the ingestion queue
 * Requirements: 5.2
 * 
 * @param {Object} params - Queue parameters
 * @param {string} params.identifier - Book identifier
 * @param {string} params.source - Book source
 * @param {Object} [params.metadata] - Additional book metadata
 * @param {number} [params.priority=0] - Queue priority (higher = processed first)
 * @param {string} [params.queuedBy] - Admin user ID
 * @returns {Promise<{success: boolean, queueId?: string, status?: string, error?: string}>}
 */
export async function addToQueue(params) {
  // Validate required parameters
  if (!params || typeof params !== 'object') {
    return { success: false, error: 'Invalid parameters: must be an object' };
  }
  
  if (!params.identifier || typeof params.identifier !== 'string') {
    return { success: false, error: 'Invalid parameters: identifier is required' };
  }
  
  if (!params.source || !VALID_SOURCES.includes(params.source)) {
    return { success: false, error: `Invalid source: must be one of ${VALID_SOURCES.join(', ')}` };
  }
  
  const client = getSupabase();
  
  // Check for duplicate in library first
  const duplicateCheck = await checkDuplicate(params.identifier, params.source);
  if (duplicateCheck.exists) {
    console.log(`[ManualIngestion] Book already exists: ${params.identifier}`);
    return { success: false, status: 'duplicate', error: 'Book already exists in library' };
  }
  
  try {
    // Check if already in queue
    const { data: existing } = await client
      .from('ingestion_queue')
      .select('id, status')
      .eq('identifier', params.identifier)
      .eq('source', params.source)
      .maybeSingle();
    
    if (existing) {
      console.log(`[ManualIngestion] Book already in queue: ${params.identifier} (${existing.status})`);
      return { 
        success: false, 
        status: existing.status, 
        queueId: existing.id,
        error: `Book already in queue with status: ${existing.status}` 
      };
    }
    
    // Add to queue
    const queueEntry = {
      identifier: params.identifier,
      source: params.source,
      status: 'pending',
      priority: params.priority || 0,
      metadata: params.metadata || null,
      queued_by: params.queuedBy || null,
      queued_at: new Date().toISOString()
    };
    
    const { data, error } = await client
      .from('ingestion_queue')
      .insert(queueEntry)
      .select('id')
      .single();
    
    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return { success: false, status: 'duplicate', error: 'Book already in queue' };
      }
      console.error(`[ManualIngestion] Error adding to queue: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    console.log(`[ManualIngestion] Added to queue: ${params.identifier} (${data.id})`);
    return { success: true, queueId: data.id, status: 'queued' };
  } catch (error) {
    console.error(`[ManualIngestion] Unexpected error adding to queue: ${error.message}`);
    return { success: false, error: error.message };
  }
}


/**
 * Adds multiple books to the ingestion queue
 * Requirements: 5.2, 5.5
 * 
 * @param {Array<{identifier: string, source: string, metadata?: Object}>} books - Books to queue
 * @param {string} [queuedBy] - Admin user ID
 * @returns {Promise<{success: boolean, queued: number, skipped: number, results: Array}>}
 */
export async function addBooksToQueue(books, queuedBy = null) {
  if (!Array.isArray(books) || books.length === 0) {
    return { success: false, queued: 0, skipped: 0, results: [], error: 'Books array is required' };
  }
  
  const results = [];
  let queued = 0;
  let skipped = 0;
  
  for (const book of books) {
    const result = await addToQueue({
      identifier: book.identifier,
      source: book.source,
      metadata: book.metadata,
      priority: book.priority || 0,
      queuedBy
    });
    
    results.push({
      identifier: book.identifier,
      status: result.success ? 'queued' : (result.status || 'error'),
      queueId: result.queueId,
      message: result.error
    });
    
    if (result.success) {
      queued++;
    } else {
      skipped++;
    }
  }
  
  console.log(`[ManualIngestion] Batch queue result: ${queued} queued, ${skipped} skipped`);
  return { success: true, queued, skipped, results };
}

/**
 * Gets the current queue status
 * @param {Object} [options] - Query options
 * @param {string} [options.status] - Filter by status
 * @param {number} [options.limit=50] - Maximum items to return
 * @returns {Promise<{success: boolean, items?: Array, total?: number, error?: string}>}
 */
export async function getQueueStatus(options = {}) {
  const client = getSupabase();
  const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 50));
  
  try {
    let query = client
      .from('ingestion_queue')
      .select('*', { count: 'exact' })
      .order('priority', { ascending: false })
      .order('queued_at', { ascending: true })
      .limit(limit);
    
    if (options.status && VALID_STATUSES.includes(options.status)) {
      query = query.eq('status', options.status);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error(`[ManualIngestion] Error getting queue status: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    return { success: true, items: data || [], total: count || 0 };
  } catch (error) {
    console.error(`[ManualIngestion] Unexpected error getting queue status: ${error.message}`);
    return { success: false, error: error.message };
  }
}


/**
 * Updates queue item status
 * @param {string} queueId - Queue item ID
 * @param {string} status - New status
 * @param {string} [errorMessage] - Error message if failed
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function updateQueueStatus(queueId, status, errorMessage = null) {
  const client = getSupabase();
  
  const updateData = { status };
  
  if (status === 'completed' || status === 'failed') {
    updateData.processed_at = new Date().toISOString();
  }
  
  if (errorMessage) {
    updateData.error_message = errorMessage;
  }
  
  try {
    const { error } = await client
      .from('ingestion_queue')
      .update(updateData)
      .eq('id', queueId);
    
    if (error) {
      console.error(`[ManualIngestion] Error updating queue status: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error(`[ManualIngestion] Unexpected error updating queue status: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches book metadata from Internet Archive
 * @param {string} identifier - Internet Archive identifier
 * @returns {Promise<Object|null>} Book metadata or null
 */
async function fetchInternetArchiveMetadata(identifier) {
  try {
    const url = `https://archive.org/metadata/${identifier}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DrizaiknDigitalLibrary/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.warn(`[ManualIngestion] IA metadata fetch failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.metadata) {
      return null;
    }
    
    const meta = data.metadata;
    
    // Parse year from date
    let year = null;
    if (meta.date) {
      const yearMatch = meta.date.match(/\d{4}/);
      if (yearMatch) {
        year = parseInt(yearMatch[0], 10);
      }
    }
    
    return {
      title: meta.title || 'Unknown Title',
      author: Array.isArray(meta.creator) ? meta.creator.join(', ') : (meta.creator || 'Unknown Author'),
      year,
      language: Array.isArray(meta.language) ? meta.language[0] : meta.language,
      description: Array.isArray(meta.description) ? meta.description.join(' ') : meta.description,
      identifier,
      pdfUrl: `https://archive.org/download/${identifier}/${identifier}.pdf`
    };
  } catch (error) {
    console.error(`[ManualIngestion] Error fetching IA metadata: ${error.message}`);
    return null;
  }
}


/**
 * Processes a single queued book through the ingestion pipeline
 * Requirements: 5.3, 5.6, 10.4, 10.5, 10.6
 * 
 * @param {Object} queueItem - Queue item to process
 * @param {Object} [adminInfo] - Admin user info for audit logging
 * @returns {Promise<{success: boolean, bookId?: string, error?: string}>}
 */
export async function processQueueItem(queueItem, adminInfo = {}) {
  if (!queueItem || !queueItem.id) {
    return { success: false, error: 'Invalid queue item' };
  }
  
  const { identifier, source, metadata } = queueItem;
  
  console.log(`[ManualIngestion] Processing: ${identifier} from ${source}`);
  
  // Update status to processing
  await updateQueueStatus(queueItem.id, 'processing');
  
  try {
    // Check for duplicate again (in case it was added while in queue)
    const duplicateCheck = await checkDuplicate(identifier, source);
    if (duplicateCheck.exists) {
      await updateQueueStatus(queueItem.id, 'completed', 'Already exists in library');
      return { success: false, error: 'Book already exists in library', bookId: duplicateCheck.bookId };
    }
    
    // Fetch metadata based on source
    let bookMetadata = metadata || {};
    
    if (source === 'internet_archive') {
      const iaMetadata = await fetchInternetArchiveMetadata(identifier);
      if (iaMetadata) {
        bookMetadata = { ...iaMetadata, ...bookMetadata };
      } else {
        await updateQueueStatus(queueItem.id, 'failed', 'Failed to fetch metadata from Internet Archive');
        return { success: false, error: 'Failed to fetch metadata from Internet Archive' };
      }
    }
    
    // Ensure we have required fields
    if (!bookMetadata.title) {
      await updateQueueStatus(queueItem.id, 'failed', 'Missing required field: title');
      return { success: false, error: 'Missing required field: title' };
    }
    
    // Apply AI genre classification (non-blocking)
    // Requirement: 5.6
    let genres = null;
    let subgenre = null;
    
    if (isClassificationEnabled()) {
      try {
        const classification = await classifyBook({
          title: bookMetadata.title,
          author: bookMetadata.author,
          year: bookMetadata.year,
          description: bookMetadata.description
        });
        
        if (classification) {
          genres = classification.genres;
          subgenre = classification.subgenre;
          console.log(`[ManualIngestion] Classified as: ${genres.join(', ')}${subgenre ? ` (${subgenre})` : ''}`);
        }
      } catch (error) {
        console.warn(`[ManualIngestion] Classification failed: ${error.message}`);
        // Non-blocking - continue without genres
      }
    }
    
    // Determine access type
    // Requirements: 10.4, 10.5, 10.6
    const accessType = determineAccessType(bookMetadata.year, source, bookMetadata);
    console.log(`[ManualIngestion] Access type: ${accessType}`);
    
    // Generate AI description if enabled
    let description = bookMetadata.description || null;
    
    if (isDescriptionGenerationEnabled()) {
      try {
        const aiDescription = await generateDescription({
          title: bookMetadata.title,
          author: bookMetadata.author,
          year: bookMetadata.year,
          description: bookMetadata.description
        });
        
        if (aiDescription) {
          description = aiDescription;
          console.log(`[ManualIngestion] Generated AI description (${aiDescription.length} chars)`);
        }
      } catch (error) {
        console.warn(`[ManualIngestion] Description generation failed: ${error.message}`);
        // Non-blocking - continue with original description
      }
    }
    
    // Download and validate PDF (for Internet Archive)
    let storedPdfUrl = bookMetadata.pdfUrl;
    
    if (source === 'internet_archive' && bookMetadata.pdfUrl) {
      try {
        const pdfResult = await downloadAndValidate(bookMetadata.pdfUrl);
        
        if (pdfResult) {
          const sanitizedFilename = sanitizeFilename(identifier);
          storedPdfUrl = await uploadPdf(pdfResult.buffer, sanitizedFilename);
          console.log(`[ManualIngestion] Uploaded PDF: ${storedPdfUrl}`);
        } else {
          console.warn(`[ManualIngestion] PDF validation failed, using original URL`);
        }
      } catch (error) {
        console.warn(`[ManualIngestion] PDF processing failed: ${error.message}`);
        // Continue with original URL
      }
    }
    
    // Insert book record
    const bookRecord = {
      title: bookMetadata.title,
      author: bookMetadata.author || 'Unknown Author',
      year: bookMetadata.year,
      language: bookMetadata.language,
      source_identifier: identifier,
      pdf_url: storedPdfUrl,
      description,
      genres,
      subgenre,
      cover_url: bookMetadata.coverUrl || `https://archive.org/services/img/${identifier}`
    };
    
    const insertResult = await insertBook(bookRecord);
    
    if (!insertResult.success) {
      await updateQueueStatus(queueItem.id, 'failed', insertResult.error);
      return { success: false, error: insertResult.error };
    }
    
    // Log the creation for audit
    await logCreate(
      { id: insertResult.id, ...bookRecord, source, access_type: accessType },
      adminInfo
    );
    
    // Update queue status to completed
    await updateQueueStatus(queueItem.id, 'completed');
    
    console.log(`[ManualIngestion] Successfully ingested: ${bookMetadata.title} (${insertResult.id})`);
    return { success: true, bookId: insertResult.id };
    
  } catch (error) {
    console.error(`[ManualIngestion] Error processing ${identifier}: ${error.message}`);
    await updateQueueStatus(queueItem.id, 'failed', error.message);
    return { success: false, error: error.message };
  }
}


/**
 * Processes pending items from the queue
 * Requirements: 5.3
 * 
 * @param {Object} [options] - Processing options
 * @param {number} [options.limit=10] - Maximum items to process
 * @param {Object} [options.adminInfo] - Admin user info for audit logging
 * @returns {Promise<{success: boolean, processed: number, succeeded: number, failed: number, results: Array}>}
 */
export async function processQueue(options = {}) {
  const client = getSupabase();
  const limit = Math.min(50, Math.max(1, parseInt(options.limit) || 10));
  
  console.log(`[ManualIngestion] Processing queue (limit: ${limit})`);
  
  try {
    // Get pending items ordered by priority and queue time
    const { data: pendingItems, error } = await client
      .from('ingestion_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('queued_at', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error(`[ManualIngestion] Error fetching queue: ${error.message}`);
      return { success: false, processed: 0, succeeded: 0, failed: 0, results: [], error: error.message };
    }
    
    if (!pendingItems || pendingItems.length === 0) {
      console.log(`[ManualIngestion] No pending items in queue`);
      return { success: true, processed: 0, succeeded: 0, failed: 0, results: [] };
    }
    
    console.log(`[ManualIngestion] Found ${pendingItems.length} pending items`);
    
    const results = [];
    let succeeded = 0;
    let failed = 0;
    
    for (const item of pendingItems) {
      const result = await processQueueItem(item, options.adminInfo);
      
      results.push({
        identifier: item.identifier,
        source: item.source,
        success: result.success,
        bookId: result.bookId,
        error: result.error
      });
      
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
      
      // Small delay between items to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`[ManualIngestion] Queue processing complete: ${succeeded} succeeded, ${failed} failed`);
    
    return {
      success: true,
      processed: pendingItems.length,
      succeeded,
      failed,
      results
    };
  } catch (error) {
    console.error(`[ManualIngestion] Unexpected error processing queue: ${error.message}`);
    return { success: false, processed: 0, succeeded: 0, failed: 0, results: [], error: error.message };
  }
}

/**
 * Clears completed or failed items from the queue
 * @param {Object} [options] - Clear options
 * @param {string} [options.status] - Status to clear ('completed', 'failed', or 'all')
 * @param {number} [options.olderThanDays=7] - Clear items older than this many days
 * @returns {Promise<{success: boolean, cleared: number, error?: string}>}
 */
export async function clearQueue(options = {}) {
  const client = getSupabase();
  const olderThanDays = parseInt(options.olderThanDays) || 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  
  try {
    let query = client
      .from('ingestion_queue')
      .delete()
      .lt('queued_at', cutoffDate.toISOString());
    
    if (options.status === 'completed') {
      query = query.eq('status', 'completed');
    } else if (options.status === 'failed') {
      query = query.eq('status', 'failed');
    } else if (options.status !== 'all') {
      // Default: clear both completed and failed
      query = query.in('status', ['completed', 'failed']);
    }
    
    const { data, error } = await query.select('id');
    
    if (error) {
      console.error(`[ManualIngestion] Error clearing queue: ${error.message}`);
      return { success: false, cleared: 0, error: error.message };
    }
    
    const cleared = data?.length || 0;
    console.log(`[ManualIngestion] Cleared ${cleared} items from queue`);
    
    return { success: true, cleared };
  } catch (error) {
    console.error(`[ManualIngestion] Unexpected error clearing queue: ${error.message}`);
    return { success: false, cleared: 0, error: error.message };
  }
}

export { VALID_SOURCES, VALID_STATUSES, PUBLIC_DOMAIN_CUTOFF_YEAR };
