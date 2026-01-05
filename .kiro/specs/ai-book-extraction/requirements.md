# Requirements Document

## Introduction

This feature enables administrators to automatically extract PDF books from external websites and import them into the library system. The system crawls specified URLs, discovers PDF files, downloads them, and uses AI (Gemini) to extract metadata including title, author, description, synopsis, and cover images. Administrators can control extraction limits by time duration or book count, monitor progress in real-time, and manage extraction jobs through a dedicated admin panel. The extraction process runs in the background and is completely hidden from regular users.

## Glossary

- **Extraction_Job**: A background process that crawls a website URL to discover and import PDF books
- **PDF_Crawler**: Component that scans web pages to find links to PDF files
- **Metadata_Extractor**: AI-powered component using Gemini to extract book information from PDF content
- **Extraction_Panel**: Admin-only UI section for managing and monitoring extraction jobs
- **Job_Limit**: Configurable constraints (time or book count) that determine when an extraction job stops
- **Job_Status**: Current state of an extraction job (pending, running, paused, completed, failed, stopped)

## Requirements

### Requirement 1

**User Story:** As an administrator, I want to start an automated book extraction by providing a website URL, so that I can bulk import PDF books without manually downloading each one.

#### Acceptance Criteria

1. WHEN an administrator submits a valid website URL THEN the Extraction_Job SHALL begin crawling the URL to discover PDF links
2. WHEN the PDF_Crawler discovers a link ending in .pdf or with PDF content-type THEN the Extraction_Job SHALL queue the PDF for download and processing
3. WHEN a PDF file is successfully downloaded THEN the Metadata_Extractor SHALL analyze the PDF content using Gemini AI
4. IF the submitted URL is invalid or unreachable THEN the Extraction_Job SHALL display an error message and remain in failed status
5. WHEN an extraction job starts THEN the Extraction_Job SHALL record the start timestamp and administrator ID

### Requirement 2

**User Story:** As an administrator, I want to set limits on extraction jobs, so that I can control resource usage and prevent excessive downloads.

#### Acceptance Criteria

1. WHEN creating an extraction job THEN the Extraction_Panel SHALL allow the administrator to specify a maximum time duration in minutes
2. WHEN creating an extraction job THEN the Extraction_Panel SHALL allow the administrator to specify a maximum number of books to extract
3. WHEN the extraction job reaches the time limit THEN the Extraction_Job SHALL stop processing and mark status as completed
4. WHEN the extraction job reaches the book count limit THEN the Extraction_Job SHALL stop processing and mark status as completed
5. WHEN both limits are set THEN the Extraction_Job SHALL stop when either limit is reached first
6. IF no limits are specified THEN the Extraction_Job SHALL use default limits of 60 minutes and 100 books

### Requirement 3

**User Story:** As an administrator, I want AI to automatically extract book metadata from PDFs, so that books are added with complete information without manual data entry.

#### Acceptance Criteria

1. WHEN a PDF is processed THEN the Metadata_Extractor SHALL extract or generate the book title from PDF content
2. WHEN a PDF is processed THEN the Metadata_Extractor SHALL extract or generate the author name from PDF content
3. WHEN a PDF is processed THEN the Metadata_Extractor SHALL generate a description of 100-200 words summarizing the book
4. WHEN a PDF is processed THEN the Metadata_Extractor SHALL generate a synopsis of 50-100 words for display purposes
5. WHEN a PDF is processed THEN the Metadata_Extractor SHALL determine an appropriate category from existing library categories
6. WHEN metadata extraction completes THEN the Metadata_Extractor SHALL attempt to find a cover image using Google Books API based on title and author
7. IF Google Books API returns no cover THEN the Metadata_Extractor SHALL generate a placeholder cover with the book title
8. IF metadata extraction fails for a PDF THEN the Extraction_Job SHALL log the error and continue with the next PDF

### Requirement 4

**User Story:** As an administrator, I want to monitor extraction progress in real-time, so that I can track how many books have been imported and identify any issues.

#### Acceptance Criteria

1. WHEN an extraction job is running THEN the Extraction_Panel SHALL display the current progress including books processed and books remaining
2. WHEN an extraction job is running THEN the Extraction_Panel SHALL display elapsed time and estimated time remaining
3. WHEN a book is successfully extracted THEN the Extraction_Panel SHALL update the progress counter within 5 seconds
4. WHEN an error occurs during extraction THEN the Extraction_Panel SHALL display the error in a log section
5. WHEN viewing the Extraction_Panel THEN the administrator SHALL see a list of recently extracted books with their titles and status

### Requirement 5

**User Story:** As an administrator, I want to pause, resume, and stop extraction jobs, so that I can manage server resources and handle unexpected situations.

#### Acceptance Criteria

1. WHEN an administrator clicks pause on a running job THEN the Extraction_Job SHALL suspend processing and retain current progress
2. WHEN an administrator clicks resume on a paused job THEN the Extraction_Job SHALL continue processing from where it stopped
3. WHEN an administrator clicks stop on a running or paused job THEN the Extraction_Job SHALL terminate and mark status as stopped
4. WHEN a job is stopped THEN the Extraction_Job SHALL retain all books extracted before stopping
5. WHEN viewing the Extraction_Panel THEN the administrator SHALL see appropriate action buttons based on current job status

### Requirement 6

**User Story:** As an administrator, I want to view extraction history, so that I can review past imports and their results.

#### Acceptance Criteria

1. WHEN viewing the Extraction_Panel THEN the administrator SHALL see a history of all extraction jobs sorted by date descending
2. WHEN viewing extraction history THEN each job entry SHALL display source URL, status, books extracted count, duration, and completion timestamp
3. WHEN an administrator clicks on a history entry THEN the Extraction_Panel SHALL display detailed information including list of extracted books
4. WHEN viewing job details THEN the administrator SHALL have the option to delete failed or incomplete extractions

### Requirement 7

**User Story:** As a regular user, I want extraction activities to be hidden from my view, so that I only see the final published books in the library.

#### Acceptance Criteria

1. WHEN a non-admin user browses the library THEN the user interface SHALL hide all extraction-related panels and controls
2. WHEN books are being extracted THEN the books SHALL remain hidden from the public catalog until extraction completes
3. WHEN an extraction job completes successfully THEN the extracted books SHALL automatically become visible in the public catalog
4. WHEN a user searches the library THEN search results SHALL exclude books from in-progress extraction jobs

### Requirement 8

**User Story:** As an administrator, I want the extraction panel to work well on mobile devices, so that I can monitor extractions from my phone.

#### Acceptance Criteria

1. WHEN viewing the Extraction_Panel on a mobile device THEN the layout SHALL adapt to fit the screen width without horizontal scrolling
2. WHEN viewing extraction progress on mobile THEN the progress indicators SHALL remain readable and touch-friendly
3. WHEN managing extraction jobs on mobile THEN action buttons SHALL be appropriately sized for touch interaction (minimum 44x44 pixels)
4. WHEN viewing extraction history on mobile THEN the list SHALL use a card-based layout optimized for vertical scrolling
5. WHEN viewing job details on mobile THEN the information SHALL be organized in collapsible sections to reduce scrolling

### Requirement 9

**User Story:** As an administrator using a mobile device, I want the Admin Panel navigation tabs to be accessible without horizontal scrolling, so that I can easily switch between sections on small screens.

#### Acceptance Criteria

1. WHEN viewing the Admin_Panel on a mobile device THEN the navigation tabs SHALL be accessible via a horizontal scrollable container or dropdown menu
2. WHEN the screen width is below 768 pixels THEN the Admin_Panel SHALL display a hamburger menu or dropdown selector for tab navigation
3. WHEN using the mobile navigation THEN all tabs (Books Management, User Management, Borrow Requests, Active Loans, Extractions) SHALL be accessible with a single tap
4. WHEN a tab is selected on mobile THEN the navigation SHALL clearly indicate the currently active tab
5. WHEN scrolling through tab content on mobile THEN the navigation control SHALL remain fixed or easily accessible
6. WHEN viewing any Admin_Panel section on mobile THEN the content SHALL fit within the viewport width without requiring horizontal scrolling
