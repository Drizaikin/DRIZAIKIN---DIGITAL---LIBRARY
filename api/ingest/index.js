/**
 * Vercel Cron Endpoint for Public Domain Book Ingestion
 * 
 * Handles GET requests from Vercel Cron to trigger automated ingestion.
 * 
 * Requirements: 2.1, 2.2, 2.3
 * - 2.1: Triggered by Vercel Cron Jobs at configurable intervals
 * - 2.2: Logs job start time and batch parameters
 * - 2.3: Logs number of books processed, added, skipped, and failed
 */

import { runIngestionJob, initializeServices, DEFAULT_BATCH_SIZE } from '../../services/ingestion/orchestrator.js';

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
  console.log(`[Ingest API] Cron job triggered at ${startTime.toISOString()}`);

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
    console.log(`[Ingest API] Starting ingestion job with batch size: ${DEFAULT_BATCH_SIZE}`);

    // Run the ingestion job with default settings
    const result = await runIngestionJob({
      batchSize: DEFAULT_BATCH_SIZE,
      dryRun: false
    });

    // Log job completion (Requirement 2.3)
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    
    console.log(`[Ingest API] Job completed in ${durationMs}ms`);
    console.log(`[Ingest API] Results: processed=${result.processed}, added=${result.added}, skipped=${result.skipped}, failed=${result.failed}`);

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
