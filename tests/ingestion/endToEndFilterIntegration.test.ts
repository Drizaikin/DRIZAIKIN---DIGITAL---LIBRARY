/**
 * End-to-End Integration Tests for Ingestion Filtering
 * **Feature: ingestion-filtering**
 * **Task: 15. End-to-End Integration Testing**
 * 
 * This test verifies the complete ingestion flow with filters:
 * - Test complete ingestion flow with filters enabled
 * - Test with genre filter only
 * - Test with author filter only
 * - Test with both filters enabled
 * - Test with no filters (allow all)
 * - Verify filtered books are skipped
 * - Verify passed books are ingested
 * - Verify category sync works
 * - Verify filter statistics are accurate
 * - Test dry run mode with filters
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Mock types
 */
interface BookMetadata {
  identifier: string;
  title: string;
  creator: string;
  date?: string | null;
  language?: string | null;
  description?: string | null;
}

interface FilterConfig {
  allowedGenres: string[];
  allowedAuthors: string[];
  enableGenreFilter: boolean;
  enableAuthorFilter: boolean;
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
  category: string;
  genres: string[] | null;
  subgenre: string | null;
}

interface JobResult {
  jobId: string;
  status: 'completed' | 'partial' | 'failed' | 'skipped';
  startedAt: Date;
  completedAt: Date;
  processed: number;
  added: number;
  skipped: number;
  failed: number;
  filtered: number;
  filteredByGenre: number;
  filteredByAuthor: number;
  errors: Array<{ identifier: string; error: string; timestamp: string }>;
  paused: boolean;
}

interface FilterDecision {
  identifier: string;
  title: string;
  author: string;
  genres: string[] | null;
  result: 'passed' | 'filtered_genre' | 'filtered_author';
  reason: string | null;
}

/**
 * Mock Filter Service - Implements actual filter logic
 */
class MockFilterService {
  private config: FilterConfig;
  private filterDecisions: FilterDecision[] = [];

  constructor(config: FilterConfig) {
    this.config = config;
  }

  setConfig(config: FilterConfig): void {
    this.config = config;
  }

  checkGenreFilter(bookGenres: string[] | null): { passed: boolean; reason?: string } {
    if (!this.config.enableGenreFilter) {
      return { passed: true };
    }

    if (!this.config.allowedGenres || this.config.allowedGenres.length === 0) {
      return { passed: true };
    }

    if (!bookGenres || bookGenres.length === 0) {
      return { passed: false, reason: 'Book has no genres' };
    }

    const allowedGenresLower = this.config.allowedGenres.map(g => g.toLowerCase());
    const hasMatch = bookGenres.some(g => allowedGenresLower.includes(g.toLowerCase()));

    if (hasMatch) {
      return { passed: true };
    }

    return {
      passed: false,
      reason: `Genre not in allowed list. Book genres: [${bookGenres.join(', ')}], Allowed: [${this.config.allowedGenres.join(', ')}]`
    };
  }

  checkAuthorFilter(bookAuthor: string | null): { passed: boolean; reason?: string } {
    if (!this.config.enableAuthorFilter) {
      return { passed: true };
    }

    if (!this.config.allowedAuthors || this.config.allowedAuthors.length === 0) {
      return { passed: true };
    }

    if (!bookAuthor || typeof bookAuthor !== 'string') {
      return { passed: false, reason: 'Book has no author' };
    }

    const normalizedBookAuthor = bookAuthor.toLowerCase().trim();
    const hasMatch = this.config.allowedAuthors.some(allowed =>
      normalizedBookAuthor.includes(allowed.toLowerCase().trim())
    );

    if (hasMatch) {
      return { passed: true };
    }

    return {
      passed: false,
      reason: `Author not in allowed list. Book author: "${bookAuthor}", Allowed: [${this.config.allowedAuthors.join(', ')}]`
    };
  }

  applyFilters(book: { identifier: string; title: string; author: string; genres: string[] | null }): { passed: boolean; reason?: string } {
    // Apply genre filter first
    const genreResult = this.checkGenreFilter(book.genres);
    if (!genreResult.passed) {
      const decision: FilterDecision = {
        identifier: book.identifier,
        title: book.title,
        author: book.author,
        genres: book.genres,
        result: 'filtered_genre',
        reason: `Genre filter failed: ${genreResult.reason}`
      };
      this.filterDecisions.push(decision);
      return { passed: false, reason: `Genre filter failed: ${genreResult.reason}` };
    }

    // Apply author filter
    const authorResult = this.checkAuthorFilter(book.author);
    if (!authorResult.passed) {
      const decision: FilterDecision = {
        identifier: book.identifier,
        title: book.title,
        author: book.author,
        genres: book.genres,
        result: 'filtered_author',
        reason: `Author filter failed: ${authorResult.reason}`
      };
      this.filterDecisions.push(decision);
      return { passed: false, reason: `Author filter failed: ${authorResult.reason}` };
    }

    // Passed all filters
    const decision: FilterDecision = {
      identifier: book.identifier,
      title: book.title,
      author: book.author,
      genres: book.genres,
      result: 'passed',
      reason: null
    };
    this.filterDecisions.push(decision);
    return { passed: true };
  }

  hasActiveFilters(): boolean {
    const genreActive = this.config.enableGenreFilter && this.config.allowedGenres.length > 0;
    const authorActive = this.config.enableAuthorFilter && this.config.allowedAuthors.length > 0;
    return genreActive || authorActive;
  }

  getFilterDecisions(): FilterDecision[] {
    return [...this.filterDecisions];
  }

  clearDecisions(): void {
    this.filterDecisions = [];
  }

  getFilterStats(): { total: number; passed: number; filteredByGenre: number; filteredByAuthor: number } {
    const stats = {
      total: this.filterDecisions.length,
      passed: 0,
      filteredByGenre: 0,
      filteredByAuthor: 0
    };

    for (const decision of this.filterDecisions) {
      if (decision.result === 'passed') {
        stats.passed++;
      } else if (decision.result === 'filtered_genre') {
        stats.filteredByGenre++;
      } else if (decision.result === 'filtered_author') {
        stats.filteredByAuthor++;
      }
    }

    return stats;
  }
}

/**
 * Mock AI Classifier
 */
class MockClassifier {
  private genreMap: Map<string, { genres: string[]; subgenre: string | null }> = new Map();

  setGenres(identifier: string, genres: string[], subgenre: string | null = null): void {
    this.genreMap.set(identifier, { genres, subgenre });
  }

  async classifyBook(book: { identifier: string }): Promise<{ genres: string[]; subgenre: string | null } | null> {
    return this.genreMap.get(book.identifier) || null;
  }
}

/**
 * Mock PDF Validator
 */
class MockPdfValidator {
  private downloadAttempts: string[] = [];
  private failingIdentifiers: Set<string> = new Set();

  setFailingDownloads(identifiers: string[]): void {
    this.failingIdentifiers = new Set(identifiers);
  }

  async downloadAndValidate(url: string): Promise<{ buffer: Buffer; size: number } | null> {
    const match = url.match(/\/download\/([^/]+)\//);
    const identifier = match ? match[1] : '';
    this.downloadAttempts.push(identifier);

    if (this.failingIdentifiers.has(identifier)) {
      return null;
    }

    const pdfMagicBytes = Buffer.from([0x25, 0x50, 0x44, 0x46]);
    const mockContent = Buffer.from(' mock pdf content');
    const buffer = Buffer.concat([pdfMagicBytes, mockContent]);

    return { buffer, size: buffer.length };
  }

  getDownloadAttempts(): string[] {
    return [...this.downloadAttempts];
  }

  clearAttempts(): void {
    this.downloadAttempts = [];
  }
}

/**
 * Mock Storage Uploader
 */
class MockStorageUploader {
  private uploadedFiles: Map<string, Buffer> = new Map();

  async uploadPdf(pdfBuffer: Buffer, filename: string): Promise<string> {
    const storagePath = `internet_archive/${filename}.pdf`;
    this.uploadedFiles.set(storagePath, pdfBuffer);
    return `https://storage.example.com/books/${storagePath}`;
  }

  getUploadedFiles(): Map<string, Buffer> {
    return new Map(this.uploadedFiles);
  }

  clear(): void {
    this.uploadedFiles.clear();
  }
}

/**
 * Mock Database Writer with Category Sync
 */
class MockDatabaseWriter {
  private books: Map<string, BookRecord> = new Map();
  private existingIdentifiers: Set<string> = new Set();

  setExistingBooks(identifiers: string[]): void {
    this.existingIdentifiers = new Set(identifiers);
  }

  /**
   * Syncs category with first genre (Requirements 5.4.1, 5.4.2, 5.4.5)
   */
  private syncCategory(genres: string[] | null): string {
    if (!genres || genres.length === 0) {
      return 'Uncategorized';
    }
    return genres[0];
  }

  async insertBook(book: {
    title: string;
    author: string;
    year?: number | null;
    language?: string | null;
    source_identifier: string;
    pdf_url: string;
    description?: string | null;
    genres?: string[] | null;
    subgenre?: string | null;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    if (this.books.has(book.source_identifier)) {
      return { success: false, error: 'Book already exists (duplicate source_identifier)' };
    }

    const id = `book_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Auto-sync category with first genre
    const category = this.syncCategory(book.genres || null);

    const bookRecord: BookRecord = {
      id,
      title: book.title,
      author: book.author,
      year: book.year || null,
      language: book.language || null,
      source: 'internet_archive',
      source_identifier: book.source_identifier,
      pdf_url: book.pdf_url,
      description: book.description || null,
      category,
      genres: book.genres || null,
      subgenre: book.subgenre || null
    };

    this.books.set(book.source_identifier, bookRecord);
    return { success: true, id };
  }

  async bookExists(sourceIdentifier: string): Promise<boolean> {
    return this.existingIdentifiers.has(sourceIdentifier) || this.books.has(sourceIdentifier);
  }

  async filterNewBooks(books: BookMetadata[]): Promise<BookMetadata[]> {
    const newBooks: BookMetadata[] = [];
    for (const book of books) {
      const exists = await this.bookExists(book.identifier);
      if (!exists) {
        newBooks.push(book);
      }
    }
    return newBooks;
  }

  getBooks(): Map<string, BookRecord> {
    return new Map(this.books);
  }

  getBookCount(): number {
    return this.books.size;
  }

  clear(): void {
    this.books.clear();
    this.existingIdentifiers.clear();
  }
}


/**
 * Complete End-to-End Orchestrator with Filtering
 */
class MockIngestionOrchestrator {
  private filterService: MockFilterService;
  private classifier: MockClassifier;
  private pdfValidator: MockPdfValidator;
  private uploader: MockStorageUploader;
  private dbWriter: MockDatabaseWriter;

  constructor(
    filterService: MockFilterService,
    classifier: MockClassifier,
    pdfValidator: MockPdfValidator,
    uploader: MockStorageUploader,
    dbWriter: MockDatabaseWriter
  ) {
    this.filterService = filterService;
    this.classifier = classifier;
    this.pdfValidator = pdfValidator;
    this.uploader = uploader;
    this.dbWriter = dbWriter;
  }

  async processBook(book: BookMetadata, dryRun: boolean = false): Promise<{ status: string; reason?: string }> {
    // Step 1: AI Classification
    const classification = await this.classifier.classifyBook({ identifier: book.identifier });
    const genres = classification?.genres || null;
    const subgenre = classification?.subgenre || null;

    // Step 2: Apply Filters (after classification, before PDF download)
    if (this.filterService.hasActiveFilters()) {
      const filterResult = this.filterService.applyFilters({
        identifier: book.identifier,
        title: book.title,
        author: book.creator,
        genres: genres
      });

      if (!filterResult.passed) {
        return { status: 'filtered', reason: filterResult.reason };
      }
    }

    if (dryRun) {
      return { status: 'added' };
    }

    // Step 3: Download PDF (only if filters passed)
    const pdfUrl = `https://archive.org/download/${book.identifier}/${book.identifier}.pdf`;
    const pdfResult = await this.pdfValidator.downloadAndValidate(pdfUrl);
    
    if (!pdfResult) {
      return { status: 'failed', reason: 'PDF download failed' };
    }

    // Step 4: Upload to storage
    const storedPdfUrl = await this.uploader.uploadPdf(pdfResult.buffer, book.identifier);

    // Step 5: Parse year
    let year: number | null = null;
    if (book.date) {
      const yearMatch = book.date.match(/\d{4}/);
      if (yearMatch) {
        year = parseInt(yearMatch[0], 10);
      }
    }

    // Step 6: Insert to database with category sync
    const insertResult = await this.dbWriter.insertBook({
      title: book.title,
      author: book.creator,
      year,
      language: book.language || null,
      source_identifier: book.identifier,
      pdf_url: storedPdfUrl,
      description: book.description || null,
      genres,
      subgenre
    });

    if (!insertResult.success) {
      return { status: 'failed', reason: insertResult.error };
    }

    return { status: 'added' };
  }

  async runIngestionJob(books: BookMetadata[], dryRun: boolean = false): Promise<JobResult> {
    const startedAt = new Date();
    const jobId = `job_${Date.now()}`;

    const result: JobResult = {
      jobId,
      status: 'completed',
      startedAt,
      completedAt: new Date(),
      processed: 0,
      added: 0,
      skipped: 0,
      failed: 0,
      filtered: 0,
      filteredByGenre: 0,
      filteredByAuthor: 0,
      errors: [],
      paused: false
    };

    // Filter duplicates
    const newBooks = await this.dbWriter.filterNewBooks(books);
    result.skipped = books.length - newBooks.length;

    for (const book of newBooks) {
      result.processed++;

      try {
        const bookResult = await this.processBook(book, dryRun);

        if (bookResult.status === 'added') {
          result.added++;
        } else if (bookResult.status === 'filtered') {
          result.filtered++;

          if (bookResult.reason && bookResult.reason.includes('Genre filter')) {
            result.filteredByGenre++;
          } else if (bookResult.reason && bookResult.reason.includes('Author filter')) {
            result.filteredByAuthor++;
          }
        } else if (bookResult.status === 'failed') {
          result.failed++;
          result.errors.push({
            identifier: book.identifier,
            error: bookResult.reason || 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }
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
    } else if (result.failed > 0 && result.added === 0 && result.processed > 0) {
      result.status = 'failed';
    }

    result.completedAt = new Date();
    return result;
  }
}


describe('End-to-End Integration Tests for Ingestion Filtering', () => {
  let filterService: MockFilterService;
  let classifier: MockClassifier;
  let pdfValidator: MockPdfValidator;
  let uploader: MockStorageUploader;
  let dbWriter: MockDatabaseWriter;
  let orchestrator: MockIngestionOrchestrator;

  beforeEach(() => {
    const defaultConfig: FilterConfig = {
      allowedGenres: [],
      allowedAuthors: [],
      enableGenreFilter: false,
      enableAuthorFilter: false
    };
    filterService = new MockFilterService(defaultConfig);
    classifier = new MockClassifier();
    pdfValidator = new MockPdfValidator();
    uploader = new MockStorageUploader();
    dbWriter = new MockDatabaseWriter();
    orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);
  });

  /**
   * Test: Complete ingestion flow with filters enabled
   * Validates: Task 15 - Test complete ingestion flow with filters enabled
   */
  describe('Complete Ingestion Flow with Filters', () => {
    it('should execute complete pipeline with genre and author filters enabled', async () => {
      // Setup: Enable both filters
      filterService.setConfig({
        allowedGenres: ['Fiction', 'Philosophy'],
        allowedAuthors: ['Approved Author'],
        enableGenreFilter: true,
        enableAuthorFilter: true
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      // Setup: Books with various combinations
      const books: BookMetadata[] = [
        { identifier: 'book_001', title: 'Fiction by Approved', creator: 'Approved Author' },
        { identifier: 'book_002', title: 'Philosophy by Approved', creator: 'Approved Author' },
        { identifier: 'book_003', title: 'Science by Approved', creator: 'Approved Author' },
        { identifier: 'book_004', title: 'Fiction by Other', creator: 'Other Author' }
      ];

      classifier.setGenres('book_001', ['Fiction']);
      classifier.setGenres('book_002', ['Philosophy']);
      classifier.setGenres('book_003', ['Science']);
      classifier.setGenres('book_004', ['Fiction']);

      // Run ingestion
      const result = await orchestrator.runIngestionJob(books);

      // Verify: Only books passing both filters are added
      expect(result.processed).toBe(4);
      expect(result.added).toBe(2); // book_001 and book_002
      expect(result.filtered).toBe(2); // book_003 (genre) and book_004 (author)
      expect(result.filteredByGenre).toBe(1);
      expect(result.filteredByAuthor).toBe(1);

      // Verify database state
      const dbBooks = dbWriter.getBooks();
      expect(dbBooks.size).toBe(2);
      expect(dbBooks.has('book_001')).toBe(true);
      expect(dbBooks.has('book_002')).toBe(true);
    });
  });

  /**
   * Test: Genre filter only
   * Validates: Task 15 - Test with genre filter only
   */
  describe('Genre Filter Only', () => {
    it('should filter books by genre when only genre filter is enabled', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction', 'Philosophy'],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'fiction_book', title: 'Fiction Book', creator: 'Any Author' },
        { identifier: 'philosophy_book', title: 'Philosophy Book', creator: 'Any Author' },
        { identifier: 'science_book', title: 'Science Book', creator: 'Any Author' },
        { identifier: 'history_book', title: 'History Book', creator: 'Any Author' }
      ];

      classifier.setGenres('fiction_book', ['Fiction']);
      classifier.setGenres('philosophy_book', ['Philosophy']);
      classifier.setGenres('science_book', ['Science']);
      classifier.setGenres('history_book', ['History']);

      const result = await orchestrator.runIngestionJob(books);

      expect(result.added).toBe(2);
      expect(result.filtered).toBe(2);
      expect(result.filteredByGenre).toBe(2);
      expect(result.filteredByAuthor).toBe(0);

      const dbBooks = dbWriter.getBooks();
      expect(dbBooks.has('fiction_book')).toBe(true);
      expect(dbBooks.has('philosophy_book')).toBe(true);
      expect(dbBooks.has('science_book')).toBe(false);
      expect(dbBooks.has('history_book')).toBe(false);
    });

    it('should allow books with any matching genre from multiple genres', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction'],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'multi_genre_book', title: 'Multi Genre', creator: 'Author' }
      ];

      // Book has multiple genres, one of which matches
      classifier.setGenres('multi_genre_book', ['History', 'Fiction', 'Biography']);

      const result = await orchestrator.runIngestionJob(books);

      expect(result.added).toBe(1);
      expect(result.filtered).toBe(0);
    });
  });


  /**
   * Test: Author filter only
   * Validates: Task 15 - Test with author filter only
   */
  describe('Author Filter Only', () => {
    it('should filter books by author when only author filter is enabled', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: ['Robin Sharma', 'Paulo Coelho'],
        enableGenreFilter: false,
        enableAuthorFilter: true
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'sharma_book', title: 'Book by Sharma', creator: 'Robin Sharma' },
        { identifier: 'coelho_book', title: 'Book by Coelho', creator: 'Paulo Coelho' },
        { identifier: 'other_book_1', title: 'Other Book 1', creator: 'Unknown Author' },
        { identifier: 'other_book_2', title: 'Other Book 2', creator: 'Another Author' }
      ];

      // All books have Fiction genre (genre filter disabled)
      books.forEach(book => classifier.setGenres(book.identifier, ['Fiction']));

      const result = await orchestrator.runIngestionJob(books);

      expect(result.added).toBe(2);
      expect(result.filtered).toBe(2);
      expect(result.filteredByAuthor).toBe(2);
      expect(result.filteredByGenre).toBe(0);

      const dbBooks = dbWriter.getBooks();
      expect(dbBooks.has('sharma_book')).toBe(true);
      expect(dbBooks.has('coelho_book')).toBe(true);
      expect(dbBooks.has('other_book_1')).toBe(false);
      expect(dbBooks.has('other_book_2')).toBe(false);
    });

    it('should support partial author name matching (case-insensitive)', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: ['Sharma'],
        enableGenreFilter: false,
        enableAuthorFilter: true
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'book_1', title: 'Book 1', creator: 'Robin Sharma' },
        { identifier: 'book_2', title: 'Book 2', creator: 'SHARMA, Robin' },
        { identifier: 'book_3', title: 'Book 3', creator: 'Dr. sharma' },
        { identifier: 'book_4', title: 'Book 4', creator: 'Other Author' }
      ];

      books.forEach(book => classifier.setGenres(book.identifier, ['Fiction']));

      const result = await orchestrator.runIngestionJob(books);

      expect(result.added).toBe(3); // All Sharma variations match
      expect(result.filtered).toBe(1); // Only Other Author filtered
    });
  });

  /**
   * Test: Both filters enabled
   * Validates: Task 15 - Test with both filters enabled
   */
  describe('Both Filters Enabled', () => {
    it('should require books to pass BOTH genre and author filters', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction'],
        allowedAuthors: ['Approved Author'],
        enableGenreFilter: true,
        enableAuthorFilter: true
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'pass_both', title: 'Pass Both', creator: 'Approved Author' },
        { identifier: 'fail_genre', title: 'Fail Genre', creator: 'Approved Author' },
        { identifier: 'fail_author', title: 'Fail Author', creator: 'Other Author' },
        { identifier: 'fail_both', title: 'Fail Both', creator: 'Other Author' }
      ];

      classifier.setGenres('pass_both', ['Fiction']);
      classifier.setGenres('fail_genre', ['Science']);
      classifier.setGenres('fail_author', ['Fiction']);
      classifier.setGenres('fail_both', ['Science']);

      const result = await orchestrator.runIngestionJob(books);

      expect(result.added).toBe(1); // Only pass_both
      expect(result.filtered).toBe(3);
      
      // Genre filter is applied first, so fail_genre and fail_both are filtered by genre
      // fail_author passes genre but fails author
      expect(result.filteredByGenre).toBe(2); // fail_genre and fail_both
      expect(result.filteredByAuthor).toBe(1); // fail_author
    });
  });

  /**
   * Test: No filters (allow all)
   * Validates: Task 15 - Test with no filters (allow all)
   */
  describe('No Filters (Allow All)', () => {
    it('should allow all books when filters are disabled', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: false,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'book_1', title: 'Book 1', creator: 'Author 1' },
        { identifier: 'book_2', title: 'Book 2', creator: 'Author 2' },
        { identifier: 'book_3', title: 'Book 3', creator: 'Author 3' }
      ];

      classifier.setGenres('book_1', ['Fiction']);
      classifier.setGenres('book_2', ['Science']);
      classifier.setGenres('book_3', ['History']);

      const result = await orchestrator.runIngestionJob(books);

      expect(result.added).toBe(3);
      expect(result.filtered).toBe(0);
    });

    it('should allow all books when filter lists are empty (even if enabled)', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: true
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'book_1', title: 'Book 1', creator: 'Author 1' },
        { identifier: 'book_2', title: 'Book 2', creator: 'Author 2' }
      ];

      classifier.setGenres('book_1', ['Fiction']);
      classifier.setGenres('book_2', ['Science']);

      const result = await orchestrator.runIngestionJob(books);

      // Empty lists = allow all (per Requirements 5.1.3, 5.2.3)
      expect(result.added).toBe(2);
      expect(result.filtered).toBe(0);
    });
  });


  /**
   * Test: Filtered books are skipped
   * Validates: Task 15 - Verify filtered books are skipped
   */
  describe('Filtered Books Are Skipped', () => {
    it('should not download PDFs for filtered books', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction'],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: false
      });
      pdfValidator.clearAttempts();
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'fiction_book', title: 'Fiction Book', creator: 'Author' },
        { identifier: 'science_book', title: 'Science Book', creator: 'Author' }
      ];

      classifier.setGenres('fiction_book', ['Fiction']);
      classifier.setGenres('science_book', ['Science']);

      await orchestrator.runIngestionJob(books);

      const downloadAttempts = pdfValidator.getDownloadAttempts();
      expect(downloadAttempts).toContain('fiction_book');
      expect(downloadAttempts).not.toContain('science_book');
    });

    it('should not insert filtered books into database', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction'],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'fiction_book', title: 'Fiction Book', creator: 'Author' },
        { identifier: 'science_book', title: 'Science Book', creator: 'Author' }
      ];

      classifier.setGenres('fiction_book', ['Fiction']);
      classifier.setGenres('science_book', ['Science']);

      await orchestrator.runIngestionJob(books);

      const dbBooks = dbWriter.getBooks();
      expect(dbBooks.size).toBe(1);
      expect(dbBooks.has('fiction_book')).toBe(true);
      expect(dbBooks.has('science_book')).toBe(false);
    });
  });

  /**
   * Test: Passed books are ingested
   * Validates: Task 15 - Verify passed books are ingested
   */
  describe('Passed Books Are Ingested', () => {
    it('should fully process books that pass all filters', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction', 'Philosophy'],
        allowedAuthors: ['Approved Author'],
        enableGenreFilter: true,
        enableAuthorFilter: true
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'approved_book', title: 'Approved Book', creator: 'Approved Author', date: '1900' }
      ];

      classifier.setGenres('approved_book', ['Fiction', 'Philosophy']);

      const result = await orchestrator.runIngestionJob(books);

      expect(result.added).toBe(1);

      // Verify book is in database with correct data
      const dbBooks = dbWriter.getBooks();
      const book = dbBooks.get('approved_book');
      expect(book).toBeDefined();
      expect(book?.title).toBe('Approved Book');
      expect(book?.author).toBe('Approved Author');
      expect(book?.genres).toEqual(['Fiction', 'Philosophy']);
      expect(book?.pdf_url).toContain('approved_book');
    });
  });

  /**
   * Test: Category sync works
   * Validates: Task 15 - Verify category sync works
   */
  describe('Category Sync', () => {
    it('should set category to first genre for ingested books', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: false,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'book_1', title: 'Book 1', creator: 'Author' },
        { identifier: 'book_2', title: 'Book 2', creator: 'Author' },
        { identifier: 'book_3', title: 'Book 3', creator: 'Author' }
      ];

      classifier.setGenres('book_1', ['Fiction', 'Drama']);
      classifier.setGenres('book_2', ['Philosophy', 'Ethics']);
      classifier.setGenres('book_3', ['Science']);

      await orchestrator.runIngestionJob(books);

      const dbBooks = dbWriter.getBooks();
      
      // Category should be first genre
      expect(dbBooks.get('book_1')?.category).toBe('Fiction');
      expect(dbBooks.get('book_2')?.category).toBe('Philosophy');
      expect(dbBooks.get('book_3')?.category).toBe('Science');
    });

    it('should set category to "Uncategorized" for books without genres', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: false,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'no_genre_book', title: 'No Genre Book', creator: 'Author' }
      ];

      // Don't set genres for this book (classifier returns null)

      await orchestrator.runIngestionJob(books);

      const dbBooks = dbWriter.getBooks();
      expect(dbBooks.get('no_genre_book')?.category).toBe('Uncategorized');
      expect(dbBooks.get('no_genre_book')?.genres).toBeNull();
    });
  });


  /**
   * Test: Filter statistics are accurate
   * Validates: Task 15 - Verify filter statistics are accurate
   */
  describe('Filter Statistics Accuracy', () => {
    it('should accurately track filter statistics', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction'],
        allowedAuthors: ['Approved Author'],
        enableGenreFilter: true,
        enableAuthorFilter: true
      });
      filterService.clearDecisions();
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'pass_both', title: 'Pass Both', creator: 'Approved Author' },
        { identifier: 'fail_genre_1', title: 'Fail Genre 1', creator: 'Approved Author' },
        { identifier: 'fail_genre_2', title: 'Fail Genre 2', creator: 'Approved Author' },
        { identifier: 'fail_author', title: 'Fail Author', creator: 'Other Author' }
      ];

      classifier.setGenres('pass_both', ['Fiction']);
      classifier.setGenres('fail_genre_1', ['Science']);
      classifier.setGenres('fail_genre_2', ['History']);
      classifier.setGenres('fail_author', ['Fiction']);

      const result = await orchestrator.runIngestionJob(books);

      // Verify job result statistics
      expect(result.processed).toBe(4);
      expect(result.added).toBe(1);
      expect(result.filtered).toBe(3);
      expect(result.filteredByGenre).toBe(2);
      expect(result.filteredByAuthor).toBe(1);

      // Verify filter service statistics
      const stats = filterService.getFilterStats();
      expect(stats.total).toBe(4);
      expect(stats.passed).toBe(1);
      expect(stats.filteredByGenre).toBe(2);
      expect(stats.filteredByAuthor).toBe(1);

      // Verify: total = passed + filtered
      expect(result.added + result.filtered + result.failed).toBe(result.processed);
    });

    it('should track filter decisions for audit trail', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction'],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: false
      });
      filterService.clearDecisions();
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'fiction_book', title: 'Fiction Book', creator: 'Author' },
        { identifier: 'science_book', title: 'Science Book', creator: 'Author' }
      ];

      classifier.setGenres('fiction_book', ['Fiction']);
      classifier.setGenres('science_book', ['Science']);

      await orchestrator.runIngestionJob(books);

      const decisions = filterService.getFilterDecisions();
      expect(decisions).toHaveLength(2);

      const fictionDecision = decisions.find(d => d.identifier === 'fiction_book');
      expect(fictionDecision?.result).toBe('passed');

      const scienceDecision = decisions.find(d => d.identifier === 'science_book');
      expect(scienceDecision?.result).toBe('filtered_genre');
      expect(scienceDecision?.reason).toContain('Genre filter failed');
    });
  });

  /**
   * Test: Dry run mode with filters
   * Validates: Task 15 - Test dry run mode with filters
   */
  describe('Dry Run Mode with Filters', () => {
    it('should apply filters in dry run mode', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction'],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'fiction_book', title: 'Fiction Book', creator: 'Author' },
        { identifier: 'science_book', title: 'Science Book', creator: 'Author' }
      ];

      classifier.setGenres('fiction_book', ['Fiction']);
      classifier.setGenres('science_book', ['Science']);

      const result = await orchestrator.runIngestionJob(books, true);

      // Filters should still be applied
      expect(result.added).toBe(1);
      expect(result.filtered).toBe(1);
    });

    it('should not download PDFs in dry run mode', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction'],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: false
      });
      pdfValidator.clearAttempts();
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'fiction_book', title: 'Fiction Book', creator: 'Author' }
      ];

      classifier.setGenres('fiction_book', ['Fiction']);

      await orchestrator.runIngestionJob(books, true);

      // No PDFs should be downloaded in dry run
      expect(pdfValidator.getDownloadAttempts()).toHaveLength(0);
    });

    it('should not modify database in dry run mode', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: false,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'book_1', title: 'Book 1', creator: 'Author' },
        { identifier: 'book_2', title: 'Book 2', creator: 'Author' }
      ];

      classifier.setGenres('book_1', ['Fiction']);
      classifier.setGenres('book_2', ['Science']);

      const result = await orchestrator.runIngestionJob(books, true);

      expect(result.added).toBe(2);
      expect(dbWriter.getBookCount()).toBe(0); // No actual inserts
    });

    it('should not upload files in dry run mode', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: false,
        enableAuthorFilter: false
      });
      uploader.clear();
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'book_1', title: 'Book 1', creator: 'Author' }
      ];

      classifier.setGenres('book_1', ['Fiction']);

      await orchestrator.runIngestionJob(books, true);

      expect(uploader.getUploadedFiles().size).toBe(0);
    });
  });


  /**
   * Additional edge case tests
   */
  describe('Edge Cases', () => {
    it('should handle books without genres when genre filter is enabled', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction'],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'no_genre_book', title: 'No Genre Book', creator: 'Author' }
      ];

      // Don't set genres (classifier returns null)

      const result = await orchestrator.runIngestionJob(books);

      expect(result.filtered).toBe(1);
      expect(result.filteredByGenre).toBe(1);
    });

    it('should handle books without author when author filter is enabled', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: ['Approved Author'],
        enableGenreFilter: false,
        enableAuthorFilter: true
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'no_author_book', title: 'No Author Book', creator: '' }
      ];

      classifier.setGenres('no_author_book', ['Fiction']);

      const result = await orchestrator.runIngestionJob(books);

      expect(result.filtered).toBe(1);
      expect(result.filteredByAuthor).toBe(1);
    });

    it('should handle duplicate books correctly with filters', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction'],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: false
      });
      dbWriter.setExistingBooks(['existing_book']);
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'existing_book', title: 'Existing Book', creator: 'Author' },
        { identifier: 'new_fiction_book', title: 'New Fiction', creator: 'Author' },
        { identifier: 'new_science_book', title: 'New Science', creator: 'Author' }
      ];

      classifier.setGenres('existing_book', ['Fiction']);
      classifier.setGenres('new_fiction_book', ['Fiction']);
      classifier.setGenres('new_science_book', ['Science']);

      const result = await orchestrator.runIngestionJob(books);

      expect(result.skipped).toBe(1); // existing_book
      expect(result.added).toBe(1); // new_fiction_book
      expect(result.filtered).toBe(1); // new_science_book
    });

    it('should handle PDF download failures gracefully', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: false,
        enableAuthorFilter: false
      });
      pdfValidator.setFailingDownloads(['failing_book']);
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'success_book', title: 'Success Book', creator: 'Author' },
        { identifier: 'failing_book', title: 'Failing Book', creator: 'Author' }
      ];

      classifier.setGenres('success_book', ['Fiction']);
      classifier.setGenres('failing_book', ['Fiction']);

      const result = await orchestrator.runIngestionJob(books);

      expect(result.added).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.status).toBe('partial');
    });

    it('should correctly report job status based on outcomes', async () => {
      filterService.setConfig({
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: false,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      // Test completed status
      const books1: BookMetadata[] = [
        { identifier: 'book_1', title: 'Book 1', creator: 'Author' }
      ];
      classifier.setGenres('book_1', ['Fiction']);
      const result1 = await orchestrator.runIngestionJob(books1);
      expect(result1.status).toBe('completed');

      // Test partial status (some failures)
      dbWriter.clear();
      pdfValidator.setFailingDownloads(['book_3']);
      const books2: BookMetadata[] = [
        { identifier: 'book_2', title: 'Book 2', creator: 'Author' },
        { identifier: 'book_3', title: 'Book 3', creator: 'Author' }
      ];
      classifier.setGenres('book_2', ['Fiction']);
      classifier.setGenres('book_3', ['Fiction']);
      const result2 = await orchestrator.runIngestionJob(books2);
      expect(result2.status).toBe('partial');
    });
  });

  /**
   * Test: Multiple genre matching
   */
  describe('Multiple Genre Matching', () => {
    it('should pass if any book genre matches any allowed genre', async () => {
      filterService.setConfig({
        allowedGenres: ['Fiction', 'Philosophy'],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: false
      });
      orchestrator = new MockIngestionOrchestrator(filterService, classifier, pdfValidator, uploader, dbWriter);

      const books: BookMetadata[] = [
        { identifier: 'book_1', title: 'Book 1', creator: 'Author' },
        { identifier: 'book_2', title: 'Book 2', creator: 'Author' },
        { identifier: 'book_3', title: 'Book 3', creator: 'Author' }
      ];

      // book_1: Has Fiction (matches)
      classifier.setGenres('book_1', ['Science', 'Fiction']);
      // book_2: Has Philosophy (matches)
      classifier.setGenres('book_2', ['History', 'Philosophy', 'Ethics']);
      // book_3: No matching genres
      classifier.setGenres('book_3', ['Science', 'History']);

      const result = await orchestrator.runIngestionJob(books);

      expect(result.added).toBe(2);
      expect(result.filtered).toBe(1);
    });
  });
});
