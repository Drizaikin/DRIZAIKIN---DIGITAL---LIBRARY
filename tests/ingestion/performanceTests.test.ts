import { describe, it, expect } from 'vitest';

interface Book {
  identifier: string;
  title: string;
  author: string;
  genres: string[];
}

interface FilterConfig {
  allowedGenres: string[];
  allowedAuthors: string[];
  enableGenreFilter: boolean;
  enableAuthorFilter: boolean;
}

interface FilterResult {
  passed: boolean;
  reason?: string;
}

function mockApplyFilters(book: Book, config: FilterConfig): FilterResult {
  const genreResult = config.enableGenreFilter && config.allowedGenres.length > 0
    ? config.allowedGenres.some((g: string) => book.genres && book.genres.includes(g))
    : true;
  
  const authorResult = config.enableAuthorFilter && config.allowedAuthors.length > 0
    ? config.allowedAuthors.some((a: string) => book.author && book.author.toLowerCase().includes(a.toLowerCase()))
    : true;
  
  return {
    passed: genreResult && authorResult,
    reason: !genreResult ? 'Genre filter failed' : !authorResult ? 'Author filter failed' : undefined
  };
}

function generateMockBook(id: number): Book {
  const genres = ['Fiction', 'Mystery & Thriller', 'Science Fiction & Fantasy', 'Romance', 'Horror'];
  const authors = ['John Smith', 'Jane Doe', 'Robin Sharma', 'Paulo Coelho', 'Dale Carnegie'];
  
  return {
    identifier: `book_${id}`,
    title: `Test Book ${id}`,
    author: authors[id % authors.length],
    genres: [genres[id % genres.length], genres[(id + 1) % genres.length]]
  };
}

describe('Performance Tests - Ingestion Filtering', () => {
  describe('Filter Overhead Performance', () => {
    it('single book filter check should complete in less than 100ms', () => {
      const book = generateMockBook(1);
      const config: FilterConfig = {
        allowedGenres: ['Fiction', 'Mystery & Thriller'],
        allowedAuthors: ['John Smith'],
        enableGenreFilter: true,
        enableAuthorFilter: true
      };
      
      const startTime = performance.now();
      const result = mockApplyFilters(book, config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100);
    });

    it('batch filter processing should maintain less than 100ms per book average', () => {
      const books = Array.from({ length: 100 }, (_, i) => generateMockBook(i));
      const config: FilterConfig = {
        allowedGenres: ['Fiction', 'Mystery & Thriller', 'Science Fiction & Fantasy'],
        allowedAuthors: ['John Smith', 'Jane Doe', 'Robin Sharma'],
        enableGenreFilter: true,
        enableAuthorFilter: true
      };
      
      const startTime = performance.now();
      const results = books.map(book => mockApplyFilters(book, config));
      const endTime = performance.now();
      
      const totalDuration = endTime - startTime;
      const averagePerBook = totalDuration / books.length;
      
      expect(results).toHaveLength(100);
      expect(averagePerBook).toBeLessThan(100);
    });
    
    it('filter check with large configuration should complete in less than 100ms', () => {
      const book = generateMockBook(1);
      const config: FilterConfig = {
        allowedGenres: Array.from({ length: 20 }, (_, i) => `Genre ${i + 1}`),
        allowedAuthors: Array.from({ length: 50 }, (_, i) => `Author ${i + 1}`),
        enableGenreFilter: true,
        enableAuthorFilter: true
      };
      
      const startTime = performance.now();
      const result = mockApplyFilters(book, config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100);
    });
  });
  
  describe('Bulk Update Performance', () => {
    it('bulk update performance simulation should exceed 100 books per second', () => {
      const books = Array.from({ length: 1000 }, (_, i) => ({
        id: `book_${i}`,
        genres: i % 3 === 0 ? [] as string[] : [`Genre ${i % 5}`, `Genre ${(i + 1) % 5}`]
      }));
      
      const startTime = performance.now();
      
      const results = books.map(book => {
        const category = book.genres && book.genres.length > 0 
          ? book.genres[0] 
          : 'Uncategorized';
        return { id: book.id, category };
      });
      
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const booksPerSecond = (books.length / totalDuration) * 1000;
      
      expect(results).toHaveLength(1000);
      expect(booksPerSecond).toBeGreaterThan(100);
    });
    
    it('category sync logic performance with various genre arrays', () => {
      const testCases = [
        { genres: [] as string[], expected: 'Uncategorized' },
        { genres: ['Fiction'], expected: 'Fiction' },
        { genres: ['Fiction', 'Mystery & Thriller'], expected: 'Fiction' },
        { genres: ['Fiction', 'Mystery & Thriller', 'Horror'], expected: 'Fiction' }
      ];
      
      const iterations = 10000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const testCase = testCases[i % testCases.length];
        const category = testCase.genres && testCase.genres.length > 0 
          ? testCase.genres[0] 
          : 'Uncategorized';
        expect(category).toBe(testCase.expected);
      }
      
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const operationsPerSecond = (iterations / totalDuration) * 1000;
      
      expect(operationsPerSecond).toBeGreaterThan(10000);
    });
  });

  describe('Scalability Tests', () => {
    it('filter performance should not degrade significantly with book count', () => {
      const config: FilterConfig = {
        allowedGenres: ['Fiction', 'Mystery & Thriller'],
        allowedAuthors: ['John Smith', 'Jane Doe'],
        enableGenreFilter: true,
        enableAuthorFilter: true
      };
      
      const testSizes = [10, 100, 1000];
      const results: Array<{ size: number; avgTime: number; totalTime: number }> = [];
      
      for (const size of testSizes) {
        const books = Array.from({ length: size }, (_, i) => generateMockBook(i));
        
        const startTime = performance.now();
        books.forEach(book => mockApplyFilters(book, config));
        const endTime = performance.now();
        
        const totalTime = endTime - startTime;
        const avgTime = totalTime / size;
        
        results.push({ size, avgTime, totalTime });
      }
      
      const smallAvg = results[0].avgTime;
      const largeAvg = results[results.length - 1].avgTime;
      const degradationRatio = largeAvg / smallAvg;
      
      expect(degradationRatio).toBeLessThan(2);
      expect(largeAvg).toBeLessThan(100);
    });
    
    it('memory usage should remain stable during large batch processing', () => {
      const config: FilterConfig = {
        allowedGenres: Array.from({ length: 20 }, (_, i) => `Genre ${i + 1}`),
        allowedAuthors: Array.from({ length: 50 }, (_, i) => `Author ${i + 1}`),
        enableGenreFilter: true,
        enableAuthorFilter: true
      };
      const books = Array.from({ length: 2000 }, (_, i) => generateMockBook(i));
      
      const memBefore = process.memoryUsage();
      const startTime = performance.now();
      
      const batchSize = 100;
      let processed = 0;
      
      for (let i = 0; i < books.length; i += batchSize) {
        const batch = books.slice(i, i + batchSize);
        batch.forEach(book => {
          const result = mockApplyFilters(book, config);
          expect(result).toBeDefined();
        });
        processed += batch.length;
      }
      
      const endTime = performance.now();
      const memAfter = process.memoryUsage();
      
      const totalTime = endTime - startTime;
      const booksPerSecond = (processed / totalTime) * 1000;
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      
      expect(processed).toBe(2000);
      expect(booksPerSecond).toBeGreaterThan(100);
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });
  });
  
  describe('Edge Case Performance', () => {
    it('performance with empty filter configurations', () => {
      const books = Array.from({ length: 1000 }, (_, i) => generateMockBook(i));
      const config: FilterConfig = {
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: true,
        enableAuthorFilter: true
      };
      
      const startTime = performance.now();
      const results = books.map(book => mockApplyFilters(book, config));
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTime = totalTime / books.length;
      
      expect(results.every(r => r.passed)).toBe(true);
      expect(avgTime).toBeLessThan(10);
    });
    
    it('performance with disabled filters', () => {
      const books = Array.from({ length: 1000 }, (_, i) => generateMockBook(i));
      const config: FilterConfig = {
        allowedGenres: ['Fiction'],
        allowedAuthors: ['John Smith'],
        enableGenreFilter: false,
        enableAuthorFilter: false
      };
      
      const startTime = performance.now();
      const results = books.map(book => mockApplyFilters(book, config));
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTime = totalTime / books.length;
      
      expect(results.every(r => r.passed)).toBe(true);
      expect(avgTime).toBeLessThan(5);
    });
  });
});
