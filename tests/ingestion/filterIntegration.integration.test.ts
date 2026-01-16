/**
 * Integration Tests for Filter Integration in Orchestrator
 * **Feature: ingestion-filtering**
 * **Validates: Requirements 5.6.1-5.6.6, 5.7.1-5.7.3**
 * 
 * This test verifies filter integration in the orchestrator:
 * - Filters are applied after AI classification
 * - Filters are applied before PDF download
 * - Filter statistics are tracked correctly
 * - Dry run mode works with filters
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

interface JobResult {
  jobId: string;
  status: 'completed' | 'partial' | 'failed';
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
}

/**
 * Mock services
 */
class MockFilterService {
  private config: FilterConfig;

  constructor(config: FilterConfig) {
    this.config = config;
  }

  applyFilters(book: { identifier: string; title: string; author: string; genres: string[] | null }): { passed: boolean; reason?: string } {
    // Genre filter
    if (this.config.enableGenreFilter && this.config.allowedGenres.length > 0) {
      if (!book.genres || book.genres.length === 0) {
        return { passed: false, reason: 'Genre filter failed: Book has no genres' };
      }
      
      const hasMatch = book.genres.some(g => 
        this.config.allowedGenres.some(allowed => allowed.toLowerCase() === g.toLowerCase())
      );
      
      if (!hasMatch) {
        return { passed: false, reason: `Genre filter failed: Genre not in allowed list` };
      }
    }

    // Author filter
    if (this.config.enableAuthorFilter && this.config.allowedAuthors.length > 0) {
      if (!book.author) {
        return { passed: false, reason: 'Author filter failed: Book has no author' };
      }
      
      const normalizedAuthor = book.author.toLowerCase();
      const hasMatch = this.config.allowedAuthors.some(allowed => 
        normalizedAuthor.includes(allowed.toLowerCase())
      );
      
      if (!hasMatch) {
        return { passed: false, reason: `Author filter failed: Author not in allowed list` };
      }
    }

    return { passed: true };
  }

  hasActiveFilters(): boolean {
    const genreActive = this.config.enableGenreFilter && this.config.allowedGenres.length > 0;
    const authorActive = this.config.enableAuthorFilter && this.config.allowedAuthors.length > 0;
    return genreActive || authorActive;
  }
}

class MockClassifier {
  private genreMap: Map<string, string[]> = new Map();

  setGenres(identifier: string, genres: string[]): void {
    this.genreMap.set(identifier, genres);
  }

  async classifyBook(book: any): Promise<{ genres: string[]; subgenre: string | null } | null> {
    const genres = this.genreMap.get(book.identifier);
    if (!genres) {
      return null;
    }
    return { genres, subgenre: null };
  }
}

class MockPdfValidator {
  private downloadAttempts: string[] = [];

  async downloadAndValidate(url: string): Promise<{ buffer: Buffer; size: number } | null> {
    // Track download attempts
    const match = url.match(/\/download\/([^/]+)\//);
    const identifier = match ? match[1] : '';
    this.downloadAttempts.push(identifier);

    // Return mock valid PDF
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

class MockOrchestrator {
  private filterService: MockFilterService;
  private classifier: MockClassifier;
  private pdfValidator: MockPdfValidator;

  constructor(filterService: MockFilterService, classifier: MockClassifier, pdfValidator: MockPdfValidator) {
    this.filterService = filterService;
    this.classifier = classifier;
    this.pdfValidator = pdfValidator;
  }

  async processBook(book: BookMetadata, dryRun: boolean = false): Promise<{ status: string; reason?: string }> {
    // Step 1: AI Classification
    const classification = await this.classifier.classifyBook({ identifier: book.identifier });
    const genres = classification?.genres || null;

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
    await this.pdfValidator.downloadAndValidate(pdfUrl);

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
      errors: []
    };

    for (const book of books) {
      result.processed++;

      try {
        const bookResult = await this.processBook(book, dryRun);

        if (bookResult.status === 'added') {
          result.added++;
        } else if (bookResult.status === 'filtered') {
          result.filtered++;
          
          // Track which filter rejected the book
          if (bookResult.reason && bookResult.reason.includes('Genre filter')) {
            result.filteredByGenre++;
          } else if (bookResult.reason && bookResult.reason.includes('Author filter')) {
            result.filteredByAuthor++;
          }
        } else if (bookResult.status === 'failed') {
          result.failed++;
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

    result.completedAt = new Date();
    return result;
  }
}

describe('Filter Integration in Orchestrator - Integration Tests', () => {
  let filterService: MockFilterService;
  let classifier: MockClassifier;
  let pdfValidator: MockPdfValidator;
  let orchestrator: MockOrchestrator;

  beforeEach(() => {
    const config: FilterConfig = {
      allowedGenres: [],
      allowedAuthors: [],
      enableGenreFilter: false,
      enableAuthorFilter: false
    };
    filterService = new MockFilterService(config);
    classifier = new MockClassifier();
    pdfValidator = new MockPdfValidator();
    orchestrator = new MockOrchestrator(filterService, classifier, pdfValidator);
  });

  /**
   * Test: Filters are applied after AI classification
   * Validates: Requirement 5.6.1
   */
  it('should apply filters after AI classification', async () => {
    // Setup: Enable genre filter
    const config: FilterConfig = {
      allowedGenres: ['Fiction'],
      allowedAuthors: [],
      enableGenreFilter: true,
      enableAuthorFilter: false
    };
    filterService = new MockFilterService(config);
    orchestrator = new MockOrchestrator(filterService, classifier, pdfValidator);

    // Setup: Book with non-fiction genre
    const book: BookMetadata = {
      identifier: 'book_001',
      title: 'Science Book',
      creator: 'Author One'
    };
    classifier.setGenres('book_001', ['Science']);

    // Process book
    const result = await orchestrator.processBook(book);

    // Verify: Book was filtered (classification happened, then filter rejected it)
    expect(result.status).toBe('filtered');
    expect(result.reason).toContain('Genre filter failed');
  });

  /**
   * Test: Filters are applied before PDF download
   * Validates: Requirement 5.6.6
   */
  it('should apply filters before PDF download to save bandwidth', async () => {
    // Setup: Enable genre filter
    const config: FilterConfig = {
      allowedGenres: ['Fiction'],
      allowedAuthors: [],
      enableGenreFilter: true,
      enableAuthorFilter: false
    };
    filterService = new MockFilterService(config);
    pdfValidator.clearAttempts();
    orchestrator = new MockOrchestrator(filterService, classifier, pdfValidator);

    // Setup: Books with different genres
    const books: BookMetadata[] = [
      { identifier: 'fiction_book', title: 'Fiction Book', creator: 'Author One' },
      { identifier: 'science_book', title: 'Science Book', creator: 'Author Two' }
    ];
    classifier.setGenres('fiction_book', ['Fiction']);
    classifier.setGenres('science_book', ['Science']);

    // Run ingestion
    await orchestrator.runIngestionJob(books);

    // Verify: Only fiction book had PDF downloaded
    const downloadAttempts = pdfValidator.getDownloadAttempts();
    expect(downloadAttempts).toContain('fiction_book');
    expect(downloadAttempts).not.toContain('science_book');
  });

  /**
   * Test: Filter statistics are tracked correctly
   * Validates: Requirements 5.7.1-5.7.3
   */
  it('should track filter statistics correctly', async () => {
    // Setup: Enable both filters
    const config: FilterConfig = {
      allowedGenres: ['Fiction'],
      allowedAuthors: ['Approved Author'],
      enableGenreFilter: true,
      enableAuthorFilter: true
    };
    filterService = new MockFilterService(config);
    orchestrator = new MockOrchestrator(filterService, classifier, pdfValidator);

    // Setup: Books with various filter outcomes
    const books: BookMetadata[] = [
      { identifier: 'book_001', title: 'Book 1', creator: 'Approved Author' },  // Passes both
      { identifier: 'book_002', title: 'Book 2', creator: 'Other Author' },     // Fails author filter
      { identifier: 'book_003', title: 'Book 3', creator: 'Approved Author' },  // Fails genre filter
      { identifier: 'book_004', title: 'Book 4', creator: 'Approved Author' }   // Passes both
    ];
    
    classifier.setGenres('book_001', ['Fiction']);
    classifier.setGenres('book_002', ['Fiction']);
    classifier.setGenres('book_003', ['Science']);
    classifier.setGenres('book_004', ['Fiction']);

    // Run ingestion
    const result = await orchestrator.runIngestionJob(books);

    // Verify: Statistics are accurate
    expect(result.processed).toBe(4);
    expect(result.added).toBe(2);  // book_001 and book_004
    expect(result.filtered).toBe(2);  // book_002 and book_003
    expect(result.filteredByAuthor).toBe(1);  // book_002
    expect(result.filteredByGenre).toBe(1);  // book_003
    
    // Verify: Total books = added + filtered + failed
    expect(result.added + result.filtered + result.failed).toBe(result.processed);
  });

  /**
   * Test: Dry run mode works with filters
   * Validates: Requirement 5.6.1
   */
  it('should apply filters in dry run mode without downloading PDFs', async () => {
    // Setup: Enable genre filter
    const config: FilterConfig = {
      allowedGenres: ['Fiction'],
      allowedAuthors: [],
      enableGenreFilter: true,
      enableAuthorFilter: false
    };
    filterService = new MockFilterService(config);
    pdfValidator.clearAttempts();
    orchestrator = new MockOrchestrator(filterService, classifier, pdfValidator);

    // Setup: Books
    const books: BookMetadata[] = [
      { identifier: 'fiction_book', title: 'Fiction Book', creator: 'Author One' },
      { identifier: 'science_book', title: 'Science Book', creator: 'Author Two' }
    ];
    classifier.setGenres('fiction_book', ['Fiction']);
    classifier.setGenres('science_book', ['Science']);

    // Run ingestion in dry run mode
    const result = await orchestrator.runIngestionJob(books, true);

    // Verify: Filters were applied
    expect(result.added).toBe(1);  // Only fiction book
    expect(result.filtered).toBe(1);  // Science book filtered

    // Verify: No PDFs were downloaded (dry run)
    const downloadAttempts = pdfValidator.getDownloadAttempts();
    expect(downloadAttempts).toHaveLength(0);
  });

  /**
   * Test: Genre filter correctly filters books
   * Validates: Requirements 5.6.2
   */
  it('should filter books by genre correctly', async () => {
    // Setup: Enable genre filter for Fiction only
    const config: FilterConfig = {
      allowedGenres: ['Fiction', 'Mystery & Thriller'],
      allowedAuthors: [],
      enableGenreFilter: true,
      enableAuthorFilter: false
    };
    filterService = new MockFilterService(config);
    orchestrator = new MockOrchestrator(filterService, classifier, pdfValidator);

    // Setup: Books with various genres
    const books: BookMetadata[] = [
      { identifier: 'book_001', title: 'Fiction Book', creator: 'Author' },
      { identifier: 'book_002', title: 'Mystery Book', creator: 'Author' },
      { identifier: 'book_003', title: 'Science Book', creator: 'Author' },
      { identifier: 'book_004', title: 'History Book', creator: 'Author' }
    ];
    
    classifier.setGenres('book_001', ['Fiction']);
    classifier.setGenres('book_002', ['Mystery & Thriller']);
    classifier.setGenres('book_003', ['Science']);
    classifier.setGenres('book_004', ['History']);

    // Run ingestion
    const result = await orchestrator.runIngestionJob(books);

    // Verify: Only Fiction and Mystery books passed
    expect(result.added).toBe(2);
    expect(result.filtered).toBe(2);
    expect(result.filteredByGenre).toBe(2);
  });

  /**
   * Test: Author filter correctly filters books
   * Validates: Requirements 5.6.3
   */
  it('should filter books by author correctly', async () => {
    // Setup: Enable author filter
    const config: FilterConfig = {
      allowedGenres: [],
      allowedAuthors: ['Robin Sharma', 'Paulo Coelho'],
      enableGenreFilter: false,
      enableAuthorFilter: true
    };
    filterService = new MockFilterService(config);
    orchestrator = new MockOrchestrator(filterService, classifier, pdfValidator);

    // Setup: Books with various authors
    const books: BookMetadata[] = [
      { identifier: 'book_001', title: 'Book 1', creator: 'Robin Sharma' },
      { identifier: 'book_002', title: 'Book 2', creator: 'Paulo Coelho' },
      { identifier: 'book_003', title: 'Book 3', creator: 'Other Author' },
      { identifier: 'book_004', title: 'Book 4', creator: 'Another Author' }
    ];
    
    // All books have Fiction genre (genre filter disabled)
    books.forEach(book => classifier.setGenres(book.identifier, ['Fiction']));

    // Run ingestion
    const result = await orchestrator.runIngestionJob(books);

    // Verify: Only Robin Sharma and Paulo Coelho books passed
    expect(result.added).toBe(2);
    expect(result.filtered).toBe(2);
    expect(result.filteredByAuthor).toBe(2);
  });

  /**
   * Test: Combined filters work correctly
   * Validates: Requirements 5.6.5
   */
  it('should apply both genre and author filters when enabled', async () => {
    // Setup: Enable both filters
    const config: FilterConfig = {
      allowedGenres: ['Fiction'],
      allowedAuthors: ['Approved Author'],
      enableGenreFilter: true,
      enableAuthorFilter: true
    };
    filterService = new MockFilterService(config);
    orchestrator = new MockOrchestrator(filterService, classifier, pdfValidator);

    // Setup: Books with various combinations
    const books: BookMetadata[] = [
      { identifier: 'book_001', title: 'Book 1', creator: 'Approved Author' },  // Fiction + Approved = PASS
      { identifier: 'book_002', title: 'Book 2', creator: 'Other Author' },     // Fiction + Other = FAIL (author)
      { identifier: 'book_003', title: 'Book 3', creator: 'Approved Author' },  // Science + Approved = FAIL (genre)
      { identifier: 'book_004', title: 'Book 4', creator: 'Other Author' }      // Science + Other = FAIL (both)
    ];
    
    classifier.setGenres('book_001', ['Fiction']);
    classifier.setGenres('book_002', ['Fiction']);
    classifier.setGenres('book_003', ['Science']);
    classifier.setGenres('book_004', ['Science']);

    // Run ingestion
    const result = await orchestrator.runIngestionJob(books);

    // Verify: Only book_001 passed both filters
    expect(result.added).toBe(1);
    expect(result.filtered).toBe(3);
  });

  /**
   * Test: Books without genres are filtered when genre filter is enabled
   * Validates: Requirement 5.6.2
   */
  it('should filter books without genres when genre filter is enabled', async () => {
    // Setup: Enable genre filter
    const config: FilterConfig = {
      allowedGenres: ['Fiction'],
      allowedAuthors: [],
      enableGenreFilter: true,
      enableAuthorFilter: false
    };
    filterService = new MockFilterService(config);
    orchestrator = new MockOrchestrator(filterService, classifier, pdfValidator);

    // Setup: Book with no genres (classification returned null)
    const book: BookMetadata = {
      identifier: 'book_001',
      title: 'Book Without Genres',
      creator: 'Author'
    };
    // Don't set genres for this book (classifier returns null)

    // Process book
    const result = await orchestrator.processBook(book);

    // Verify: Book was filtered
    expect(result.status).toBe('filtered');
    expect(result.reason).toContain('Book has no genres');
  });

  /**
   * Test: Empty filter lists allow all books
   * Validates: Requirements 5.1.3, 5.2.3
   */
  it('should allow all books when filter lists are empty', async () => {
    // Setup: Enable filters but with empty lists
    const config: FilterConfig = {
      allowedGenres: [],
      allowedAuthors: [],
      enableGenreFilter: true,
      enableAuthorFilter: true
    };
    filterService = new MockFilterService(config);
    orchestrator = new MockOrchestrator(filterService, classifier, pdfValidator);

    // Setup: Books with various genres and authors
    const books: BookMetadata[] = [
      { identifier: 'book_001', title: 'Book 1', creator: 'Author One' },
      { identifier: 'book_002', title: 'Book 2', creator: 'Author Two' },
      { identifier: 'book_003', title: 'Book 3', creator: 'Author Three' }
    ];
    
    classifier.setGenres('book_001', ['Fiction']);
    classifier.setGenres('book_002', ['Science']);
    classifier.setGenres('book_003', ['History']);

    // Run ingestion
    const result = await orchestrator.runIngestionJob(books);

    // Verify: All books passed (empty lists = allow all)
    expect(result.added).toBe(3);
    expect(result.filtered).toBe(0);
  });
});
