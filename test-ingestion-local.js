/**
 * Local test script for Public Domain Book Ingestion
 * 
 * Run with: node test-ingestion-local.js
 * 
 * Options:
 *   --dry-run    Run without making changes (default: true)
 *   --batch=N    Number of books per API call (default: 10)
 *   --max=N      Maximum books to process (default: 20)
 *   --live       Actually ingest books (sets dry-run to false)
 *   --reset      Reset ingestion state to page 1
 *   --status     Show current ingestion state
 *   --classify   Enable AI genre classification
 *   --mock-classify  Use mock classification (no API calls)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Set classification environment variables before importing
const args = process.argv.slice(2);
if (args.includes('--classify')) {
  process.env.ENABLE_GENRE_CLASSIFICATION = 'true';
}
if (args.includes('--mock-classify')) {
  process.env.ENABLE_GENRE_CLASSIFICATION = 'true';
  process.env.MOCK_GENRE_CLASSIFIER = 'true';
}

import { runIngestionJob, initializeServices } from './services/ingestion/orchestrator.js';
import { getIngestionState, resetIngestionState, initSupabase as initState } from './services/ingestion/stateManager.js';
import { isClassificationEnabled } from './services/ingestion/genreClassifier.js';
import { isDescriptionGenerationEnabled } from './services/ingestion/descriptionGenerator.js';

async function main() {
  console.log('='.repeat(60));
  console.log('Public Domain Book Ingestion - Local Test');
  console.log('='.repeat(60));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');
  const isReset = args.includes('--reset');
  const isStatus = args.includes('--status');
  const dryRun = !isLive;
  
  let batchSize = 10;
  const batchArg = args.find(a => a.startsWith('--batch='));
  if (batchArg) {
    batchSize = parseInt(batchArg.split('=')[1], 10) || 10;
  }

  let maxBooks = 20;
  const maxArg = args.find(a => a.startsWith('--max='));
  if (maxArg) {
    maxBooks = parseInt(maxArg.split('=')[1], 10) || 20;
  }

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing SUPABASE_URL or SUPABASE_KEY in .env.local');
    process.exit(1);
  }

  console.log(`\nSupabase URL: ${supabaseUrl}`);
  console.log('Supabase Key: [REDACTED]\n');

  try {
    // Initialize services
    initializeServices(supabaseUrl, supabaseKey);
    initState(supabaseUrl, supabaseKey);

    // Handle status check
    if (isStatus) {
      const state = await getIngestionState('internet_archive');
      console.log('Current Ingestion State:');
      console.log('='.repeat(40));
      console.log(`  Source: internet_archive`);
      console.log(`  Current Page: ${state.last_page}`);
      console.log(`  Total Ingested: ${state.total_ingested}`);
      console.log(`  Last Run: ${state.last_run_at || 'Never'}`);
      console.log(`  Last Status: ${state.last_run_status}`);
      console.log(`  Last Run Added: ${state.last_run_added}`);
      console.log(`  Last Run Skipped: ${state.last_run_skipped}`);
      console.log(`  Last Run Failed: ${state.last_run_failed}`);
      return;
    }

    // Handle reset
    if (isReset) {
      console.log('Resetting ingestion state to page 1...');
      await resetIngestionState('internet_archive');
      console.log('State reset successfully!');
      return;
    }

    // Show configuration
    console.log(`Configuration:`);
    console.log(`  Dry Run: ${dryRun}`);
    console.log(`  Batch Size: ${batchSize}`);
    console.log(`  Max Books: ${maxBooks}`);
    console.log(`  Mode: ${isLive ? 'LIVE (will make changes!)' : 'TEST (no changes)'}`);
    console.log(`  AI Classification: ${isClassificationEnabled() ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  AI Descriptions: ${isDescriptionGenerationEnabled() ? 'ENABLED' : 'DISABLED'}`);
    console.log('');

    // Get current state
    const state = await getIngestionState('internet_archive');
    console.log(`Resuming from page ${state.last_page} (total ingested: ${state.total_ingested})\n`);

    // Run ingestion
    console.log('Starting ingestion job...\n');
    const result = await runIngestionJob({
      batchSize,
      maxBooks,
      dryRun,
      delayBetweenBooksMs: 300 // Faster for testing
    });

    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('INGESTION RESULTS');
    console.log('='.repeat(60));
    console.log(`Job ID: ${result.jobId}`);
    console.log(`Status: ${result.status}`);
    console.log(`Started: ${result.startedAt}`);
    console.log(`Completed: ${result.completedAt}`);
    console.log('');
    console.log('Summary:');
    console.log(`  Processed: ${result.processed}`);
    console.log(`  Added: ${result.added}`);
    console.log(`  Skipped: ${result.skipped}`);
    console.log(`  Failed: ${result.failed}`);
    console.log('');
    console.log('Continuation:');
    console.log(`  Next Page: ${result.nextPage}`);
    console.log(`  Last Cursor: ${result.lastCursor || 'N/A'}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.identifier}: ${err.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    if (dryRun) {
      console.log('DRY RUN COMPLETE - No changes were made.');
      console.log('Run with --live flag to actually ingest books.');
    } else {
      console.log('LIVE RUN COMPLETE - Books have been ingested.');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nFATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
