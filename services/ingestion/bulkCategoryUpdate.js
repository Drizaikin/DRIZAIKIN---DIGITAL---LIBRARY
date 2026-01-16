/**
 * Bulk Category Update Service
 * 
 * Updates all existing books' categories to match their AI-determined genres.
 * Sets category to first genre in genres array, or "Uncategorized" if no genres.
 * 
 * Requirements: 5.5.1-5.5.6
 */

import { getSupabase } from './databaseWriter.js';

/**
 * Updates all books' categories to match their first genre
 * Handles errors gracefully and provides progress feedback
 * 
 * @returns {Promise<{updated: number, errors: number, details: Array}>}
 */
export async function updateAllCategories() {
  const client = getSupabase();
  let updated = 0;
  let errors = 0;
  const errorDetails = [];
  
  console.log('[BulkCategoryUpdate] Starting bulk category update...');
  
  try {
    // Fetch all books with their current genres
    // Requirement 5.5.1: Fetch all books with genres from database
    const { data: books, error: fetchError } = await client
      .from('books')
      .select('id, genres');
    
    if (fetchError) {
      console.error('[BulkCategoryUpdate] Failed to fetch books:', fetchError.message);
      return { updated: 0, errors: 1, details: [{ error: fetchError.message }] };
    }
    
    if (!books || books.length === 0) {
      console.log('[BulkCategoryUpdate] No books found to update');
      return { updated: 0, errors: 0, details: [] };
    }
    
    console.log(`[BulkCategoryUpdate] Found ${books.length} books to process`);
    
    // Process each book
    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      
      try {
        // Determine category based on genres
        // Requirement 5.5.2: Set each book's category to its first genre
        // Requirement 5.5.3: Set "Uncategorized" for books without genres
        const category = book.genres && book.genres.length > 0 
          ? book.genres[0] 
          : 'Uncategorized';
        
        // Update the book's category
        const { error: updateError } = await client
          .from('books')
          .update({ category })
          .eq('id', book.id);
        
        if (updateError) {
          // Requirement 5.5.5: Handle errors gracefully (continue on error)
          console.error(`[BulkCategoryUpdate] Failed to update book ${book.id}:`, updateError.message);
          errors++;
          errorDetails.push({
            bookId: book.id,
            error: updateError.message
          });
        } else {
          updated++;
        }
      } catch (error) {
        // Requirement 5.5.5: Handle errors gracefully (continue on error)
        console.error(`[BulkCategoryUpdate] Unexpected error updating book ${book.id}:`, error.message);
        errors++;
        errorDetails.push({
          bookId: book.id,
          error: error.message
        });
      }
      
      // Requirement 5.5.6: Provide progress feedback every 100 books
      if ((updated + errors) % 100 === 0) {
        console.log(`[BulkCategoryUpdate] Progress: ${updated + errors}/${books.length} (${updated} updated, ${errors} errors)`);
      }
    }
    
    // Requirement 5.5.4: Log summary (updated count, error count)
    console.log(`[BulkCategoryUpdate] Update complete: ${updated} updated, ${errors} errors out of ${books.length} total`);
    
    return { updated, errors, details: errorDetails };
  } catch (error) {
    console.error('[BulkCategoryUpdate] Unexpected error during bulk update:', error.message);
    return { updated, errors: errors + 1, details: [...errorDetails, { error: error.message }] };
  }
}
