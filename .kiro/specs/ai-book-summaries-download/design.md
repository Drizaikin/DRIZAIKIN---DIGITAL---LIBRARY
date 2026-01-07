# Design Document: AI Book Summaries & Download

## Overview

This feature enhances the AI Librarian to provide book summaries and download links for digital copies. The AI will be able to search the library database, generate summaries based on book metadata, and provide direct download links for PDFs stored in Supabase Storage.

## Architecture

```mermaid
graph TB
    subgraph Frontend
        AIChat[AI Librarian Chat]
        MsgFormat[Message Formatter]
    end
    
    subgraph API Layer
        ChatAPI[/api/ai/chat]
        BookSearch[/api/books/search]
        BookSummary[/api/ai/book-summary]
    end
    
    subgraph Database
        Books[books table]
        Storage[Supabase Storage]
    end
    
    AIChat --> ChatAPI
    ChatAPI --> BookSearch
    ChatAPI --> BookSummary
    BookSearch --> Books
    BookSummary --> Books
    MsgFormat --> AIChat
    Books --> Storage
```

## Components and Interfaces

### 1. Enhanced AI Chat Endpoint

The existing `/api/ai/chat` endpoint will be enhanced to:
- Detect book-related queries (summary requests, download requests)
- Search the books database when needed
- Include download links in responses for books with soft copies

### 2. Book Search Endpoint

**GET /api/books/search**
- Query params: `q` (search term), `field` (title/author/isbn/all)
- Returns: Array of matching books with availability and soft copy info

### 3. Book Summary Endpoint

**POST /api/ai/book-summary**
- Request: `{ bookId: string }` or `{ title: string, author: string }`
- Response: `{ summary: string, book: BookDetails, downloadUrl?: string }`

### 4. Message Formatter Enhancement

The `formatMessage` function in AILibrarian.tsx will be enhanced to:
- Render clickable download links
- Format book cards with cover images
- Display availability badges

## Data Models

### Book Search Result
```typescript
interface BookSearchResult {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  coverUrl: string;
  copiesAvailable: number;
  totalCopies: number;
  hasSoftCopy: boolean;
  softCopyUrl?: string;
}
```

### AI Response with Book Info
```typescript
interface AIBookResponse {
  text: string;
  books?: BookSearchResult[];
  downloadLinks?: Array<{
    bookId: string;
    title: string;
    url: string;
  }>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*



### Property 1: Book Search Triggers on Book Queries

*For any* user query that mentions a book title, author, or asks about a specific book, the AI system SHALL query the books database to find matching results.

**Validates: Requirements 1.1, 3.1**

### Property 2: Summary Generation for Found Books

*For any* book found in the database, the AI system SHALL generate a summary that includes information from the book's title, author, and description fields.

**Validates: Requirements 1.2**

### Property 3: Response Contains Required Book Information

*For any* AI response about a book, the response SHALL include the book's title, author, category, and availability status (copies available/total).

**Validates: Requirements 1.5, 3.3, 5.1**

### Property 4: Download Link Inclusion

*For any* book that has `hasSoftCopy: true` and a valid `softCopyUrl`, when a user requests to download or access the digital version, the AI response SHALL include a clickable download link with the book title.

**Validates: Requirements 2.2, 2.5**

### Property 5: Multi-Field Search

*For any* search query, the system SHALL search across title, author, ISBN, and category fields, returning all books that match in any of these fields.

**Validates: Requirements 3.2**

### Property 6: Authenticated Download Access

*For any* authenticated user (Reader, Premium, or Admin role), the system SHALL allow access to download PDF files without additional permission checks.

**Validates: Requirements 4.1**

### Property 7: Markdown Formatting

*For any* AI response containing book information, the response text SHALL use markdown formatting (bold for titles, bullet points for lists).

**Validates: Requirements 5.3**

### Property 8: Numbered List for Multiple Results

*For any* AI response that includes multiple books, the books SHALL be numbered sequentially for easy reference.

**Validates: Requirements 5.4**

## Error Handling

| Scenario | Response |
|----------|----------|
| No books match query | "I couldn't find any books matching '[query]'. Try searching by title, author, or category." |
| Book has no soft copy | "This book is only available as a physical copy. You can borrow it from the library." |
| User not authenticated | "Please log in to download books from our digital collection." |
| Database error | "I'm having trouble searching the catalog right now. Please try again." |

## Testing Strategy

### Unit Tests
- Test query detection (is this a book-related query?)
- Test search function with various inputs
- Test response formatting functions
- Test download link generation

### Property-Based Tests
- **Property 1**: Generate random book-related queries and verify database is queried
- **Property 3**: For random books, verify response contains all required fields
- **Property 4**: For books with soft copies, verify download link is included
- **Property 5**: Search with random terms and verify multi-field matching
- **Property 8**: For multiple book results, verify numbering

### Integration Tests
- End-to-end chat flow with book queries
- Download link functionality
- Search across different book attributes
