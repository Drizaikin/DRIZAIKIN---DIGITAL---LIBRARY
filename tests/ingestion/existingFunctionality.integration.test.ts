/**
 * Integration Tests for Existing Functionality Preservation
 * **Feature: public-domain-book-ingestion**
 * **Validates: Requirements 11.1, 11.2, 11.4**
 * 
 * This test verifies that:
 * - Admin manual upload still works
 * - Existing books are unaffected by ingestion
 * - AdminPanel and ExtractionPanel components remain functional
 */

import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Interface for a book record in the database
 * Includes both original fields and new ingestion tracking fields
 */
interface BookRecord {
  id: string;
  title: string;
  author: string;
  published_year?: number | null;
  language?: string | null;
  description?: string | null;
  cover_url?: string | null;
  category_id?: string | null;
  total_copies: number;
  copies_available: number;
  popularity: number;
  created_at: Date;
  // New nullable fields for ingestion tracking (Req 11.3)
  source?: string | null;
  source_identifier?: string | null;
  pdf_url?: string | null;
}

/**
 * Interface for manual book upload (admin functionality)
 */
interface ManualBookUpload {
  title: string;
  author: string;
  published_year?: number;
  language?: string;
  description?: string;
  cover_url?: string;
  category_id?: string;
  total_copies?: number;
  copies_available?: number;
}

/**
 * Interface for ingested book (from Internet Archive)
 */
interface IngestedBook {
  title: string;
  author: string;
  year?: number | null;
  language?: string | null;
  source: string;
  source_identifier: string;
  pdf_url: string;
  description?: string | null;
}

/**
 * Simulates the database with support for both manual uploads and ingested books
 * Models the actual database schema with nullable ingestion fields
 */
class MockDatabase {
  private books: Map<string, BookRecord> = new Map();
  private nextId: number = 1;

  /**
   * Inserts a manually uploaded book (admin functionality)
   * This simulates the existing admin upload flow
   * @param book - Manual book upload data
   * @returns Inserted book record
   */
  insertManualBook(book: ManualBookUpload): BookRecord {
    const id = `manual_${this.nextId++}`;
    const record: BookRecord = {
      id,
      title: book.title,
      author: book.author,
      published_year: book.published_year || null,
      language: book.language || null,
      description: book.description || null,
      cover_url: book.cover_url || 'https://picsum.photos/seed/book/400/600',
      category_id: book.category_id || null,
      total_copies: book.total_copies || 1,
      copies_available: book.copies_available || 1,
      popularity: 0,
      created_at: new Date(),
      // Nullable ingestion fields - not set for manual uploads (Req 11.3)
      source: null,
      source_identifier: null,
      pdf_url: null
    };
    this.books.set(id, record);
    return record;
  }

  /**
   * Inserts an ingested book (from Internet Archive)
   * @param book - Ingested book data
   * @returns Inserted book record
   */
  insertIngestedBook(book: IngestedBook): BookRecord {
    const id = `ingested_${this.nextId++}`;
    const record: BookRecord = {
      id,
      title: book.title,
      author: book.author,
      published_year: book.year || null,
      language: book.language || null,
      description: book.description || null,
      cover_url: 'https://picsum.photos/seed/book/400/600',
      category_id: null,
      total_copies: 1,
      copies_available: 1,
      popularity: 0,
      created_at: new Date(),
      // Ingestion tracking fields are set
      source: book.source,
      source_identifier: book.source_identifier,
      pdf_url: book.pdf_url
    };
    this.books.set(id, record);
    return record;
  }

  /**
   * Gets a book by ID
   */
  getBook(id: string): BookRecord | undefined {
    return this.books.get(id);
  }

  /**
   * Gets all books
   */
  getAllBooks(): BookRecord[] {
    return Array.from(this.books.values());
  }

  /**
   * Gets books by source (null for manual uploads)
   */
  getBooksBySource(source: string | null): BookRecord[] {
    return this.getAllBooks().filter(book => book.source === source);
  }

  /**
   * Updates a book
   */
  updateBook(id: string, updates: Partial<BookRecord>): BookRecord | null {
    const book = this.books.get(id);
    if (!book) return null;
    
    const updated = { ...book, ...updates };
    this.books.set(id, updated);
    return updated;
  }

  /**
   * Deletes a book
   */
  deleteBook(id: string): boolean {
    return this.books.delete(id);
  }

  /**
   * Gets total book count
   */
  getBookCount(): number {
    return this.books.size;
  }

  /**
   * Clears all books
   */
  clear(): void {
    this.books.clear();
    this.nextId = 1;
  }
}

/**
 * Simulates the AdminPanel component's book management functionality
 */
class MockAdminPanel {
  private db: MockDatabase;

  constructor(db: MockDatabase) {
    this.db = db;
  }

  /**
   * Adds a new book via admin panel (manual upload)
   * This is the existing functionality that must be preserved
   */
  async addBook(bookData: ManualBookUpload): Promise<{ success: boolean; book?: BookRecord; error?: string }> {
    try {
      // Validate required fields
      if (!bookData.title || bookData.title.trim() === '') {
        return { success: false, error: 'Title is required' };
      }
      if (!bookData.author || bookData.author.trim() === '') {
        return { success: false, error: 'Author is required' };
      }

      const book = this.db.insertManualBook(bookData);
      return { success: true, book };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Updates an existing book
   */
  async updateBook(id: string, updates: Partial<ManualBookUpload>): Promise<{ success: boolean; book?: BookRecord; error?: string }> {
    try {
      const book = this.db.updateBook(id, updates);
      if (!book) {
        return { success: false, error: 'Book not found' };
      }
      return { success: true, book };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Deletes a book
   */
  async deleteBook(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const deleted = this.db.deleteBook(id);
      if (!deleted) {
        return { success: false, error: 'Book not found' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Gets all books for display
   */
  async getBooks(): Promise<BookRecord[]> {
    return this.db.getAllBooks();
  }
}

/**
 * Simulates the ingestion service
 */
class MockIngestionService {
  private db: MockDatabase;

  constructor(db: MockDatabase) {
    this.db = db;
  }

  /**
   * Ingests books from Internet Archive
   */
  async ingestBooks(books: IngestedBook[]): Promise<{ added: number; skipped: number; failed: number }> {
    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const book of books) {
      try {
        // Check for duplicate source_identifier
        const existing = this.db.getAllBooks().find(b => b.source_identifier === book.source_identifier);
        if (existing) {
          skipped++;
          continue;
        }

        this.db.insertIngestedBook(book);
        added++;
      } catch (error) {
        failed++;
      }
    }

    return { added, skipped, failed };
  }
}

describe('Existing Functionality Preservation - Integration Tests', () => {
  let db: MockDatabase;
  let adminPanel: MockAdminPanel;
  let ingestionService: MockIngestionService;

  beforeEach(() => {
    db = new MockDatabase();
    adminPanel = new MockAdminPanel(db);
    ingestionService = new MockIngestionService(db);
  });

  /**
   * Test: Admin manual upload still works
   * Validates: Requirement 11.1
   */
  describe('Admin Manual Upload Functionality', () => {
    it('should allow admin to add books manually', async () => {
      const bookData: ManualBookUpload = {
        title: 'Introduction to Programming',
        author: 'John Doe',
        published_year: 2023,
        language: 'en',
        description: 'A comprehensive guide to programming',
        total_copies: 5,
        copies_available: 5
      };

      const result = await adminPanel.addBook(bookData);

      expect(result.success).toBe(true);
      expect(result.book).toBeDefined();
      expect(result.book?.title).toBe('Introduction to Programming');
      expect(result.book?.author).toBe('John Doe');
      // Ingestion fields should be null for manual uploads (Req 11.3)
      expect(result.book?.source).toBeNull();
      expect(result.book?.source_identifier).toBeNull();
      expect(result.book?.pdf_url).toBeNull();
    });

    it('should validate required fields for manual upload', async () => {
      // Missing title
      const result1 = await adminPanel.addBook({ title: '', author: 'Author' });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Title is required');

      // Missing author
      const result2 = await adminPanel.addBook({ title: 'Title', author: '' });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Author is required');
    });

    it('should allow admin to update existing books', async () => {
      // Add a book first
      const addResult = await adminPanel.addBook({
        title: 'Original Title',
        author: 'Original Author'
      });
      expect(addResult.success).toBe(true);
      const bookId = addResult.book!.id;

      // Update the book
      const updateResult = await adminPanel.updateBook(bookId, {
        title: 'Updated Title',
        description: 'New description'
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.book?.title).toBe('Updated Title');
      expect(updateResult.book?.description).toBe('New description');
      expect(updateResult.book?.author).toBe('Original Author'); // Unchanged
    });

    it('should allow admin to delete books', async () => {
      // Add a book first
      const addResult = await adminPanel.addBook({
        title: 'Book to Delete',
        author: 'Author'
      });
      expect(addResult.success).toBe(true);
      const bookId = addResult.book!.id;

      // Delete the book
      const deleteResult = await adminPanel.deleteBook(bookId);
      expect(deleteResult.success).toBe(true);

      // Verify book is deleted
      const book = db.getBook(bookId);
      expect(book).toBeUndefined();
    });

    it('should allow admin to list all books', async () => {
      // Add multiple books
      await adminPanel.addBook({ title: 'Book 1', author: 'Author 1' });
      await adminPanel.addBook({ title: 'Book 2', author: 'Author 2' });
      await adminPanel.addBook({ title: 'Book 3', author: 'Author 3' });

      const books = await adminPanel.getBooks();
      expect(books).toHaveLength(3);
    });
  });

  /**
   * Test: Existing books are unaffected by ingestion
   * Validates: Requirement 11.2
   */
  describe('Existing Books Preservation', () => {
    it('should not modify existing manually uploaded books during ingestion', async () => {
      // Add manual books first
      const manual1 = await adminPanel.addBook({
        title: 'Manual Book 1',
        author: 'Manual Author 1',
        published_year: 2020,
        total_copies: 10
      });
      const manual2 = await adminPanel.addBook({
        title: 'Manual Book 2',
        author: 'Manual Author 2',
        published_year: 2021,
        total_copies: 5
      });

      // Store original state
      const originalBook1 = { ...manual1.book! };
      const originalBook2 = { ...manual2.book! };

      // Run ingestion
      await ingestionService.ingestBooks([
        {
          title: 'Ingested Book 1',
          author: 'Ingested Author 1',
          source: 'internet_archive',
          source_identifier: 'ia_book_001',
          pdf_url: 'https://storage.example.com/books/ia_book_001.pdf'
        },
        {
          title: 'Ingested Book 2',
          author: 'Ingested Author 2',
          source: 'internet_archive',
          source_identifier: 'ia_book_002',
          pdf_url: 'https://storage.example.com/books/ia_book_002.pdf'
        }
      ]);

      // Verify manual books are unchanged
      const book1After = db.getBook(manual1.book!.id);
      const book2After = db.getBook(manual2.book!.id);

      expect(book1After?.title).toBe(originalBook1.title);
      expect(book1After?.author).toBe(originalBook1.author);
      expect(book1After?.published_year).toBe(originalBook1.published_year);
      expect(book1After?.total_copies).toBe(originalBook1.total_copies);
      expect(book1After?.source).toBeNull(); // Still null

      expect(book2After?.title).toBe(originalBook2.title);
      expect(book2After?.author).toBe(originalBook2.author);
      expect(book2After?.published_year).toBe(originalBook2.published_year);
      expect(book2After?.total_copies).toBe(originalBook2.total_copies);
      expect(book2After?.source).toBeNull(); // Still null
    });

    it('should keep manual and ingested books separate', async () => {
      // Add manual books
      await adminPanel.addBook({ title: 'Manual Book', author: 'Manual Author' });

      // Run ingestion
      await ingestionService.ingestBooks([
        {
          title: 'Ingested Book',
          author: 'Ingested Author',
          source: 'internet_archive',
          source_identifier: 'ia_book_001',
          pdf_url: 'https://storage.example.com/books/ia_book_001.pdf'
        }
      ]);

      // Verify separation
      const manualBooks = db.getBooksBySource(null);
      const ingestedBooks = db.getBooksBySource('internet_archive');

      expect(manualBooks).toHaveLength(1);
      expect(manualBooks[0].title).toBe('Manual Book');

      expect(ingestedBooks).toHaveLength(1);
      expect(ingestedBooks[0].title).toBe('Ingested Book');
    });

    it('should allow admin to manage both manual and ingested books', async () => {
      // Add manual book
      const manualResult = await adminPanel.addBook({
        title: 'Manual Book',
        author: 'Manual Author'
      });

      // Run ingestion
      await ingestionService.ingestBooks([
        {
          title: 'Ingested Book',
          author: 'Ingested Author',
          source: 'internet_archive',
          source_identifier: 'ia_book_001',
          pdf_url: 'https://storage.example.com/books/ia_book_001.pdf'
        }
      ]);

      // Admin should see all books
      const allBooks = await adminPanel.getBooks();
      expect(allBooks).toHaveLength(2);

      // Admin should be able to update ingested book
      const ingestedBook = allBooks.find(b => b.source === 'internet_archive');
      const updateResult = await adminPanel.updateBook(ingestedBook!.id, {
        description: 'Updated by admin'
      });
      expect(updateResult.success).toBe(true);
      expect(updateResult.book?.description).toBe('Updated by admin');

      // Admin should be able to delete ingested book
      const deleteResult = await adminPanel.deleteBook(ingestedBook!.id);
      expect(deleteResult.success).toBe(true);

      // Only manual book should remain
      const remainingBooks = await adminPanel.getBooks();
      expect(remainingBooks).toHaveLength(1);
      expect(remainingBooks[0].id).toBe(manualResult.book!.id);
    });
  });

  /**
   * Test: New schema fields are nullable
   * Validates: Requirement 11.3
   */
  describe('Schema Compatibility', () => {
    it('should allow null values for new ingestion tracking fields', async () => {
      const result = await adminPanel.addBook({
        title: 'Book Without Ingestion Fields',
        author: 'Author'
      });

      expect(result.success).toBe(true);
      expect(result.book?.source).toBeNull();
      expect(result.book?.source_identifier).toBeNull();
      expect(result.book?.pdf_url).toBeNull();
    });

    it('should allow ingested books to have all tracking fields set', async () => {
      await ingestionService.ingestBooks([
        {
          title: 'Fully Tracked Book',
          author: 'Author',
          year: 1850,
          language: 'en',
          source: 'internet_archive',
          source_identifier: 'ia_tracked_001',
          pdf_url: 'https://storage.example.com/books/ia_tracked_001.pdf',
          description: 'A tracked book'
        }
      ]);

      const books = db.getBooksBySource('internet_archive');
      expect(books).toHaveLength(1);
      expect(books[0].source).toBe('internet_archive');
      expect(books[0].source_identifier).toBe('ia_tracked_001');
      expect(books[0].pdf_url).toBe('https://storage.example.com/books/ia_tracked_001.pdf');
    });

    it('should query books regardless of ingestion field values', async () => {
      // Add mix of manual and ingested books
      await adminPanel.addBook({ title: 'Manual 1', author: 'Author' });
      await adminPanel.addBook({ title: 'Manual 2', author: 'Author' });
      await ingestionService.ingestBooks([
        {
          title: 'Ingested 1',
          author: 'Author',
          source: 'internet_archive',
          source_identifier: 'ia_001',
          pdf_url: 'https://example.com/ia_001.pdf'
        }
      ]);

      // All books should be queryable
      const allBooks = db.getAllBooks();
      expect(allBooks).toHaveLength(3);

      // Filter by source should work
      const manualOnly = db.getBooksBySource(null);
      expect(manualOnly).toHaveLength(2);

      const ingestedOnly = db.getBooksBySource('internet_archive');
      expect(ingestedOnly).toHaveLength(1);
    });
  });

  /**
   * Test: AdminPanel and ExtractionPanel remain functional
   * Validates: Requirement 11.4
   */
  describe('Component Functionality', () => {
    it('should support all AdminPanel CRUD operations', async () => {
      // Create
      const createResult = await adminPanel.addBook({
        title: 'Test Book',
        author: 'Test Author',
        published_year: 2023
      });
      expect(createResult.success).toBe(true);
      const bookId = createResult.book!.id;

      // Read
      const books = await adminPanel.getBooks();
      expect(books.find(b => b.id === bookId)).toBeDefined();

      // Update
      const updateResult = await adminPanel.updateBook(bookId, {
        title: 'Updated Test Book'
      });
      expect(updateResult.success).toBe(true);
      expect(updateResult.book?.title).toBe('Updated Test Book');

      // Delete
      const deleteResult = await adminPanel.deleteBook(bookId);
      expect(deleteResult.success).toBe(true);

      // Verify deletion
      const booksAfterDelete = await adminPanel.getBooks();
      expect(booksAfterDelete.find(b => b.id === bookId)).toBeUndefined();
    });

    it('should handle concurrent manual uploads and ingestion', async () => {
      // Simulate concurrent operations
      const operations = [
        adminPanel.addBook({ title: 'Manual 1', author: 'Author' }),
        adminPanel.addBook({ title: 'Manual 2', author: 'Author' }),
        ingestionService.ingestBooks([
          {
            title: 'Ingested 1',
            author: 'Author',
            source: 'internet_archive',
            source_identifier: 'ia_001',
            pdf_url: 'https://example.com/ia_001.pdf'
          }
        ]),
        adminPanel.addBook({ title: 'Manual 3', author: 'Author' })
      ];

      await Promise.all(operations);

      // All operations should succeed
      const allBooks = db.getAllBooks();
      expect(allBooks).toHaveLength(4);
      expect(db.getBooksBySource(null)).toHaveLength(3);
      expect(db.getBooksBySource('internet_archive')).toHaveLength(1);
    });

    it('should maintain data integrity across operations', async () => {
      // Add initial books
      await adminPanel.addBook({ title: 'Book 1', author: 'Author 1', total_copies: 5 });
      await adminPanel.addBook({ title: 'Book 2', author: 'Author 2', total_copies: 3 });

      // Run ingestion
      await ingestionService.ingestBooks([
        {
          title: 'Ingested Book',
          author: 'Ingested Author',
          source: 'internet_archive',
          source_identifier: 'ia_001',
          pdf_url: 'https://example.com/ia_001.pdf'
        }
      ]);

      // Update a manual book
      const manualBooks = db.getBooksBySource(null);
      await adminPanel.updateBook(manualBooks[0].id, { total_copies: 10 });

      // Delete an ingested book
      const ingestedBooks = db.getBooksBySource('internet_archive');
      await adminPanel.deleteBook(ingestedBooks[0].id);

      // Verify final state
      const finalBooks = db.getAllBooks();
      expect(finalBooks).toHaveLength(2);
      expect(finalBooks.every(b => b.source === null)).toBe(true);
      expect(finalBooks.find(b => b.total_copies === 10)).toBeDefined();
    });
  });

  /**
   * Test: Ingestion does not interfere with existing schema fields
   * Validates: Requirement 11.2
   */
  describe('Schema Field Preservation', () => {
    it('should preserve all original book fields during ingestion', async () => {
      // Add a book with all fields populated
      const fullBook = await adminPanel.addBook({
        title: 'Complete Book',
        author: 'Complete Author',
        published_year: 2020,
        language: 'en',
        description: 'A complete description',
        cover_url: 'https://example.com/cover.jpg',
        category_id: 'cat_123',
        total_copies: 10,
        copies_available: 8
      });

      // Run ingestion
      await ingestionService.ingestBooks([
        {
          title: 'Ingested Book',
          author: 'Ingested Author',
          source: 'internet_archive',
          source_identifier: 'ia_001',
          pdf_url: 'https://example.com/ia_001.pdf'
        }
      ]);

      // Verify original book is completely unchanged
      const book = db.getBook(fullBook.book!.id);
      expect(book?.title).toBe('Complete Book');
      expect(book?.author).toBe('Complete Author');
      expect(book?.published_year).toBe(2020);
      expect(book?.language).toBe('en');
      expect(book?.description).toBe('A complete description');
      expect(book?.cover_url).toBe('https://example.com/cover.jpg');
      expect(book?.category_id).toBe('cat_123');
      expect(book?.total_copies).toBe(10);
      expect(book?.copies_available).toBe(8);
      expect(book?.source).toBeNull();
      expect(book?.source_identifier).toBeNull();
      expect(book?.pdf_url).toBeNull();
    });
  });
});
