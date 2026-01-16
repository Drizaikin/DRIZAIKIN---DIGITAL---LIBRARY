# Requirements Document

## Introduction

This feature provides administrators with comprehensive tools to manage ingested books in the digital library. It includes an AI-powered book search and ingestion system, a detailed report view of all ingested books, and the ability to edit book metadata (title, author, category, genre, cover image). This enables administrators to curate the library collection effectively and ensure book metadata accuracy.

## Glossary

- **Admin_Panel**: The administrative interface accessible only to users with Admin role
- **Book_Manager**: The component responsible for displaying and editing book records
- **AI_Search_Service**: The service that uses AI to search for books based on criteria from external sources
- **Ingestion_Service**: The existing service that fetches and stores books from Internet Archive
- **Book_Record**: A database entry representing a single book with all its metadata
- **Cover_Image**: The visual representation of a book's cover stored in Supabase storage
- **Genre_Taxonomy**: The predefined list of valid genres from genreTaxonomy.js
- **Book_Source**: External providers of book data (Internet Archive, Open Library, Google Books)
- **Access_Type**: The availability classification of a book (public_domain, open_access, preview_only)

## Requirements

### Requirement 1: Ingested Books Report View

**User Story:** As an administrator, I want to view a comprehensive report of all ingested books, so that I can monitor the library collection and identify books that need attention.

#### Acceptance Criteria

1. WHEN an admin navigates to the Book Management panel THEN the System SHALL display a paginated list of all books in the database
2. WHEN displaying the book list THEN the System SHALL show title, author, category, genre, cover thumbnail, ingestion date, and source for each book
3. WHEN the admin clicks on a book row THEN the System SHALL expand to show full book details including description, PDF URL, and metadata
4. THE Book_Manager SHALL support sorting by title, author, date added, and category
5. THE Book_Manager SHALL support filtering by category, genre, ingestion source, and date range
6. WHEN the admin enters a search term THEN the System SHALL filter books by title, author, or ISBN in real-time
7. THE Book_Manager SHALL display total book count and filtered count statistics

### Requirement 2: Book Metadata Editing

**User Story:** As an administrator, I want to edit book metadata, so that I can correct errors and improve the quality of book information.

#### Acceptance Criteria

1. WHEN an admin clicks the edit button on a book THEN the System SHALL display an edit form with all editable fields
2. THE Edit_Form SHALL allow editing of: title, author, category, genre, description, published year, and ISBN
3. WHEN the admin submits valid changes THEN the System SHALL update the book record in the database
4. WHEN the admin submits invalid data THEN the System SHALL display validation errors without saving
5. THE System SHALL validate that genre selections are from the valid Genre_Taxonomy
6. WHEN a book is successfully updated THEN the System SHALL display a success notification
7. THE System SHALL log all book edits with timestamp and admin user ID for audit purposes

### Requirement 3: Book Cover Management

**User Story:** As an administrator, I want to update book cover images, so that I can improve the visual presentation of books in the catalog.

#### Acceptance Criteria

1. WHEN an admin clicks the cover edit button THEN the System SHALL display options to upload a new cover or enter a cover URL
2. WHEN the admin uploads an image file THEN the System SHALL validate it is a valid image format (JPEG, PNG, WebP)
3. WHEN the admin uploads an image THEN the System SHALL resize it to standard dimensions and upload to Supabase storage
4. WHEN the admin enters a cover URL THEN the System SHALL validate the URL is accessible and returns an image
5. WHEN a cover is successfully updated THEN the System SHALL update the book record with the new cover URL
6. IF the cover upload fails THEN the System SHALL display an error message and retain the existing cover

### Requirement 4: AI-Powered Book Search

**User Story:** As an administrator, I want to search for books using AI-powered criteria, so that I can find and ingest specific books that match the library's needs.

#### Acceptance Criteria

1. WHEN an admin enters search criteria (topic, author, time period, genre) THEN the AI_Search_Service SHALL query configured book sources for matching books
2. THE AI_Search_Service SHALL use AI to rank and filter results based on relevance to the search criteria
3. WHEN search results are returned THEN the System SHALL display them with title, author, description preview, and availability status
4. THE System SHALL indicate which books are already in the library to prevent duplicates
5. WHEN the admin selects books for ingestion THEN the System SHALL queue them for the Ingestion_Service
6. THE System SHALL respect the configured genre and author filters when displaying search results

### Requirement 9: Multi-Source Ingestion

**User Story:** As an administrator, I want to ingest books from multiple sources, so that I can build a diverse library collection beyond a single provider.

#### Acceptance Criteria

1. THE System SHALL support ingestion from multiple book sources including Internet Archive, Open Library, and Google Books
2. WHEN configuring ingestion THEN the Admin SHALL be able to enable/disable specific sources
3. THE System SHALL normalize book metadata from different sources into a consistent format
4. WHEN a book exists in multiple sources THEN the System SHALL prefer the source with the most complete metadata
5. THE System SHALL track the original source for each ingested book
6. WHEN searching for books THEN the Admin SHALL be able to filter by source

### Requirement 10: Modern Book Support

**User Story:** As an administrator, I want to ingest modern books (not just public domain), so that the library contains relevant contemporary content.

#### Acceptance Criteria

1. THE System SHALL support ingestion of books published after 1930 (modern era)
2. WHEN searching for books THEN the Admin SHALL be able to filter by publication year range
3. THE System SHALL display publication year prominently in search results and book listings
4. WHEN ingesting modern books THEN the System SHALL verify licensing/availability status
5. THE System SHALL support preview-only access for copyrighted modern books
6. THE System SHALL categorize books as 'public_domain', 'open_access', or 'preview_only' based on availability

### Requirement 5: Manual Book Ingestion

**User Story:** As an administrator, I want to manually trigger ingestion of specific books, so that I can add books that weren't captured by automatic ingestion.

#### Acceptance Criteria

1. WHEN an admin selects books from search results THEN the System SHALL display a confirmation dialog with selected books
2. WHEN the admin confirms ingestion THEN the System SHALL add books to the ingestion queue
3. THE System SHALL process queued books using the existing Ingestion_Service pipeline
4. WHEN ingestion completes THEN the System SHALL display success/failure status for each book
5. IF a book already exists in the library THEN the System SHALL skip it and report as duplicate
6. THE System SHALL apply AI genre classification to manually ingested books

### Requirement 6: Book Deletion

**User Story:** As an administrator, I want to delete books from the library, so that I can remove inappropriate or duplicate content.

#### Acceptance Criteria

1. WHEN an admin clicks the delete button on a book THEN the System SHALL display a confirmation dialog
2. THE Confirmation_Dialog SHALL warn about permanent deletion and show book title
3. WHEN the admin confirms deletion THEN the System SHALL remove the book record from the database
4. WHEN deleting a book THEN the System SHALL also delete the associated PDF from storage
5. THE System SHALL log all deletions with timestamp, admin user ID, and book identifier
6. IF deletion fails THEN the System SHALL display an error and retain the book record

### Requirement 7: Bulk Operations

**User Story:** As an administrator, I want to perform bulk operations on multiple books, so that I can efficiently manage large numbers of books.

#### Acceptance Criteria

1. THE Book_Manager SHALL support selecting multiple books via checkboxes
2. WHEN multiple books are selected THEN the System SHALL enable bulk action buttons
3. THE System SHALL support bulk category update for selected books
4. THE System SHALL support bulk genre update for selected books
5. THE System SHALL support bulk deletion with confirmation for selected books
6. WHEN performing bulk operations THEN the System SHALL display progress and results summary

### Requirement 8: Authorization and Security

**User Story:** As a system administrator, I want book management features to be restricted to authorized admins, so that unauthorized users cannot modify the library collection.

#### Acceptance Criteria

1. THE Book_Manager panel SHALL only be accessible to users with Admin role
2. WHEN a non-admin user attempts to access book management THEN the System SHALL redirect to the home page
3. ALL book management API endpoints SHALL require admin authentication
4. WHEN an unauthorized request is made THEN the API SHALL return 401 Unauthorized
5. THE System SHALL validate admin session before processing any modification request
