# Remove Loan/Borrow Features - Implementation Plan

## Overview
Remove all loan and borrow-related UI elements since the library doesn't offer loaning services. Keep database schema intact for potential future use.

## Features to Remove from UI

### 1. Book Status Display
**Location:** `components/BookDetailsModal.tsx`
- Remove "BORROWED" and "WAITLIST" status badges
- Keep only "AVAILABLE" status
- Simplify status display logic

### 2. Borrow Request Button
**Location:** `App.tsx`
- Remove `onBorrowRequest` prop and handler
- Remove borrow request API calls
- Remove borrow request success/error handling

### 3. Status Filter
**Location:** `App.tsx` (Browse view)
- Remove "Borrowed" and "Waitlist" options from status filter
- Keep only "All" and "Available" options

### 4. Availability Display
**Location:** `components/BookDetailsModal.tsx`
- Simplify or remove "Physical Copies" availability section
- Since no loaning, all books are always "available" for viewing

## Files to Modify

### High Priority (UI Changes)
1. ✅ `components/BookDetailsModal.tsx` - Remove loan status display
2. ✅ `App.tsx` - Remove borrow request functionality
3. ✅ `types.ts` - Keep BookStatus enum (for future use)

### Keep Unchanged (Backend/Database)
- ❌ `tests/borrow-requests/*` - Keep tests (commented out)
- ❌ `supabase_borrow_requests.sql` - Keep schema
- ❌ `api/*` borrow endpoints - Keep but unused

## Implementation Steps

### Step 1: Update BookDetailsModal.tsx
```typescript
// Remove BORROWED and WAITLIST from status display
// Simplify to show only if book is available for reading
// Remove physical copies availability section
```

### Step 2: Update App.tsx
```typescript
// Remove onBorrowRequest prop from BookDetailsModal
// Remove borrow request handler
// Remove status filter options for BORROWED/WAITLIST
```

### Step 3: Update types.ts (Optional)
```typescript
// Keep BookStatus enum but mark as deprecated
// Or simplify to just AVAILABLE
```

## What to Keep

### Database Schema
- Keep `borrow_requests` table (for future use)
- Keep `loans` table (for future use)
- Keep all RLS policies

### Backend APIs
- Keep borrow request endpoints (but unused)
- Keep loan management endpoints (but unused)

### Tests
- Keep all property-based tests (commented out)
- Document that features are disabled

## Benefits

1. ✅ Cleaner UI focused on reading/downloading
2. ✅ No confusion about borrowing physical copies
3. ✅ Simpler user experience
4. ✅ Easy to re-enable if needed (database intact)
5. ✅ Reduced maintenance burden

## Rollback Plan

If you want to re-enable loans in the future:
1. Uncomment the UI code
2. Re-add navigation items
3. Enable the API endpoints
4. Run the tests to verify functionality

## Notes

- This is a UI-only change
- No database migrations needed
- No data loss
- Reversible at any time
