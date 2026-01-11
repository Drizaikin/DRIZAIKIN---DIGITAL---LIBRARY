/**
 * Ingestion Orchestrator Service
 * 
 * Coordinates the entire ingestion workflow for public-domain books.
 * Implements stateful continuation for daily cron-based ingestion.
 * Supports AI genre classification (non-blocking).
 * 
 * Requirements: 2.3, 7.1, 7.4, 9.3
 */

import { fetchBooks, getPdfUrl } from './internetArchiveFetcher.js';
import { filterNewBooks, initSupabase as initDedup, getExistingGenres } from './deduplicationEngine.js';
import { downloadAndValidate, sanitizeFilename } from './pdfValidator.js';
import { uploadPdf, initSupabase as initStorage } from './storageUploader.js';
import { insertBook, createJobLog, logJobResult, initSupabase as initDb } from './databaseWriter.js';
import { getIngestionState, markRunStarted, markRunCompleted, initSupabase as initState } from './stateManager.js';
import { classifyBook, isClassificationEnabled } from './genreClassifier.js';

// Configuration for Vercel Hobby plan constraints
const DEFAULT_BATCH_SIZE = 50;  // Books per API call
const MAX_BOOKS_PER_RUN = 200;  // Max books per daily run (to stay within function limits)
const DEFAULT_DELAY_BETWEEN_BOOKS_MS = 500;
const VERCEL_FUNCTION_TIMEOUT_MS = 55000; // 55 seconds (leave buffer for 60s limit)

/**
 * Generates a unique job ID
 * @returns {string} UUID-like job ID
 */
function generateJobId() {
  return 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Initializes all Supabase clients for the services
 * @param {string} url - Supabase URL
 * @param {string} key - Supabase service key
 */
export function initializeServices(url, key) {
  if (!url || !key) {
    throw new Error('Supabase URL and key are required');
  }
  initDedup(url, key);
  initStorage(url, key);
  initDb(url, key);
  initState(url, key);
}


/**
 * Processes a single book through the ingestion pipeline
 * @param {Object} book - Book metadata from Internet Archive
 * @param {boolean} dryRun - If true, log only without side effects
 * @returns {Promise<{status: 'added'|'skipped'|'failed', error?: string}>}
 */
async function processBook(book, dryRun = false) {
  const identifier = book.identifier;
  
  console.log(`[Orchestrator] Processing book: ${book.title} (${identifier})`);
  
  try {
    // Step 1: Construct PDF URL
    const pdfUrl = getPdfUrl(identifier);
    console.log(`[Orchestrator] PDF URL: ${pdfUrl}`);
    
    if (dryRun) {
      console.log(`[Orchestrator] [DRY RUN] Would download and process: ${identifier}`);
      return { status: 'added' }; // Report as "would be added"
    }
    
    // Step 2: Download and validate PDF
    const pdfResult = await downloadAndValidate(pdfUrl);
    if (!pdfResult) {
      console.error(`[Orchestrator] PDF validation failed for: ${identifier}`);
      return { status: 'failed', error: 'PDF download or validation failed' };
    }
    
    // Step 3: Sanitize filename and upload to storage
    const sanitizedFilename = sanitizeFilename(identifier);
    const storedPdfUrl = await uploadPdf(pdfResult.buffer, sanitizedFilename);
    console.log(`[Orchestrator] Uploaded to storage: ${storedPdfUrl}`);
    
    // Step 4: Parse publication year from date
    let year = null;
    if (book.date) {
      const yearMatch = book.date.match(/\d{4}/);
      if (yearMatch) {
        year = parseInt(yearMatch[0], 10);
      }
    }
    
    // Step 5: AI Genre Classification (non-blocking, with idempotency check)
    let genres = null;
    let subgenre = null;
    
    if (isClassificationEnabled()) {
      try {
        // Check if book already has genres (idempotency - Requirement 5.2, 5.3)
        const existingGenres = await getExistingGenres(identifier);
        
        if (existingGenres.hasGenres) {
          // Skip classification - use existing genres
          genres = existingGenres.genres;
          subgenre = existingGenres.subgenre;
          console.log(`[Orchestrator] Using existing genres for ${identifier}: ${genres.join(', ')}${subgenre ? ` (${subgenre})` : ''}`);
        } else {
          // No existing genres - perform classification
          const classification = await classifyBook({
            title: book.title,
            author: book.creator,
            year: year,
            description: book.description
          });
          
          if (classification) {
            genres = classification.genres;
            subgenre = classification.subgenre;
            console.log(`[Orchestrator] Classified as: ${genres.join(', ')}${subgenre ? ` (${subgenre})` : ''}`);
          } else {
            console.log(`[Orchestrator] Classification returned null for: ${identifier}`);
          }
        }
      } catch (error) {
        // Non-blocking - log and continue without genres
        console.warn(`[Orchestrator] Classification failed for ${identifier}: ${error.message}`);
      }
    }
    
    // Step 6: Insert book record into database
    const bookRecord = {
      title: book.title || 'Unknown Title',
      author: book.creator || 'Unknown Author',
      year: year,
      language: book.language || null,
      source_identifier: identifier,
      pdf_url: storedPdfUrl,
      description: book.description || null,
      genres: genres,
      subgenre: subgenre
    };
    
    const insertResult = await insertBook(bookRecord);
    if (!insertResult.success) {
      console.error(`[Orchestrator] Database insert failed for: ${identifier} - ${insertResult.error}`);
      return { status: 'failed', error: insertResult.error };
    }
    
    console.log(`[Orchestrator] Successfully added book: ${book.title} (ID: ${insertResult.id})`);
    return { status: 'added' };
    
  } catch (error) {
    console.error(`[Orchestrator] Error processing book ${identifier}: ${error.message}`);
    return { status: 'failed', error: error.message };
  }
}


/**
 * Runs a complete ingestion job with stateful continuation
 * Designed for daily cron execution on Vercel Hobby plan
 * 
 * @param {Object} options - Job options
 * @param {number} [options.batchSize=50] - Books per API call
 * @param {number} [options.maxBooks=200] - Max books per run
 * @param {boolean} [options.dryRun=false] - If true, log only without side effects
 * @param {number} [options.startPage] - Override starting page (uses saved state if not provided)
 * @param {number} [options.delayBetweenBooksMs=500] - Delay between processing books
 * @returns {Promise<JobResult>} Job execution summary
 */
export async function runIngestionJob(options = {}) {
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const maxBooks = options.maxBooks || MAX_BOOKS_PER_RUN;
  const dryRun = options.dryRun || false;
  const delayBetweenBooksMs = options.delayBetweenBooksMs || DEFAULT_DELAY_BETWEEN_BOOKS_MS;
  
  const startedAt = new Date();
  const jobId = generateJobId();
  const startTime = Date.now();
  
  console.log(`[Orchestrator] Starting ingestion job: ${jobId}`);
  console.log(`[Orchestrator] Options: batchSize=${batchSize}, maxBooks=${maxBooks}, dryRun=${dryRun}`);
  
  // Initialize result tracking
  const result = {
    jobId,
    status: 'completed',
    startedAt,
    completedAt: null,
    processed: 0,
    added: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    nextPage: null,
    lastCursor: null
  };
  
  // Get current state (resume from last position)
  let currentState;
  try {
    currentState = await getIngestionState('internet_archive');
    console.log(`[Orchestrator] Resuming from page ${currentState.last_page}, total ingested: ${currentState.total_ingested}`);
  } catch (error) {
    console.error(`[Orchestrator] Failed to get state, starting from page 1: ${error.message}`);
    currentState = { last_page: 1, total_ingested: 0 };
  }
  
  // Use provided startPage or resume from saved state
  let currentPage = options.startPage || currentState.last_page;
  
  // Mark run as started (unless dry run)
  if (!dryRun) {
    try {
      await markRunStarted('internet_archive');
    } catch (error) {
      console.error(`[Orchestrator] Failed to mark run started: ${error.message}`);
    }
  }
  
  // Create job log entry (unless dry run)
  let dbJobId = null;
  if (!dryRun) {
    try {
      const jobLogResult = await createJobLog('scheduled');
      if (jobLogResult.success) {
        dbJobId = jobLogResult.jobId;
        console.log(`[Orchestrator] Created job log: ${dbJobId}`);
      }
    } catch (error) {
      console.error(`[Orchestrator] Failed to create job log: ${error.message}`);
    }
  }
  
  let totalProcessed = 0;
  
  try {
    // Process books in batches until we hit maxBooks or timeout
    while (totalProcessed < maxBooks) {
      // Check if we're approaching timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > VERCEL_FUNCTION_TIMEOUT_MS) {
        console.log(`[Orchestrator] Approaching timeout (${elapsed}ms), stopping early`);
        result.status = 'partial';
        break;
      }
      
      // Calculate remaining books for this batch
      const remainingQuota = maxBooks - totalProcessed;
      const thisBatchSize = Math.min(batchSize, remainingQuota);
      
      console.log(`[Orchestrator] Fetching page ${currentPage}, batch size ${thisBatchSize}...`);
      
      // Step 1: Fetch books from Internet Archive
      const books = await fetchBooks({ batchSize: thisBatchSize, page: currentPage });
      
      if (!books || books.length === 0) {
        console.log(`[Orchestrator] No more books available from Internet Archive`);
        // Reset to page 1 for next run (cycle through catalog)
        result.nextPage = 1;
        break;
      }
      
      console.log(`[Orchestrator] Fetched ${books.length} books from page ${currentPage}`);
      
      // Step 2: Filter out duplicates
      const newBooks = await filterNewBooks(books);
      const skippedCount = books.length - newBooks.length;
      result.skipped += skippedCount;
      
      console.log(`[Orchestrator] ${newBooks.length} new books, ${skippedCount} duplicates skipped`);
      
      // Step 3: Process each new book
      for (let i = 0; i < newBooks.length; i++) {
        // Check timeout before each book
        if (Date.now() - startTime > VERCEL_FUNCTION_TIMEOUT_MS) {
          console.log(`[Orchestrator] Timeout reached during processing, stopping`);
          result.status = 'partial';
          break;
        }
        
        const book = newBooks[i];
        result.processed++;
        totalProcessed++;
        
        try {
          const bookResult = await processBook(book, dryRun);
          
          if (bookResult.status === 'added') {
            result.added++;
          } else if (bookResult.status === 'failed') {
            result.failed++;
            result.errors.push({
              identifier: book.identifier,
              error: bookResult.error || 'Unknown error',
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`[Orchestrator] Error processing book ${book.identifier}: ${error.message}`);
          result.failed++;
          result.errors.push({
            identifier: book.identifier,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
        
        // Add delay between books (except for last book)
        if (i < newBooks.length - 1 && delayBetweenBooksMs > 0 && !dryRun) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBooksMs));
        }
      }
      
      // Move to next page
      currentPage++;
      result.nextPage = currentPage;
      result.lastCursor = books[books.length - 1]?.identifier;
      
      // If we got fewer books than requested, we've reached the end
      if (books.length < thisBatchSize) {
        console.log(`[Orchestrator] Reached end of available books`);
        result.nextPage = 1; // Reset for next run
        break;
      }
    }
    
    // Determine final status
    if (result.failed > 0 && result.added > 0) {
      result.status = 'partial';
    } else if (result.failed > 0 && result.added === 0 && result.processed > 0) {
      result.status = 'failed';
    }
    
  } catch (error) {
    console.error(`[Orchestrator] Critical error during ingestion: ${error.message}`);
    result.status = 'failed';
    result.errors.push({
      identifier: 'job',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
  
  result.completedAt = new Date();
  
  // Save state for next run (unless dry run)
  if (!dryRun) {
    try {
      await markRunCompleted('internet_archive', result);
    } catch (error) {
      console.error(`[Orchestrator] Failed to save state: ${error.message}`);
    }
  }
  
  // Log job result to database (unless dry run)
  if (dbJobId && !dryRun) {
    try {
      await logJobResult({ ...result, jobId: dbJobId });
    } catch (error) {
      console.error(`[Orchestrator] Failed to log job result: ${error.message}`);
    }
  }
  
  // Log summary
  const duration = Date.now() - startTime;
  console.log(`[Orchestrator] Job ${jobId} completed in ${duration}ms with status: ${result.status}`);
  console.log(`[Orchestrator] Summary: processed=${result.processed}, added=${result.added}, skipped=${result.skipped}, failed=${result.failed}`);
  console.log(`[Orchestrator] Next run will start from page ${result.nextPage}`);
  
  return result;
}

export { DEFAULT_BATCH_SIZE, DEFAULT_DELAY_BETWEEN_BOOKS_MS, MAX_BOOKS_PER_RUN };
