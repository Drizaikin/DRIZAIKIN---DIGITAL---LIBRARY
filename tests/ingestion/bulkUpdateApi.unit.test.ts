/**
 * Unit tests for Bulk Category Update API
 * 
 * Tests the API endpoint for triggering bulk category updates
 * Requirements: 5.5.1-5.5.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Bulk Category Update API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authorization', () => {
    it('should reject requests without authorization header', async () => {
      process.env.ADMIN_HEALTH_SECRET = 'test-secret';
      
      const mockReq = {
        method: 'POST',
        headers: {}
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      // Import the handler
      const { default: handler } = await import('../../api/admin/books/bulk-update-categories.js');
      
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'Authorization required'
        })
      );
    });

    it('should reject requests with invalid authorization', async () => {
      process.env.ADMIN_HEALTH_SECRET = 'test-secret';
      
      const mockReq = {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-secret'
        }
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      const { default: handler } = await import('../../api/admin/books/bulk-update-categories.js');
      
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'Invalid authorization'
        })
      );
    });
  });

  describe('HTTP Methods', () => {
    it('should reject GET requests', async () => {
      process.env.ADMIN_HEALTH_SECRET = 'test-secret';
      
      const mockReq = {
        method: 'GET',
        headers: {
          authorization: 'Bearer test-secret'
        }
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      const { default: handler } = await import('../../api/admin/books/bulk-update-categories.js');
      
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(405);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Method not allowed',
          message: 'This endpoint only accepts POST requests'
        })
      );
    });

    it('should accept POST requests with valid authorization', async () => {
      process.env.ADMIN_HEALTH_SECRET = 'test-secret';
      
      const mockReq = {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-secret'
        }
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      // Mock the updateAllCategories function
      vi.mock('../../services/ingestion/bulkCategoryUpdate.js', () => ({
        updateAllCategories: vi.fn().mockResolvedValue({
          updated: 100,
          errors: 0,
          details: []
        })
      }));

      const { default: handler } = await import('../../api/admin/books/bulk-update-categories.js');
      
      await handler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Bulk category update completed'
        })
      );
    });
  });

  describe('Response Format', () => {
    it('should return structured result with update statistics', async () => {
      process.env.ADMIN_HEALTH_SECRET = 'test-secret';
      
      const mockReq = {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-secret'
        }
      };
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      // Mock successful update
      vi.mock('../../services/ingestion/bulkCategoryUpdate.js', () => ({
        updateAllCategories: vi.fn().mockResolvedValue({
          updated: 150,
          errors: 5,
          details: [
            { bookId: 'book-1', error: 'Test error' }
          ]
        })
      }));

      const { default: handler } = await import('../../api/admin/books/bulk-update-categories.js');
      
      await handler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          result: expect.objectContaining({
            totalProcessed: 155,
            updated: 150,
            errors: 5,
            errorDetails: expect.any(Array)
          }),
          responseTimeMs: expect.any(Number),
          timestamp: expect.any(String)
        })
      );
    });
  });
});
