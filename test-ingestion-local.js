/**
 * Local test script for Public Domain Book Ingestion
 * 
 * Run with: node test-ingestion-local.js
 * 
 * Options:
 *   --dry-run    Run without making changes (default: true)
 *   --batch=N    Number of books to fetch (default: 5)
 *   --live       Actually ingest books (sets dry-run to false)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { runIngestionJob, initializeServices } from './services/ingestion/orchestrator.js';

async function main() {
  console.log('='.repeat(60));
  console.log('Public Domain Book Ingestion - Local Test');
  console.log('='.repeat(60));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');
  const dryRun = !isLive;
  
  let batchSize = 5;
  const batchArg = args.find(a => a.startsWith('--batch='));
  if (batchArg) {
    batchSize = parseInt(batchArg.split('=')[1], 10) || 5;
  }

  console.log(`\nConfiguration:`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`  Batch Size: ${batchSize}`);
  console.log(`  Mode: ${isLive ? 'LIVE (will make changes!)' : 'TEST (no changes)'}`);
  console.log('');

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing SUPABASE_URL or SUPABASE_KEY in .env.local');
    process.exit(1);
  }

  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log('Supabase Key: [REDACTED]');
  console.log('');

  try {
    // Initialize services
    console.log('Initializing services...');
    initializeServices(supabaseUrl, supabaseKey);
    console.log('Services initialized successfully.\n');

    // Run ingestion
    console.log('Starting ingestion job...\n');
    const result = await runIngestionJob({
      batchSize,
      dryRun,
      delayBetweenBooksMs: 500 // Faster for testing
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
