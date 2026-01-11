/**
 * Vercel Cron Endpoint for Public Domain Book Ingestion
 * 
 * Handles GET requests from Vercel Cron to trigger automated ingestion.
 * Uses stateful continuation to resume from last position.
 * Designed for Vercel Hobby plan (1 cron job, once daily).
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import { runIngestionJob, initializeServices, MAX_BOOKS_PER_RUN } from '../../services/ingestion/orchestrator.js';

/**
 * Vercel Serverless Function Handler
 * @param {Request} req - Incoming request
 * @param {Response} res - Outgoing response
 */
export default async function handler(req, res) {
  // Only allow GET requests (Vercel Cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts GET requests from Vercel Cron'
    });
  }

  // Verify cron authorization (Vercel sends this header for cron jobs)
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is set, verify the authorization header
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Ingest API] Unauthorized cron request attempt');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or missing authorization'
    });
  }

  const startTime = new Date();
  console.log(`[Ingest API] Daily cron job triggered at ${startTime.toISOString()}`);

  try {
    // Initialize Supabase services
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Ingest API] Missing Supabase configuration');
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Database configuration missing'
      });
    }

    initializeServices(supabaseUrl, supabaseKey);

    // Log job start (Requirement 2.2)
    console.log(`[Ingest API] Starting stateful ingestion job, max books: ${MAX_BOOKS_PER_RUN}`);

    // Run the ingestion job with stateful continuation
    // The orchestrator will automatically resume from the last saved position
    const result = await runIngestionJob({
      maxBooks: MAX_BOOKS_PER_RUN,
      dryRun: false
    });

    // Log job completion (Requirement 2.3)
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    
    console.log(`[Ingest API] Job completed in ${durationMs}ms`);
    console.log(`[Ingest API] Results: processed=${result.processed}, added=${result.added}, skipped=${result.skipped}, failed=${result.failed}`);
    console.log(`[Ingest API] Next run will start from page ${result.nextPage}`);

    // Return job summary
    return res.status(200).json({
      success: true,
      jobId: result.jobId,
      status: result.status,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs,
      summary: {
        processed: result.processed,
        added: result.added,
        skipped: result.skipped,
        failed: result.failed
      },
      continuation: {
        nextPage: result.nextPage,
        lastCursor: result.lastCursor
      },
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error) {
    console.error(`[Ingest API] Critical error: ${error.message}`);
    console.error(error.stack);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
