/**
 * CLI Script for Bulk Category Update
 * 
 * Usage: node scripts/bulk-update-categories.js
 * 
 * This script updates all books' categories to match their first genre.
 * It can be run locally or on the server for manual updates.
 * 
 * Requirements: 5.5.1-5.5.6
 */

import { updateAllCategories } from '../services/ingestion/bulkCategoryUpdate.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Main execution function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Bulk Category Update Script');
  console.log('='.repeat(60));
  console.log('');
  
  // Verify environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('ERROR: Missing required environment variables');
    console.error('Please ensure SUPABASE_URL and SUPABASE_KEY are set in .env.local');
    process.exit(1);
  }
  
  console.log('Environment: OK');
  console.log('Database URL:', process.env.SUPABASE_URL);
  console.log('');
  
  // Confirm before proceeding
  console.log('This script will update ALL books in the database.');
  console.log('Each book\'s category will be set to its first genre.');
  console.log('Books without genres will be set to "Uncategorized".');
  console.log('');
  
  // Run the update
  try {
    console.log('Starting bulk update...');
    console.log('');
    
    const result = await updateAllCategories();
    
    console.log('');
    console.log('='.repeat(60));
    console.log('Bulk Update Complete');
    console.log('='.repeat(60));
    console.log(`Total Processed: ${result.updated + result.errors}`);
    console.log(`Successfully Updated: ${result.updated}`);
    console.log(`Errors: ${result.errors}`);
    
    if (result.errors > 0 && result.details && result.details.length > 0) {
      console.log('');
      console.log('Error Details:');
      result.details.forEach((detail, index) => {
        console.log(`  ${index + 1}. Book ID: ${detail.bookId || 'unknown'}`);
        console.log(`     Error: ${detail.error}`);
      });
    }
    
    console.log('');
    
    if (result.errors === 0) {
      console.log('✓ All books updated successfully!');
      process.exit(0);
    } else {
      console.log('⚠ Some books failed to update. See error details above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('FATAL ERROR');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the script
main();
