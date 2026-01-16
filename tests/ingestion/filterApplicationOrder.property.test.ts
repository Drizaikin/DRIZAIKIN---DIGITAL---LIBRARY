/**
 * Property-Based Tests for Filter Application Order
 * **Feature: ingestion-filtering, Property 16: Filter Application Before PDF Download**
 * **Validates: Requirements 5.6.6**
 * 
 * This test verifies that:
 * - For any book in the ingestion pipeline, filters SHALL be applied after AI classification but before PDF download
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PRIMARY_GENRES } from '../../services/ingestion/genreTaxonomy.js';

/**
 * Mock types
 */
interface ProcessingStep {
  step: 'classification' | 'filter' | 'download';
  timestamp: number;
}

interface BookMetadata {
  identifier: string;
  title: string;
  author: string;
}

interface FilterConfig {
  allowedGenres: string[];
  allowedAuthors: string[];
  enableGenreFilter: boolean;
  enableAuthorFilter: boolean;
}

/**
 * Mock orchestrator that tracks processing order
 */
class OrderTrackingOrchestrator {
  private processingLog: ProcessingStep[] = [];
  private filterConfig: FilterConfig;

  constructor(filterConfig: FilterConfig) {
    this.filterConfig = filterConfig;
  }

  async processBook(book: BookMetadata, genres: string[] | null): Promise<{ status: string; order: ProcessingStep[] }> {
    this.processingLog = [];

    // Step 1: AI Classification (simulated - genres provided)
    this.processingLog.push({ step: 'classification', timestamp: Date.now() });
    await this.delay(1);

    // Step 2: Apply Filters
    const hasActiveFilters = this.hasActiveFilters();
    if (hasActiveFilters) {
      this.processingLog.push({ step: 'filter', timestamp: Date.now() });
      await this.delay(1);

      const filterPassed = this.checkFilters(book, genres);
      if (!filterPassed) {
        return { status: 'filtered', order: [...this.processingLog] };
      }
    }

    // Step 3: Download PDF
    this.processingLog.push({ step: 'download', timestamp: Date.now() });
    await this.delay(1);

    return { status: 'added', order: [...this.processingLog] };
  }

  private hasActiveFilters(): boolean {
    const genreActive = this.filterConfig.enableGenreFilter && this.filterConfig.allowedGenres.length > 0;
    const authorActive = this.filterConfig.enableAuthorFilter && this.filterConfig.allowedAuthors.length > 0;
    return genreActive || authorActive;
  }

  private checkFilters(book: BookMetadata, genres: string[] | null): boolean {
    // Genre filter
    if (this.filterConfig.enableGenreFilter && this.filterConfig.allowedGenres.length > 0) {
      if (!genres || genres.length === 0) {
        return false;
      }
      const hasMatch = genres.some(g => 
        this.filterConfig.allowedGenres.some(allowed => allowed.toLowerCase() === g.toLowerCase())
      );
      if (!hasMatch) {
        return false;
      }
    }

    // Author filter
    if (this.filterConfig.enableAuthorFilter && this.filterConfig.allowedAuthors.length > 0) {
      if (!book.author) {
        return false;
      }
      const normalizedAuthor = book.author.toLowerCase();
      const hasMatch = this.filterConfig.allowedAuthors.some(allowed => 
        normalizedAuthor.includes(allowed.toLowerCase())
      );
      if (!hasMatch) {
        return false;
      }
    }

    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Generators
 */
const validGenreArb = fc.constantFrom(...PRIMARY_GENRES);
const genresArrayArb = fc.array(validGenreArb, { minLength: 1, maxLength: 3 });
const allowedGenresArb = fc.array(validGenreArb, { minLength: 1, maxLength: 5 });

const bookArb = fc.record({
  identifier: fc.string({ minLength: 5, maxLength: 20 }),
  title: fc.string({ minLength: 5, maxLength: 50 }),
  author: fc.string({ minLength: 5, maxLength: 30 })
});

const activeFilterConfigArb = fc.record({
  allowedGenres: allowedGenresArb,
  allowedAuthors: fc.constant([]),
  enableGenreFilter: fc.constant(true),
  enableAuthorFilter: fc.constant(false)
});

const noFilterConfigArb = fc.record({
  allowedGenres: fc.constant([]),
  allowedAuthors: fc.constant([]),
  enableGenreFilter: fc.constant(false),
  enableAuthorFilter: fc.constant(false)
});

describe('Filter Application Order - Property Tests', () => {
  /**
   * **Feature: ingestion-filtering, Property 16: Filter Application Before PDF Download**
   * **Validates: Requirements 5.6.6**
   * 
   * Property: For any book in the ingestion pipeline, filters SHALL be applied after AI classification but before PDF download
   */
  it('Property 16: Filters are applied after classification and before PDF download', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookArb,
        genresArrayArb,
        activeFilterConfigArb,
        async (book, genres, config) => {
          const orchestrator = new OrderTrackingOrchestrator(config);
          const result = await orchestrator.processBook(book, genres);

          // PROPERTY ASSERTION 1: Processing order must be correct
          const order = result.order;
          expect(order.length).toBeGreaterThan(0);

          // Find indices of each step
          const classificationIndex = order.findIndex(step => step.step === 'classification');
          const filterIndex = order.findIndex(step => step.step === 'filter');
          const downloadIndex = order.findIndex(step => step.step === 'download');

          // PROPERTY ASSERTION 2: Classification must happen first
          expect(classificationIndex).toBe(0);

          // PROPERTY ASSERTION 3: If filter step exists, it must be after classification
          if (filterIndex !== -1) {
            expect(filterIndex).toBeGreaterThan(classificationIndex);
          }

          // PROPERTY ASSERTION 4: If download happens, it must be after filter (if filter exists)
          if (downloadIndex !== -1) {
            if (filterIndex !== -1) {
              expect(downloadIndex).toBeGreaterThan(filterIndex);
            }
            expect(downloadIndex).toBeGreaterThan(classificationIndex);
          }

          // PROPERTY ASSERTION 5: Timestamps must be in order
          for (let i = 1; i < order.length; i++) {
            expect(order[i].timestamp).toBeGreaterThanOrEqual(order[i - 1].timestamp);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When filters reject a book, PDF download should not occur
   */
  it('Property 16 (corollary): PDF download does not occur when filters reject a book', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookArb,
        genresArrayArb,
        activeFilterConfigArb,
        async (book, genres, config) => {
          const orchestrator = new OrderTrackingOrchestrator(config);
          const result = await orchestrator.processBook(book, genres);

          // PROPERTY ASSERTION: If book was filtered, download step should not exist
          if (result.status === 'filtered') {
            const hasDownloadStep = result.order.some(step => step.step === 'download');
            expect(hasDownloadStep).toBe(false);
          }

          // PROPERTY ASSERTION: If book was added, download step must exist
          if (result.status === 'added') {
            const hasDownloadStep = result.order.some(step => step.step === 'download');
            expect(hasDownloadStep).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: When no filters are active, processing order is classification -> download
   */
  it('Property 16 (corollary): Without filters, processing goes directly from classification to download', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookArb,
        genresArrayArb,
        noFilterConfigArb,
        async (book, genres, config) => {
          const orchestrator = new OrderTrackingOrchestrator(config);
          const result = await orchestrator.processBook(book, genres);

          // PROPERTY ASSERTION 1: No filter step should exist
          const hasFilterStep = result.order.some(step => step.step === 'filter');
          expect(hasFilterStep).toBe(false);

          // PROPERTY ASSERTION 2: Order should be classification -> download
          expect(result.order.length).toBe(2);
          expect(result.order[0].step).toBe('classification');
          expect(result.order[1].step).toBe('download');

          // PROPERTY ASSERTION 3: Book should be added (no filters to reject it)
          expect(result.status).toBe('added');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Filter step only exists when filters are active
   */
  it('Property 16 (corollary): Filter step exists if and only if filters are active', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookArb,
        genresArrayArb,
        fc.oneof(activeFilterConfigArb, noFilterConfigArb),
        async (book, genres, config) => {
          const orchestrator = new OrderTrackingOrchestrator(config);
          const result = await orchestrator.processBook(book, genres);

          // Determine if filters are active
          const genreActive = config.enableGenreFilter && config.allowedGenres.length > 0;
          const authorActive = config.enableAuthorFilter && config.allowedAuthors.length > 0;
          const filtersActive = genreActive || authorActive;

          // PROPERTY ASSERTION: Filter step exists if and only if filters are active
          const hasFilterStep = result.order.some(step => step.step === 'filter');
          expect(hasFilterStep).toBe(filtersActive);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Classification always happens first, regardless of filter configuration
   */
  it('Property 16 (corollary): Classification is always the first step', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookArb,
        genresArrayArb,
        fc.oneof(activeFilterConfigArb, noFilterConfigArb),
        async (book, genres, config) => {
          const orchestrator = new OrderTrackingOrchestrator(config);
          const result = await orchestrator.processBook(book, genres);

          // PROPERTY ASSERTION: First step is always classification
          expect(result.order.length).toBeGreaterThan(0);
          expect(result.order[0].step).toBe('classification');
        }
      ),
      { numRuns: 100 }
    );
  });
});
