# Design Document: Admin Book Management

## Overview

This design document outlines the architecture and implementation approach for the Admin Book Management feature. The system provides administrators with a comprehensive interface to view, edit, search, and manage books in the digital library. It integrates with the existing ingestion pipeline and adds new capabilities for manual book curation.

## Architecture

The feature follows the existing application architecture:
- **Frontend**: React components with TypeScript, using the existing theme system
- **Backend**: Vercel serverless functions (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage for cover images and PDFs
- **AI Services**: OpenRouter API for search ranking and classification

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Panel (React)                       │
├─────────────────────────────────────────────────────────────┤
│  BookManagementPanel                                         │
│  ├── BookListView (table with sorting/filtering)            │
│  ├── BookEditModal (metadata editing form)                  │
│  ├── CoverUploadModal (cover image management)              │
│  ├── AIBookSearch (search and queue for ingestion)          │
│  └── BulkActionsBar (multi-select operations)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Vercel)                        │
├─────────────────────────────────────────────────────────────┤
│  /api/admin/books                                            │
│  ├── GET    - List books with pagination/filtering          │
│  ├── PUT    - Update book metadata                          │
│  ├── DELETE - Delete book                                   │
│  /api/admin/books/[id]/cover                                │
│  ├── POST   - Upload/update cover image                     │
│  /api/admin/books/search                                    │
│  ├── POST   - AI-powered book search                        │
│  /api/admin/books/ingest                                    │
│  ├── POST   - Queue books for ingestion                     │
│  /api/admin/books/bulk                                      │
│  ├── POST   - Bulk operations                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Services Layer                            │
├─────────────────────────────────────────────────────────────┤
│  BookManagementService                                       │
│  ├── listBooks() - Query with filters                       │
│  ├── updateBook() - Update metadata                         │
│  ├── deleteBook() - Remove book and assets                  │
│  ├── uploadCover() - Handle cover uploads                   │
│  AIBookSearchService                                         │
│  ├── searchBooks() - Query Internet Archive                 │
│  ├── rankResults() - AI-powered relevance ranking           │
│  ManualIngestionService                                      │
│  ├── queueBooks() - Add to ingestion queue                  │
│  ├── processQueue() - Trigger ingestion                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (Supabase)                     │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                     │
│  ├── books - Main book records                              │
│  ├── book_audit_log - Edit/delete history                   │
│  ├── ingestion_queue - Manual ingestion queue               │
│  Storage:                                                    │
│  ├── book-covers - Cover images                             │
│  ├── book-pdfs - PDF files                                  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### BookManagementPanel
Main container component for the book management interface.

```typescript
interface BookManagementPanelProps {
  // No props - uses internal state and API calls
}

interface BookManagementState {
  books: Book[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  filters: BookFilters;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
  selectedBooks: string[];
}
```

#### BookListView
Displays books in a sortable, filterable table.

```typescript
interface BookListViewProps {
  books: Book[];
  loading: boolean;
  onSort: (field: SortField) => void;
  onFilter: (filters: BookFilters) => void;
  onSelect: (bookIds: string[]) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  selectedBooks: string[];
}

interface BookFilters {
  search?: string;
  category?: string;
  genre?: string;
  source?: 'internet_archive' | 'manual' | 'extraction';
  dateFrom?: string;
  dateTo?: string;
}

type SortField = 'title' | 'author' | 'added_date' | 'category';
```

#### BookEditModal
Modal form for editing book metadata.

```typescript
interface BookEditModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: BookUpdate) => Promise<void>;
}

interface BookUpdate {
  title?: string;
  author?: string;
  category?: string;
  genres?: string[];
  description?: string;
  published_year?: number;
  isbn?: string;
}
```

#### CoverUploadModal
Modal for managing book cover images.

```typescript
interface CoverUploadModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File | string) => Promise<void>;
}
```

#### AIBookSearch
Component for AI-powered book search and ingestion.

```typescript
interface AIBookSearchProps {
  onIngest: (books: SearchResult[]) => Promise<void>;
}

interface SearchCriteria {
  query: string;
  topic?: string;
  author?: string;
  yearFrom?: number;
  yearTo?: number;
  genre?: string;
  sources?: ('internet_archive' | 'open_library' | 'google_books')[];
  accessType?: ('public_domain' | 'open_access' | 'preview_only')[];
}

interface SearchResult {
  identifier: string;
  title: string;
  author: string;
  description: string;
  year?: number;
  coverUrl?: string;
  relevanceScore: number;
  alreadyInLibrary: boolean;
  source: 'internet_archive' | 'open_library' | 'google_books';
  accessType: 'public_domain' | 'open_access' | 'preview_only';
}
```

### API Endpoints

#### GET /api/admin/books
List books with pagination and filtering.

```typescript
// Request
interface ListBooksRequest {
  page?: number;        // Default: 1
  pageSize?: number;    // Default: 20, Max: 100
  search?: string;
  category?: string;
  genre?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Response
interface ListBooksResponse {
  success: boolean;
  books: Book[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

#### PUT /api/admin/books/:id
Update book metadata.

```typescript
// Request
interface UpdateBookRequest {
  title?: string;
  author?: string;
  category?: string;
  genres?: string[];
  description?: string;
  published_year?: number;
  isbn?: string;
}

// Response
interface UpdateBookResponse {
  success: boolean;
  book: Book;
  message: string;
}
```

#### DELETE /api/admin/books/:id
Delete a book and its assets.

```typescript
// Response
interface DeleteBookResponse {
  success: boolean;
  message: string;
  deletedAssets: {
    pdf: boolean;
    cover: boolean;
  };
}
```

#### POST /api/admin/books/:id/cover
Upload or update book cover.

```typescript
// Request (multipart/form-data or JSON)
interface UpdateCoverRequest {
  file?: File;      // For file upload
  coverUrl?: string; // For URL-based update
}

// Response
interface UpdateCoverResponse {
  success: boolean;
  coverUrl: string;
  message: string;
}
```

#### POST /api/admin/books/search
AI-powered book search.

```typescript
// Request
interface SearchBooksRequest {
  query: string;
  topic?: string;
  author?: string;
  yearFrom?: number;
  yearTo?: number;
  genre?: string;
  sources?: string[];     // Filter by source(s)
  accessType?: string[];  // Filter by access type
  limit?: number;         // Default: 20
}

// Response
interface SearchBooksResponse {
  success: boolean;
  results: SearchResult[];
  total: number;
  query: string;
  sourceBreakdown: {
    internet_archive: number;
    open_library: number;
    google_books: number;
  };
}
```

#### POST /api/admin/books/ingest
Queue books for manual ingestion.

```typescript
// Request
interface IngestBooksRequest {
  books: Array<{
    identifier: string;
    source: string;
  }>;
}

// Response
interface IngestBooksResponse {
  success: boolean;
  queued: number;
  skipped: number;
  results: Array<{
    identifier: string;
    status: 'queued' | 'duplicate' | 'error';
    message?: string;
  }>;
}
```

#### POST /api/admin/books/bulk
Bulk operations on multiple books.

```typescript
// Request
interface BulkOperationRequest {
  operation: 'update_category' | 'update_genre' | 'delete';
  bookIds: string[];
  data?: {
    category?: string;
    genres?: string[];
  };
}

// Response
interface BulkOperationResponse {
  success: boolean;
  processed: number;
  failed: number;
  results: Array<{
    bookId: string;
    status: 'success' | 'error';
    message?: string;
  }>;
}
```

## Data Models

### Book (Extended)
```typescript
interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  category_id?: string;
  genres?: string[];
  description?: string;
  cover_url?: string;
  soft_copy_url?: string;
  has_soft_copy: boolean;
  published_year?: number;
  isbn?: string;
  call_number?: string;
  shelf_location?: string;
  floor_number?: number;
  copies_available: number;
  total_copies: number;
  popularity: number;
  added_date: string;
  source?: string;           // 'internet_archive', 'open_library', 'google_books', 'manual', 'extraction'
  source_identifier?: string; // Original identifier from source
  access_type?: string;       // 'public_domain', 'open_access', 'preview_only'
}
```

### BookAuditLog
```sql
CREATE TABLE book_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  book_identifier VARCHAR(255),
  action VARCHAR(50) NOT NULL,  -- 'create', 'update', 'delete'
  changes JSONB,
  admin_user_id UUID REFERENCES users(id),
  admin_username VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### IngestionQueue
```sql
CREATE TABLE ingestion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL,
  source VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  priority INTEGER DEFAULT 0,
  metadata JSONB,
  error_message TEXT,
  queued_by UUID REFERENCES users(id),
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(identifier, source)
);
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Pagination Consistency
*For any* page request with a given page size, the number of returned books SHALL be less than or equal to the page size, and the total count SHALL accurately reflect the total number of books matching the filter criteria.
**Validates: Requirements 1.1, 1.7**

### Property 2: Sort Order Correctness
*For any* list of books and any valid sort field (title, author, date, category), the returned books SHALL be ordered according to the specified sort field and direction.
**Validates: Requirements 1.4**

### Property 3: Filter Accuracy
*For any* filter criteria (category, genre, source, date range, search term), all returned books SHALL match the specified criteria, and no books matching the criteria SHALL be excluded.
**Validates: Requirements 1.5, 1.6**

### Property 4: Update Round-Trip
*For any* valid book update, reading the book after update SHALL return the updated values for all modified fields.
**Validates: Requirements 2.3**

### Property 5: Invalid Update Rejection
*For any* invalid book update (invalid genre, empty required fields), the update SHALL be rejected and the original book data SHALL remain unchanged.
**Validates: Requirements 2.4, 2.5**

### Property 6: Audit Log Completeness
*For any* book modification (create, update, delete), an audit log entry SHALL be created containing the book identifier, action type, changes, admin user ID, and timestamp.
**Validates: Requirements 2.7, 6.5**

### Property 7: Image Format Validation
*For any* file upload, the system SHALL accept only valid image formats (JPEG, PNG, WebP) and reject all other file types.
**Validates: Requirements 3.2**

### Property 8: Cover Update Persistence
*For any* successful cover upload, the book record SHALL be updated with the new cover URL, and the image SHALL be accessible at that URL.
**Validates: Requirements 3.3, 3.5**

### Property 9: Cover Failure Resilience
*For any* failed cover upload, the book's existing cover URL SHALL remain unchanged.
**Validates: Requirements 3.6**

### Property 10: Duplicate Detection
*For any* search result, if a book with the same identifier exists in the library, it SHALL be marked as already present.
**Validates: Requirements 4.4**

### Property 11: Ingestion Queue Integrity
*For any* book queued for ingestion, if it already exists in the library, it SHALL be marked as duplicate and not re-ingested.
**Validates: Requirements 5.2, 5.5**

### Property 12: Deletion Completeness
*For any* confirmed book deletion, the book record SHALL be removed from the database, associated PDF SHALL be deleted from storage, and an audit log entry SHALL be created.
**Validates: Requirements 6.3, 6.4, 6.5**

### Property 13: Deletion Failure Resilience
*For any* failed deletion attempt, the book record and all associated assets SHALL remain intact.
**Validates: Requirements 6.6**

### Property 14: Bulk Operation Atomicity
*For any* bulk operation (category update, genre update, deletion), the operation SHALL be applied to all selected books, and the results SHALL accurately report success/failure for each book.
**Validates: Requirements 7.3, 7.4, 7.5**

### Property 15: Authorization Enforcement
*For any* API request to book management endpoints, requests without valid admin authentication SHALL receive a 401 Unauthorized response, and no data modification SHALL occur.
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

### Property 16: Multi-Source Metadata Normalization
*For any* book ingested from any supported source (Internet Archive, Open Library, Google Books), the resulting book record SHALL have all required fields populated in a consistent format regardless of source.
**Validates: Requirements 9.3, 9.5**

### Property 17: Source Preference for Duplicates
*For any* book that exists in multiple sources, when ingested, the system SHALL select the source with the most complete metadata (most non-null fields).
**Validates: Requirements 9.4**

### Property 18: Access Type Classification
*For any* ingested book, the system SHALL correctly classify its access_type as 'public_domain', 'open_access', or 'preview_only' based on publication year and licensing information.
**Validates: Requirements 10.4, 10.5, 10.6**

### Property 19: Year Range Filter Accuracy
*For any* search with yearFrom and/or yearTo filters, all returned books SHALL have publication years within the specified range.
**Validates: Requirements 10.2**

## Error Handling

### API Error Responses
All API endpoints return consistent error responses:

```typescript
interface ErrorResponse {
  success: false;
  error: string;      // Error code
  message: string;    // Human-readable message
  details?: any;      // Additional error details
  timestamp: string;
}
```

### Error Codes
- `UNAUTHORIZED` - Missing or invalid admin authentication
- `FORBIDDEN` - User lacks admin role
- `NOT_FOUND` - Book not found
- `VALIDATION_ERROR` - Invalid input data
- `DUPLICATE` - Book already exists
- `STORAGE_ERROR` - File storage operation failed
- `DATABASE_ERROR` - Database operation failed
- `EXTERNAL_API_ERROR` - Internet Archive API error

### Retry Strategy
- Database operations: Retry up to 3 times with exponential backoff
- Storage operations: Retry up to 2 times
- External API calls: Retry up to 2 times with 5-second delay

## Testing Strategy

### Unit Tests
- Validation functions for book metadata
- Filter and sort logic
- Image format detection
- Duplicate detection logic

### Property-Based Tests
Using fast-check library with minimum 100 iterations per property:
- Pagination consistency
- Sort order correctness
- Filter accuracy
- Update round-trip
- Authorization enforcement

### Integration Tests
- Full CRUD operations on books
- Cover upload workflow
- Bulk operations
- Audit logging

### Test Configuration
```typescript
// Property test configuration
const propertyTestConfig = {
  numRuns: 100,
  verbose: true,
  seed: Date.now()
};
```
