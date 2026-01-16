# Bulk Category Update

This document describes how to run the bulk category update to sync all books' categories with their AI-determined genres.

## Overview

The bulk category update process updates all existing books in the database to ensure their `category` field matches their first genre from the `genres` array. Books without genres are set to "Uncategorized".

**Requirements**: 5.5.1-5.5.6

## Methods

There are two ways to run the bulk update:

### Method 1: CLI Script (Recommended for Local/Manual Updates)

The CLI script is ideal for:
- Local development testing
- Manual one-time updates
- Server-side maintenance tasks

**Usage:**

```bash
npm run bulk-update-categories
```

**What it does:**
1. Loads environment variables from `.env.local`
2. Verifies database connection
3. Fetches all books from the database
4. Updates each book's category to match its first genre
5. Sets "Uncategorized" for books without genres
6. Provides progress feedback every 100 books
7. Reports final statistics (updated count, error count)

**Example Output:**

```
============================================================
Bulk Category Update Script
============================================================

Environment: OK
Database URL: https://your-project.supabase.co

This script will update ALL books in the database.
Each book's category will be set to its first genre.
Books without genres will be set to "Uncategorized".

Starting bulk update...

[BulkCategoryUpdate] Starting bulk category update...
[BulkCategoryUpdate] Found 1000 books to process
[BulkCategoryUpdate] Progress: 100/1000 (100 updated, 0 errors)
[BulkCategoryUpdate] Progress: 200/1000 (200 updated, 0 errors)
...
[BulkCategoryUpdate] Update complete: 995 updated, 5 errors out of 1000 total

============================================================
Bulk Update Complete
============================================================
Total Processed: 1000
Successfully Updated: 995
Errors: 5

Error Details:
  1. Book ID: abc-123
     Error: Network timeout
  2. Book ID: def-456
     Error: Invalid data format

⚠ Some books failed to update. See error details above.
```

### Method 2: API Endpoint (Recommended for Production/Automated Updates)

The API endpoint is ideal for:
- Production deployments
- Automated updates via admin dashboard
- Integration with other systems

**Endpoint:**

```
POST /api/admin/books/bulk-update-categories
```

**Authentication:**

Requires `Authorization` header with admin secret:

```
Authorization: Bearer YOUR_ADMIN_HEALTH_SECRET
```

**Example Request:**

```bash
curl -X POST https://your-domain.com/api/admin/books/bulk-update-categories \
  -H "Authorization: Bearer your-admin-secret"
```

**Example Response (Success):**

```json
{
  "success": true,
  "message": "Bulk category update completed",
  "result": {
    "totalProcessed": 1000,
    "updated": 995,
    "errors": 5,
    "errorDetails": [
      {
        "bookId": "abc-123",
        "error": "Network timeout"
      },
      {
        "bookId": "def-456",
        "error": "Invalid data format"
      }
    ]
  },
  "responseTimeMs": 45230,
  "timestamp": "2026-01-14T22:00:00.000Z"
}
```

**Example Response (Unauthorized):**

```json
{
  "error": "Unauthorized",
  "message": "Authorization required",
  "timestamp": "2026-01-14T22:00:00.000Z"
}
```

## Environment Variables

Both methods require the following environment variables:

```bash
# Database connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# Admin authentication (for API endpoint only)
ADMIN_HEALTH_SECRET=your-admin-secret
```

## Update Logic

For each book in the database:

1. **If book has genres array with values:**
   - Set `category = genres[0]` (first genre)
   
2. **If book has empty or null genres array:**
   - Set `category = "Uncategorized"`

3. **Error handling:**
   - Errors are logged but don't stop the process
   - Failed books are tracked and reported
   - Process continues with remaining books

## Performance

- **Processing speed**: ~100-200 books per second
- **Progress feedback**: Every 100 books
- **Error resilience**: Continues on individual failures
- **Memory efficient**: Processes books in batches

## When to Run

Run the bulk update in these scenarios:

1. **Initial deployment** - After implementing the category sync feature
2. **After AI genre classification** - When books have been classified but categories not synced
3. **Data migration** - When moving from manual categories to AI-determined genres
4. **Periodic maintenance** - To fix any inconsistencies

## Verification

After running the bulk update, verify the results:

### Check Update Statistics

```sql
-- Count books by category
SELECT category, COUNT(*) as count
FROM books
GROUP BY category
ORDER BY count DESC;
```

### Verify Category Matches First Genre

```sql
-- Find books where category doesn't match first genre
SELECT id, title, category, genres[1] as first_genre
FROM books
WHERE category != genres[1]
  AND genres IS NOT NULL
  AND array_length(genres, 1) > 0;
```

### Check Uncategorized Books

```sql
-- Find books that should be uncategorized
SELECT id, title, category, genres
FROM books
WHERE (genres IS NULL OR array_length(genres, 1) = 0)
  AND category != 'Uncategorized';
```

## Troubleshooting

### Issue: "Missing required environment variables"

**Solution**: Ensure `.env.local` contains `SUPABASE_URL` and `SUPABASE_KEY`

### Issue: "Service not configured" (API endpoint)

**Solution**: Set `ADMIN_HEALTH_SECRET` environment variable

### Issue: High error rate

**Possible causes:**
- Database connection issues
- Invalid data in genres field
- Permission issues

**Solution**: Check error details in the output and fix underlying issues

### Issue: Slow performance

**Possible causes:**
- Large database
- Network latency
- Database load

**Solution**: 
- Run during off-peak hours
- Consider running in batches
- Check database performance metrics

## Safety

The bulk update is safe to run multiple times:

- **Idempotent**: Running multiple times produces the same result
- **Non-destructive**: Only updates the `category` field
- **Preserves data**: Doesn't modify `genres` array or other fields
- **Error resilient**: Continues processing even if some books fail

## Integration with Admin Dashboard

To integrate the bulk update into the admin dashboard:

1. Add a button in the admin panel
2. Call the API endpoint on button click
3. Display progress and results to the admin
4. Show error details if any failures occur

Example React component:

```typescript
const BulkUpdateButton = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleBulkUpdate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/books/bulk-update-categories', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`
        }
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Bulk update failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleBulkUpdate} disabled={loading}>
        {loading ? 'Updating...' : 'Update All Categories'}
      </button>
      {result && (
        <div>
          <p>Updated: {result.result.updated}</p>
          <p>Errors: {result.result.errors}</p>
        </div>
      )}
    </div>
  );
};
```

## See Also

- [Ingestion Filtering Requirements](../.kiro/specs/ingestion-filtering/requirements.md)
- [Ingestion Filtering Design](../.kiro/specs/ingestion-filtering/design.md)
- [Category Sync Implementation](../services/ingestion/databaseWriter.js)
