/**
 * Ingestion Orchestrator Service
 * 
 * Coordinates the entire ingestion workflow for public-domain books.
 * Implements error handling with continue-on-failure and dry-run mode.
 * 
 * Requirements: 2.3, 7.1, 7.4, 9.3
 */

import { fetchBooks, getPdfUrl } from './internetArchiveFetcher.js';
import { filterNewBooks, initSupabase as initDedup } from './deduplicationEngine.js';
import { downloadAndValidate, sanitizeFilename } from './pdfValidator.js';
import { uploadPdf, initSupabase as initStorage } from './storageUploader.js';
import { insertBook, createJobLog, logJobResult, initSupabase as initDb } from './databaseWriter.js';

// Default configuration
const DEFAULT_BATCH_SIZE = 30;
const DEFAULT_DELAY_BETWEEN_BOOKS_MS = 1000;

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
    
    // Step 5: Insert book record into database
    const bookRecord = {
      title: book.title || 'Unknown Title',
      author: book.creator || 'Unknown Author',
      year: year,
      language: book.language || null,
      source_identifier: identifier,
      pdf_url: storedPdfUrl,
      description: book.description || null
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
 * Runs a complete ingestion job
 * @param {Object} options - Job options
 * @param {number} [options.batchSize=30] - Books per batch
 * @param {boolean} [options.dryRun=false] - If true, log only without side effects
 * @param {number} [options.page=1] - Page number for pagination
 * @param {number} [options.delayBetweenBooksMs=1000] - Delay between processing books
 * @returns {Promise<JobResult>} Job execution summary
 */
export async function runIngestionJob(options = {}) {
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const dryRun = options.dryRun || false;
  const page = options.page || 1;
  const delayBetweenBooksMs = options.delayBetweenBooksMs || DEFAULT_DELAY_BETWEEN_BOOKS_MS;
  
  const startedAt = new Date();
  const jobId = generateJobId();
  
  console.log(`[Orchestrator] Starting ingestion job: ${jobId}`);
  console.log(`[Orchestrator] Options: batchSize=${batchSize}, dryRun=${dryRun}, page=${page}`);
  
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
    errors: []
  };
  
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
      // Continue without job logging
    }
  }
  
  try {
    // Step 1: Fetch books from Internet Archive
    console.log(`[Orchestrator] Fetching books from Internet Archive...`);
    const books = await fetchBooks({ batchSize, page });
    
    if (!books || books.length === 0) {
      console.log(`[Orchestrator] No books fetched from Internet Archive`);
      result.completedAt = new Date();
      
      if (dbJobId) {
        await logJobResult({ ...result, jobId: dbJobId });
      }
      
      return result;
    }
    
    console.log(`[Orchestrator] Fetched ${books.length} books from Internet Archive`);
    
    // Step 2: Filter out duplicates (unless dry run - still filter to show accurate counts)
    let newBooks;
    if (dryRun) {
      // In dry run, still check for duplicates to report accurate counts
      newBooks = await filterNewBooks(books);
      result.skipped = books.length - newBooks.length;
    } else {
      newBooks = await filterNewBooks(books);
      result.skipped = books.length - newBooks.length;
    }
    
    console.log(`[Orchestrator] ${newBooks.length} new books to process, ${result.skipped} duplicates skipped`);
    
    // Step 3: Process each new book (with continue-on-failure)
    for (let i = 0; i < newBooks.length; i++) {
      const book = newBooks[i];
      result.processed++;
      
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
        // Requirement 7.1, 7.4: Continue with remaining books on failure
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
    
    // Determine final status
    if (result.failed > 0 && result.added > 0) {
      result.status = 'partial';
    } else if (result.failed > 0 && result.added === 0) {
      result.status = 'failed';
    } else {
      result.status = 'completed';
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
  
  // Log job result to database (unless dry run)
  if (dbJobId && !dryRun) {
    try {
      await logJobResult({ ...result, jobId: dbJobId });
    } catch (error) {
      console.error(`[Orchestrator] Failed to log job result: ${error.message}`);
    }
  }
  
  // Log summary
  console.log(`[Orchestrator] Job ${jobId} completed with status: ${result.status}`);
  console.log(`[Orchestrator] Summary: processed=${result.processed}, added=${result.added}, skipped=${result.skipped}, failed=${result.failed}`);
  
  return result;
}

export { DEFAULT_BATCH_SIZE, DEFAULT_DELAY_BETWEEN_BOOKS_MS };
