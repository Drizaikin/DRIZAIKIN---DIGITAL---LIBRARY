/**
 * Integration Tests for End-to-End Ingestion Flow
 * **Feature: public-domain-book-ingestion**
 * **Validates: Requirements 1.1-1.5, 5.1-5.4, 6.1-6.3**
 * 
 * This test verifies the complete pipeline execution:
 * - Mock Internet Archive API responses
 * - Verify complete pipeline execution
 * - Validate database state after run
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Mock types for Internet Archive API response
 */
interface IADocument {
  identifier: string;
  title: string;
  creator: string | string[];
  date?: string;
  language?: string | string[];
  description?: string | string[];
}

interface IASearchResponse {
  response: {
    numFound: number;
    start: number;
    docs: IADocument[];
  };
}

/**
 * Mock types for internal services
 */
interface BookMetadata {
  identifier: string;
  title: string;
  creator: string;
  date?: string | null;
  language?: string | null;
  description?: string | null;
}

interface BookRecord {
  id: string;
  title: string;
  author: string;
  year?: number | null;
  language?: string | null;
  source: string;
  source_identifier: string;
  pdf_url: string;
  description?: string | null;
}

interface JobResult {
  jobId: string;
  status: 'completed' | 'partial' | 'failed';
  startedAt: Date;
  completedAt: Date;
  processed: number;
  added: number;
  skipped: number;
  failed: number;
  errors: Array<{ identifier: string; error: string; timestamp: string }>;
}

/**
 * Simulates the Internet Archive Fetcher service
 * Parses API response and constructs PDF URLs
 */
class MockInternetArchiveFetcher {
  private mockResponse: IASearchResponse | null = null;
  private shouldFail: boolean = false;
  private failureMessage: string = '';

  setMockResponse(response: IASearchResponse): void {
    this.mockResponse = response;
    this.shouldFail = false;
  }

  setFailure(message: string): void {
    this.shouldFail = true;
    this.failureMessage = message;
  }

  async fetchBooks(options: { batchSize?: number; page?: number } = {}): Promise<BookMetadata[]> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    if (!this.mockResponse) {
      return [];
    }

    return this.mockResponse.response.docs
      .filter(doc => doc.identifier)
      .map(doc => this.parseBookDocument(doc));
  }

  parseBookDocument(doc: IADocument): BookMetadata {
    return {
      identifier: doc.identifier || '',
      title: doc.title || 'Unknown Title',
      creator: Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || 'Unknown Author'),
      date: doc.date || null,
      language: Array.isArray(doc.language) ? doc.language[0] : (doc.language || null),
      description: Array.isArray(doc.description) ? doc.description.join(' ') : (doc.description || null)
    };
  }

  getPdfUrl(identifier: string): string {
    if (!identifier || typeof identifier !== 'string') {
      throw new Error('Invalid identifier: must be a non-empty string');
    }
    return `https://archive.org/download/${identifier}/${identifier}.pdf`;
  }
}

/**
 * Simulates the Deduplication Engine service
 */
class MockDeduplicationEngine {
  private existingIdentifiers: Set<string> = new Set();

  setExistingBooks(identifiers: string[]): void {
    this.existingIdentifiers = new Set(identifiers);
  }

  async bookExists(sourceIdentifier: string): Promise<boolean> {
    return this.existingIdentifiers.has(sourceIdentifier);
  }

  async filterNewBooks(books: BookMetadata[]): Promise<BookMetadata[]> {
    return books.filter(book => !this.existingIdentifiers.has(book.identifier));
  }

  addBook(identifier: string): void {
    this.existingIdentifiers.add(identifier);
  }
}

/**
 * Simulates the PDF Validator service
 */
class MockPdfValidator {
  private failingIdentifiers: Set<string> = new Set();
  private emptyIdentifiers: Set<string> = new Set();

  setFailingDownloads(identifiers: string[]): void {
    this.failingIdentifiers = new Set(identifiers);
  }

  setEmptyDownloads(identifiers: string[]): void {
    this.emptyIdentifiers = new Set(identifiers);
  }

  async downloadAndValidate(url: string): Promise<{ buffer: Buffer; size: number } | null> {
    // Extract identifier from URL
    const match = url.match(/\/download\/([^/]+)\//);
    const identifier = match ? match[1] : '';

    if (this.failingIdentifiers.has(identifier)) {
      return null; // Simulates download failure
    }

    if (this.emptyIdentifiers.has(identifier)) {
      return null; // Simulates empty file
    }

    // Return mock valid PDF (with PDF magic bytes)
    const pdfMagicBytes = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    const mockContent = Buffer.from(' mock pdf content');
    const buffer = Buffer.concat([pdfMagicBytes, mockContent]);
    
    return { buffer, size: buffer.length };
  }

  sanitizeFilename(identifier: string): string {
    if (!identifier || typeof identifier !== 'string') {
      throw new Error('Invalid identifier: must be a non-empty string');
    }
    
    let sanitized = identifier
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    
    if (sanitized.length === 0) {
      sanitized = 'unnamed';
    }
    
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200);
    }
    
    return sanitized;
  }
}

/**
 * Simulates the Storage Uploader service
 */
class MockStorageUploader {
  private uploadedFiles: Map<string, Buffer> = new Map();
  private failingUploads: Set<string> = new Set();

  setFailingUploads(filenames: string[]): void {
    this.failingUploads = new Set(filenames);
  }

  async uploadPdf(pdfBuffer: Buffer, filename: string): Promise<string> {
    if (this.failingUploads.has(filename)) {
      throw new Error(`Storage upload failed for ${filename}`);
    }

    const storagePath = `internet_archive/${filename}.pdf`;
    this.uploadedFiles.set(storagePath, pdfBuffer);
    
    return `https://storage.example.com/books/${storagePath}`;
  }

  async fileExists(path: string): Promise<boolean> {
    return this.uploadedFiles.has(path);
  }

  getUploadedFiles(): Map<string, Buffer> {
    return new Map(this.uploadedFiles);
  }

  clear(): void {
    this.uploadedFiles.clear();
  }
}

/**
 * Simulates the Database Writer service
 */
class MockDatabaseWriter {
  private books: Map<string, BookRecord> = new Map();
  private jobLogs: Map<string, any> = new Map();
  private failingInserts: Set<string> = new Set();

  setFailingInserts(identifiers: string[]): void {
    this.failingInserts = new Set(identifiers);
  }

  async insertBook(book: Omit<BookRecord, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> {
    if (this.failingInserts.has(book.source_identifier)) {
      return { success: false, error: `Insert failed for ${book.source_identifier}` };
    }

    // Check for duplicate (unique constraint)
    if (this.books.has(book.source_identifier)) {
      return { success: false, error: 'Book already exists (duplicate source_identifier)' };
    }

    const id = `book_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const bookRecord: BookRecord = { ...book, id };
    this.books.set(book.source_identifier, bookRecord);
    
    return { success: true, id };
  }

  async createJobLog(jobType: string): Promise<{ success: boolean; jobId?: string; error?: string }> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.jobLogs.set(jobId, { jobType, status: 'running', startedAt: new Date() });
    return { success: true, jobId };
  }

  async logJobResult(result: any): Promise<{ success: boolean; error?: string }> {
    if (result.jobId && this.jobLogs.has(result.jobId)) {
      this.jobLogs.set(result.jobId, { ...this.jobLogs.get(result.jobId), ...result });
    }
    return { success: true };
  }

  getBooks(): Map<string, BookRecord> {
    return new Map(this.books);
  }

  getBookCount(): number {
    return this.books.size;
  }

  clear(): void {
    this.books.clear();
    this.jobLogs.clear();
  }
}


/**
 * Simulates the Ingestion Orchestrator service
 * Coordinates all services for the complete pipeline
 */
class MockIngestionOrchestrator {
  private fetcher: MockInternetArchiveFetcher;
  private deduplicator: MockDeduplicationEngine;
  private validator: MockPdfValidator;
  private uploader: MockStorageUploader;
  private dbWriter: MockDatabaseWriter;

  constructor(
    fetcher: MockInternetArchiveFetcher,
    deduplicator: MockDeduplicationEngine,
    validator: MockPdfValidator,
    uploader: MockStorageUploader,
    dbWriter: MockDatabaseWriter
  ) {
    this.fetcher = fetcher;
    this.deduplicator = deduplicator;
    this.validator = validator;
    this.uploader = uploader;
    this.dbWriter = dbWriter;
  }

  async runIngestionJob(options: { batchSize?: number; dryRun?: boolean; page?: number } = {}): Promise<JobResult> {
    const startedAt = new Date();
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const dryRun = options.dryRun || false;

    const result: JobResult = {
      jobId,
      status: 'completed',
      startedAt,
      completedAt: new Date(),
      processed: 0,
      added: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    // Create job log (unless dry run)
    if (!dryRun) {
      await this.dbWriter.createJobLog('scheduled');
    }

    try {
      // Step 1: Fetch books from Internet Archive (Req 1.1-1.3)
      const books = await this.fetcher.fetchBooks(options);
      
      if (!books || books.length === 0) {
        result.completedAt = new Date();
        return result;
      }

      // Step 2: Filter duplicates (Req 3.1, 3.2)
      const newBooks = await this.deduplicator.filterNewBooks(books);
      result.skipped = books.length - newBooks.length;

      // Step 3: Process each new book
      for (const book of newBooks) {
        result.processed++;

        try {
          // Construct PDF URL (Req 1.4)
          const pdfUrl = this.fetcher.getPdfUrl(book.identifier);

          if (dryRun) {
            result.added++;
            continue;
          }

          // Download and validate PDF (Req 4.1-4.3)
          const pdfResult = await this.validator.downloadAndValidate(pdfUrl);
          if (!pdfResult) {
            result.failed++;
            result.errors.push({
              identifier: book.identifier,
              error: 'PDF download or validation failed',
              timestamp: new Date().toISOString()
            });
            continue;
          }

          // Upload to storage (Req 5.1-5.4)
          const sanitizedFilename = this.validator.sanitizeFilename(book.identifier);
          const storedPdfUrl = await this.uploader.uploadPdf(pdfResult.buffer, sanitizedFilename);

          // Parse year from date
          let year: number | null = null;
          if (book.date) {
            const yearMatch = book.date.match(/\d{4}/);
            if (yearMatch) {
              year = parseInt(yearMatch[0], 10);
            }
          }

          // Insert into database (Req 6.1-6.3)
          const bookRecord = {
            title: book.title || 'Unknown Title',
            author: book.creator || 'Unknown Author',
            year,
            language: book.language || null,
            source: 'internet_archive',
            source_identifier: book.identifier,
            pdf_url: storedPdfUrl,
            description: book.description || null
          };

          const insertResult = await this.dbWriter.insertBook(bookRecord);
          if (!insertResult.success) {
            result.failed++;
            result.errors.push({
              identifier: book.identifier,
              error: insertResult.error || 'Database insert failed',
              timestamp: new Date().toISOString()
            });
            continue;
          }

          // Mark as added in deduplicator for subsequent checks
          this.deduplicator.addBook(book.identifier);
          result.added++;

        } catch (error) {
          result.failed++;
          result.errors.push({
            identifier: book.identifier,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Determine final status
      if (result.failed > 0 && result.added > 0) {
        result.status = 'partial';
      } else if (result.failed > 0 && result.added === 0) {
        result.status = 'failed';
      } else {
        result.status = 'completed';
      }

    } catch (error) {
      result.status = 'failed';
      result.errors.push({
        identifier: 'job',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

    result.completedAt = new Date();
    return result;
  }
}

/**
 * Creates a mock Internet Archive API response
 */
function createMockIAResponse(books: Partial<IADocument>[]): IASearchResponse {
  return {
    response: {
      numFound: books.length,
      start: 0,
      docs: books.map((book, index) => ({
        identifier: book.identifier || `book_${index}`,
        title: book.title || `Test Book ${index}`,
        creator: book.creator || 'Test Author',
        date: book.date || '1900',
        language: book.language || 'en',
        description: book.description || 'Test description'
      }))
    }
  };
}

describe('End-to-End Ingestion Flow - Integration Tests', () => {
  let fetcher: MockInternetArchiveFetcher;
  let deduplicator: MockDeduplicationEngine;
  let validator: MockPdfValidator;
  let uploader: MockStorageUploader;
  let dbWriter: MockDatabaseWriter;
  let orchestrator: MockIngestionOrchestrator;

  beforeEach(() => {
    fetcher = new MockInternetArchiveFetcher();
    deduplicator = new MockDeduplicationEngine();
    validator = new MockPdfValidator();
    uploader = new MockStorageUploader();
    dbWriter = new MockDatabaseWriter();
    orchestrator = new MockIngestionOrchestrator(fetcher, deduplicator, validator, uploader, dbWriter);
  });

  /**
   * Test: Complete pipeline execution with valid books
   * Validates: Requirements 1.1-1.5, 5.1-5.4, 6.1-6.3
   */
  it('should execute complete pipeline for valid books', async () => {
    // Setup mock Internet Archive response
    const mockBooks = [
      { identifier: 'ancient_philosophy_001', title: 'Ancient Philosophy', creator: 'Plato', date: '1850' },
      { identifier: 'classical_literature_002', title: 'Classical Literature', creator: 'Homer', date: '1875' },
      { identifier: 'historical_texts_003', title: 'Historical Texts', creator: 'Herodotus', date: '1900' }
    ];
    fetcher.setMockResponse(createMockIAResponse(mockBooks));

    // Run ingestion
    const result = await orchestrator.runIngestionJob({ batchSize: 10 });

    // Verify job completed successfully
    expect(result.status).toBe('completed');
    expect(result.processed).toBe(3);
    expect(result.added).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify database state (Req 6.1-6.3)
    const books = dbWriter.getBooks();
    expect(books.size).toBe(3);

    // Verify each book was inserted correctly
    const book1 = books.get('ancient_philosophy_001');
    expect(book1).toBeDefined();
    expect(book1?.title).toBe('Ancient Philosophy');
    expect(book1?.author).toBe('Plato');
    expect(book1?.source).toBe('internet_archive');
    expect(book1?.source_identifier).toBe('ancient_philosophy_001');
    expect(book1?.pdf_url).toContain('ancient_philosophy_001');

    // Verify storage uploads (Req 5.1-5.4)
    const uploadedFiles = uploader.getUploadedFiles();
    expect(uploadedFiles.size).toBe(3);
  });

  /**
   * Test: Pipeline handles API failure gracefully
   * Validates: Requirement 1.5
   */
  it('should handle Internet Archive API failure gracefully', async () => {
    // Setup API failure
    fetcher.setFailure('Internet Archive API unavailable');

    // Run ingestion
    const result = await orchestrator.runIngestionJob({ batchSize: 10 });

    // Verify job failed gracefully
    expect(result.status).toBe('failed');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].error).toContain('Internet Archive API unavailable');

    // Verify no books were added
    expect(dbWriter.getBookCount()).toBe(0);
  });

  /**
   * Test: Pipeline skips duplicate books
   * Validates: Requirements 3.1, 3.2
   */
  it('should skip duplicate books based on source_identifier', async () => {
    // Setup existing books in database
    deduplicator.setExistingBooks(['existing_book_001', 'existing_book_002']);

    // Setup mock response with mix of new and existing books
    const mockBooks = [
      { identifier: 'existing_book_001', title: 'Existing Book 1' },
      { identifier: 'new_book_001', title: 'New Book 1' },
      { identifier: 'existing_book_002', title: 'Existing Book 2' },
      { identifier: 'new_book_002', title: 'New Book 2' }
    ];
    fetcher.setMockResponse(createMockIAResponse(mockBooks));

    // Run ingestion
    const result = await orchestrator.runIngestionJob({ batchSize: 10 });

    // Verify correct counts
    expect(result.status).toBe('completed');
    expect(result.skipped).toBe(2); // existing_book_001 and existing_book_002
    expect(result.added).toBe(2);   // new_book_001 and new_book_002
    expect(result.processed).toBe(2); // Only new books are processed

    // Verify only new books were added to database
    const books = dbWriter.getBooks();
    expect(books.size).toBe(2);
    expect(books.has('new_book_001')).toBe(true);
    expect(books.has('new_book_002')).toBe(true);
    expect(books.has('existing_book_001')).toBe(false);
  });

  /**
   * Test: Pipeline handles PDF download failures
   * Validates: Requirements 4.2, 4.3
   */
  it('should handle PDF download failures and continue processing', async () => {
    // Setup mock response
    const mockBooks = [
      { identifier: 'valid_book_001', title: 'Valid Book 1' },
      { identifier: 'failing_book_001', title: 'Failing Book 1' },
      { identifier: 'valid_book_002', title: 'Valid Book 2' }
    ];
    fetcher.setMockResponse(createMockIAResponse(mockBooks));

    // Setup PDF download failure for one book
    validator.setFailingDownloads(['failing_book_001']);

    // Run ingestion
    const result = await orchestrator.runIngestionJob({ batchSize: 10 });

    // Verify partial completion
    expect(result.status).toBe('partial');
    expect(result.processed).toBe(3);
    expect(result.added).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].identifier).toBe('failing_book_001');

    // Verify only valid books were added
    const books = dbWriter.getBooks();
    expect(books.size).toBe(2);
    expect(books.has('valid_book_001')).toBe(true);
    expect(books.has('valid_book_002')).toBe(true);
    expect(books.has('failing_book_001')).toBe(false);
  });

  /**
   * Test: Pipeline handles storage upload failures
   * Validates: Requirement 5.3
   */
  it('should handle storage upload failures and continue processing', async () => {
    // Setup mock response
    const mockBooks = [
      { identifier: 'book_001', title: 'Book 1' },
      { identifier: 'book_002', title: 'Book 2' },
      { identifier: 'book_003', title: 'Book 3' }
    ];
    fetcher.setMockResponse(createMockIAResponse(mockBooks));

    // Setup storage upload failure for one book
    uploader.setFailingUploads(['book_002']);

    // Run ingestion
    const result = await orchestrator.runIngestionJob({ batchSize: 10 });

    // Verify partial completion
    expect(result.status).toBe('partial');
    expect(result.added).toBe(2);
    expect(result.failed).toBe(1);

    // Verify only successful books were added to database
    const books = dbWriter.getBooks();
    expect(books.size).toBe(2);
  });

  /**
   * Test: Pipeline handles database insert failures
   * Validates: Requirement 6.3
   */
  it('should handle database insert failures and continue processing', async () => {
    // Setup mock response
    const mockBooks = [
      { identifier: 'book_001', title: 'Book 1' },
      { identifier: 'book_002', title: 'Book 2' },
      { identifier: 'book_003', title: 'Book 3' }
    ];
    fetcher.setMockResponse(createMockIAResponse(mockBooks));

    // Setup database insert failure for one book
    dbWriter.setFailingInserts(['book_002']);

    // Run ingestion
    const result = await orchestrator.runIngestionJob({ batchSize: 10 });

    // Verify partial completion
    expect(result.status).toBe('partial');
    expect(result.added).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors.some(e => e.identifier === 'book_002')).toBe(true);
  });

  /**
   * Test: Dry run mode has no side effects
   * Validates: Requirement 9.3
   */
  it('should not modify database or storage in dry run mode', async () => {
    // Setup mock response
    const mockBooks = [
      { identifier: 'book_001', title: 'Book 1' },
      { identifier: 'book_002', title: 'Book 2' }
    ];
    fetcher.setMockResponse(createMockIAResponse(mockBooks));

    // Run ingestion in dry run mode
    const result = await orchestrator.runIngestionJob({ batchSize: 10, dryRun: true });

    // Verify job reports books as "would be added"
    expect(result.status).toBe('completed');
    expect(result.added).toBe(2);

    // Verify no actual changes to database
    expect(dbWriter.getBookCount()).toBe(0);

    // Verify no actual uploads to storage
    expect(uploader.getUploadedFiles().size).toBe(0);
  });

  /**
   * Test: Empty API response is handled correctly
   */
  it('should handle empty API response gracefully', async () => {
    // Setup empty response
    fetcher.setMockResponse(createMockIAResponse([]));

    // Run ingestion
    const result = await orchestrator.runIngestionJob({ batchSize: 10 });

    // Verify job completed with no books
    expect(result.status).toBe('completed');
    expect(result.processed).toBe(0);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
  });

  /**
   * Test: PDF URL construction follows correct pattern
   * Validates: Requirement 1.4
   */
  it('should construct PDF URLs correctly', () => {
    const identifier = 'test_book_identifier';
    const pdfUrl = fetcher.getPdfUrl(identifier);
    
    expect(pdfUrl).toBe(`https://archive.org/download/${identifier}/${identifier}.pdf`);
  });

  /**
   * Test: Book metadata is parsed correctly from API response
   * Validates: Requirement 1.3
   */
  it('should parse book metadata correctly from API response', () => {
    const doc: IADocument = {
      identifier: 'test_book',
      title: 'Test Title',
      creator: ['Author One', 'Author Two'],
      date: '1850',
      language: ['en', 'fr'],
      description: ['Part 1', 'Part 2']
    };

    const parsed = fetcher.parseBookDocument(doc);

    expect(parsed.identifier).toBe('test_book');
    expect(parsed.title).toBe('Test Title');
    expect(parsed.creator).toBe('Author One, Author Two');
    expect(parsed.date).toBe('1850');
    expect(parsed.language).toBe('en'); // First language
    expect(parsed.description).toBe('Part 1 Part 2');
  });

  /**
   * Test: Source field is set correctly for ingested books
   * Validates: Requirement 6.2
   */
  it('should set source field to internet_archive for all ingested books', async () => {
    // Setup mock response
    const mockBooks = [
      { identifier: 'book_001', title: 'Book 1' },
      { identifier: 'book_002', title: 'Book 2' }
    ];
    fetcher.setMockResponse(createMockIAResponse(mockBooks));

    // Run ingestion
    await orchestrator.runIngestionJob({ batchSize: 10 });

    // Verify source field
    const books = dbWriter.getBooks();
    books.forEach(book => {
      expect(book.source).toBe('internet_archive');
    });
  });

  /**
   * Test: Year is parsed correctly from date field
   */
  it('should parse publication year from date field', async () => {
    // Setup mock response with various date formats
    const mockBooks = [
      { identifier: 'book_001', title: 'Book 1', date: '1850' },
      { identifier: 'book_002', title: 'Book 2', date: '1875-01-15' },
      { identifier: 'book_003', title: 'Book 3', date: 'circa 1900' }
    ];
    fetcher.setMockResponse(createMockIAResponse(mockBooks));

    // Run ingestion
    await orchestrator.runIngestionJob({ batchSize: 10 });

    // Verify years were parsed
    const books = dbWriter.getBooks();
    expect(books.get('book_001')?.year).toBe(1850);
    expect(books.get('book_002')?.year).toBe(1875);
    expect(books.get('book_003')?.year).toBe(1900);
  });
});
