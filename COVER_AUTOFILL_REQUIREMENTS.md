# Auto-Fill Book Covers - Final Requirements

## Confirmed Requirements

### Approach
✅ **Option C: Hybrid**
- Try to find cover during ingestion
- If fails, retry 3 times immediately (0.5s intervals)
- If still fails, create notification for admin

### Retry Strategy
✅ **Immediate retries:**
- 3 retry attempts
- 0.5 second intervals between retries
- All retries happen during ingestion (before moving to next book)
- Non-blocking (doesn't stop ingestion if all retries fail)

### Notifications
✅ **Separate notifications panel:**
- New notification system for cover failures
- Notification shows book title and "Missing Cover" alert
- Click notification to open book edit page
- Admin can manually trigger cover search from there
- Notifications persist until resolved

### Cover Search Method
✅ **Use existing system:**
- Same as manual upload cover search
- Search online book cover databases
- Extract cover URL
- Validate title matches

### Validation
✅ **Title matching:**
- Cover should contain book title (or close match)
- Use fuzzy matching for validation
- Accept partial matches

### Target Books
✅ **Only missing covers:**
- Books with placeholder covers
- Books with null/empty cover_url
- Skip books that already have valid covers

## Implementation Plan

### Phase 1: Investigation (NOW)
1. Find existing cover search code
2. Understand how it works
3. Identify APIs being used
4. Document current implementation

### Phase 2: Specification
1. Create requirements document
2. Create design document
3. Create implementation tasks

### Phase 3: Implementation
1. Extract cover search into reusable service
2. Integrate into ingestion pipeline
3. Add retry logic (3 attempts, 0.5s intervals)
4. Create notifications system
5. Add admin notification panel
6. Add click-to-edit functionality

## Technical Details

### Retry Logic
```javascript
async function searchCoverWithRetries(book, maxRetries = 3, delayMs = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const coverUrl = await searchCover(book.title, book.author);
    
    if (coverUrl && validateCover(coverUrl, book.title)) {
      return { success: true, coverUrl };
    }
    
    if (attempt < maxRetries) {
      await delay(delayMs);
    }
  }
  
  // All retries failed - create notification
  await createCoverNotification(book.id, book.title);
  return { success: false };
}
```

### Notification System
```javascript
// Database table: cover_notifications
{
  id: UUID,
  book_id: UUID,
  book_title: string,
  status: 'pending' | 'resolved',
  created_at: timestamp,
  resolved_at: timestamp
}
```

### Admin Panel Integration
- New "Notifications" tab or panel
- Shows pending cover notifications
- Click notification → opens book edit page
- Existing "autofill AI button" works as manual trigger
- Mark notification as resolved when cover added

## Success Criteria

✅ **During Ingestion:**
- Cover search attempted for every book
- 3 retries with 0.5s intervals
- Non-blocking (continues if fails)
- Logs success/failure

✅ **Notifications:**
- Created for all failed cover searches
- Visible in admin panel
- Clickable to edit book
- Marked resolved when cover added

✅ **User Experience:**
- Most books get covers automatically
- Admin notified of failures
- Easy manual intervention
- No ingestion slowdown

## Next Steps

1. ✅ **Find existing cover search code** ← DOING NOW
2. 📋 Create specification documents
3. 🔨 Implement feature

---

**Status:** Investigating existing cover search system...
