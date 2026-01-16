/**
 * Unit Tests for SourceConfigurationService
 * **Feature: multi-source-ingestion**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 6.2, 6.3, 6.5**
 * 
 * This test verifies the SourceConfigurationService functionality including
 * CRUD operations, validation, and caching.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SourceConfigurationService,
  setSupabaseClient
} from '../../services/ingestion/fetchers/sourceConfigurationService.js';

// Mock Supabase client
const createMockSupabase = () => {
  const mockData: Map<string, any> = new Map();
  
  return {
    _data: mockData,
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((field: string, value: any) => ({
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(async () => {
          const data = mockData.get(value);
          if (data) {
            return { data, error: null };
          }
          return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
        }),
        order: vi.fn().mockReturnThis()
      })),
      single: vi.fn().mockImplementation(async () => {
        return { data: null, error: null };
      }),
      order: vi.fn().mockReturnThis()
    }))
  };
};

describe('SourceConfigurationService - Unit Tests', () => {
  let service: SourceConfigurationService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SourceConfigurationService();
    mockSupabase = createMockSupabase();
  });

  afterEach(() => {
    setSupabaseClient(null);
  });

  describe('getConfiguration', () => {
    /**
     * Test getting configuration with invalid source ID
     * Requirements: 2.3
     */
    it('should return null for invalid source ID', async () => {
      const result = await service.getConfiguration('');
      expect(result).toBeNull();
    });

    it('should return null for null source ID', async () => {
      const result = await service.getConfiguration(null as any);
      expect(result).toBeNull();
    });

    it('should return null for non-string source ID', async () => {
      const result = await service.getConfiguration(123 as any);
      expect(result).toBeNull();
    });

    /**
     * Test getting configuration from cache
     * Requirements: 2.3
     */
    it('should return cached configuration when cache is valid', async () => {
      const cachedConfig = {
        source_id: 'test_source',
        display_name: 'Test Source',
        enabled: true,
        priority: 1,
        rate_limit_ms: 1500,
        batch_size: 30,
        source_specific_config: {}
      };

      // Manually set cache
      (service as any).cache.set('test_source', cachedConfig);
      (service as any).cacheValid = true;

      const result = await service.getConfiguration('test_source');
      expect(result).toEqual(cachedConfig);
    });
  });

  describe('getAllConfigurations', () => {
    /**
     * Test getting all configurations without Supabase
     * Requirements: 2.3
     */
    it('should return cached configurations when Supabase is not initialized', async () => {
      const config1 = {
        source_id: 'source1',
        display_name: 'Source 1',
        enabled: true,
        priority: 1,
        rate_limit_ms: 1500,
        batch_size: 30,
        source_specific_config: {}
      };
      const config2 = {
        source_id: 'source2',
        display_name: 'Source 2',
        enabled: false,
        priority: 2,
        rate_limit_ms: 2000,
        batch_size: 20,
        source_specific_config: {}
      };

      (service as any).cache.set('source1', config1);
      (service as any).cache.set('source2', config2);

      const result = await service.getAllConfigurations();
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(config1);
      expect(result).toContainEqual(config2);
    });
  });

  describe('getEnabledConfigurations', () => {
    /**
     * Test getting enabled configurations sorted by priority
     * Requirements: 6.2, 6.3, 6.5
     */
    it('should return only enabled configurations sorted by priority', async () => {
      const configs = [
        { source_id: 'source_a', display_name: 'A', enabled: true, priority: 2, rate_limit_ms: 1500, batch_size: 30, source_specific_config: {} },
        { source_id: 'source_b', display_name: 'B', enabled: false, priority: 1, rate_limit_ms: 1500, batch_size: 30, source_specific_config: {} },
        { source_id: 'source_c', display_name: 'C', enabled: true, priority: 1, rate_limit_ms: 1500, batch_size: 30, source_specific_config: {} },
        { source_id: 'source_d', display_name: 'D', enabled: true, priority: 2, rate_limit_ms: 1500, batch_size: 30, source_specific_config: {} }
      ];

      for (const config of configs) {
        (service as any).cache.set(config.source_id, config);
      }

      const result = await service.getEnabledConfigurations();

      // Should only include enabled sources
      expect(result).toHaveLength(3);
      expect(result.every((c: any) => c.enabled)).toBe(true);

      // Should be sorted by priority, then alphabetically
      expect(result[0].source_id).toBe('source_c'); // priority 1
      expect(result[1].source_id).toBe('source_a'); // priority 2, 'a' < 'd'
      expect(result[2].source_id).toBe('source_d'); // priority 2, 'd' > 'a'
    });

    /**
     * Test disabled sources are excluded
     * Requirements: 6.5
     */
    it('should exclude disabled sources regardless of priority', async () => {
      const configs = [
        { source_id: 'high_priority', display_name: 'High', enabled: false, priority: 1, rate_limit_ms: 1500, batch_size: 30, source_specific_config: {} },
        { source_id: 'low_priority', display_name: 'Low', enabled: true, priority: 100, rate_limit_ms: 1500, batch_size: 30, source_specific_config: {} }
      ];

      for (const config of configs) {
        (service as any).cache.set(config.source_id, config);
      }

      const result = await service.getEnabledConfigurations();

      expect(result).toHaveLength(1);
      expect(result[0].source_id).toBe('low_priority');
    });
  });

  describe('updateConfiguration', () => {
    /**
     * Test validation of source ID
     * Requirements: 2.2
     */
    it('should throw error for invalid source ID', async () => {
      await expect(service.updateConfiguration('', { enabled: true }))
        .rejects.toThrow('Invalid source ID');
    });

    it('should throw error for null source ID', async () => {
      await expect(service.updateConfiguration(null as any, { enabled: true }))
        .rejects.toThrow('Invalid source ID');
    });

    /**
     * Test validation of updates object
     * Requirements: 2.2
     */
    it('should throw error for invalid updates object', async () => {
      await expect(service.updateConfiguration('test', null as any))
        .rejects.toThrow('Invalid updates object');
    });

    /**
     * Test validation of source_specific_config
     * Requirements: 2.5
     */
    it('should throw error for invalid source_specific_config (array)', async () => {
      await expect(service.updateConfiguration('test', { source_specific_config: [] as any }))
        .rejects.toThrow('Invalid source_specific_config');
    });

    it('should throw error for invalid source_specific_config (string)', async () => {
      await expect(service.updateConfiguration('test', { source_specific_config: 'invalid' as any }))
        .rejects.toThrow('Invalid source_specific_config');
    });

    it('should accept valid source_specific_config object', async () => {
      const existingConfig = {
        source_id: 'test',
        display_name: 'Test',
        enabled: false,
        priority: 1,
        rate_limit_ms: 1500,
        batch_size: 30,
        source_specific_config: {}
      };
      (service as any).cache.set('test', existingConfig);

      const result = await service.updateConfiguration('test', {
        source_specific_config: { key: 'value', nested: { a: 1 } }
      });

      expect(result.source_specific_config).toEqual({ key: 'value', nested: { a: 1 } });
    });

    /**
     * Test validation of numeric fields
     * Requirements: 2.2
     */
    it('should throw error for negative priority', async () => {
      await expect(service.updateConfiguration('test', { priority: -1 }))
        .rejects.toThrow('Invalid priority');
    });

    it('should throw error for non-numeric priority', async () => {
      await expect(service.updateConfiguration('test', { priority: 'high' as any }))
        .rejects.toThrow('Invalid priority');
    });

    it('should throw error for negative rate_limit_ms', async () => {
      await expect(service.updateConfiguration('test', { rate_limit_ms: -100 }))
        .rejects.toThrow('Invalid rate_limit_ms');
    });

    it('should throw error for zero batch_size', async () => {
      await expect(service.updateConfiguration('test', { batch_size: 0 }))
        .rejects.toThrow('Invalid batch_size');
    });

    it('should throw error for negative batch_size', async () => {
      await expect(service.updateConfiguration('test', { batch_size: -5 }))
        .rejects.toThrow('Invalid batch_size');
    });

    /**
     * Test cache-only update when Supabase is not available
     * Requirements: 2.2
     */
    it('should update cache when Supabase is not initialized', async () => {
      const existingConfig = {
        source_id: 'test',
        display_name: 'Test',
        enabled: false,
        priority: 100,
        rate_limit_ms: 1500,
        batch_size: 30,
        source_specific_config: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      (service as any).cache.set('test', existingConfig);

      const result = await service.updateConfiguration('test', {
        enabled: true,
        priority: 1
      });

      expect(result.enabled).toBe(true);
      expect(result.priority).toBe(1);
      expect(result.source_id).toBe('test');
    });

    it('should throw error when config not found in cache', async () => {
      await expect(service.updateConfiguration('nonexistent', { enabled: true }))
        .rejects.toThrow('Configuration not found');
    });
  });

  describe('setEnabled', () => {
    /**
     * Test validation of enabled parameter
     * Requirements: 2.2, 13.1, 13.2
     */
    it('should throw error for non-boolean enabled value', async () => {
      await expect(service.setEnabled('test', 'true' as any))
        .rejects.toThrow('Invalid enabled value');
    });

    it('should throw error for invalid source ID', async () => {
      await expect(service.setEnabled('', true))
        .rejects.toThrow('Invalid source ID');
    });

    /**
     * Test required config validation when enabling
     * Requirements: 3.3
     */
    it('should throw error when enabling source without configuration', async () => {
      await expect(service.setEnabled('nonexistent', true))
        .rejects.toThrow('Configuration not found');
    });

    it('should throw error when enabling source with missing display_name', async () => {
      const invalidConfig = {
        source_id: 'test',
        display_name: '',
        enabled: false,
        priority: 1,
        rate_limit_ms: 1500,
        batch_size: 30,
        source_specific_config: {}
      };
      (service as any).cache.set('test', invalidConfig);
      (service as any).cacheValid = true;

      await expect(service.setEnabled('test', true))
        .rejects.toThrow('Cannot enable source: display_name is required');
    });

    it('should throw error when enabling source with invalid rate_limit_ms', async () => {
      const invalidConfig = {
        source_id: 'test',
        display_name: 'Test',
        enabled: false,
        priority: 1,
        rate_limit_ms: -100,
        batch_size: 30,
        source_specific_config: {}
      };
      (service as any).cache.set('test', invalidConfig);
      (service as any).cacheValid = true;

      await expect(service.setEnabled('test', true))
        .rejects.toThrow('Cannot enable source: rate_limit_ms must be a non-negative number');
    });

    it('should throw error when enabling source with invalid batch_size', async () => {
      const invalidConfig = {
        source_id: 'test',
        display_name: 'Test',
        enabled: false,
        priority: 1,
        rate_limit_ms: 1500,
        batch_size: 0,
        source_specific_config: {}
      };
      (service as any).cache.set('test', invalidConfig);
      (service as any).cacheValid = true;

      await expect(service.setEnabled('test', true))
        .rejects.toThrow('Cannot enable source: batch_size must be a positive number');
    });

    /**
     * Test successful enable/disable
     * Requirements: 2.2, 13.1, 13.2
     */
    it('should successfully enable a valid source', async () => {
      const validConfig = {
        source_id: 'test',
        display_name: 'Test Source',
        enabled: false,
        priority: 1,
        rate_limit_ms: 1500,
        batch_size: 30,
        source_specific_config: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      (service as any).cache.set('test', validConfig);
      (service as any).cacheValid = true;

      const result = await service.setEnabled('test', true);
      expect(result.enabled).toBe(true);
    });

    it('should successfully disable a source without validation', async () => {
      const validConfig = {
        source_id: 'test',
        display_name: 'Test Source',
        enabled: true,
        priority: 1,
        rate_limit_ms: 1500,
        batch_size: 30,
        source_specific_config: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      (service as any).cache.set('test', validConfig);
      (service as any).cacheValid = true;

      const result = await service.setEnabled('test', false);
      expect(result.enabled).toBe(false);
    });
  });

  describe('createDefaultConfiguration', () => {
    /**
     * Test validation of metadata
     * Requirements: 2.4
     */
    it('should throw error for invalid metadata', async () => {
      await expect(service.createDefaultConfiguration(null as any))
        .rejects.toThrow('Invalid metadata: sourceId is required');
    });

    it('should throw error for metadata without sourceId', async () => {
      await expect(service.createDefaultConfiguration({} as any))
        .rejects.toThrow('Invalid metadata: sourceId is required');
    });

    /**
     * Test default configuration creation
     * Requirements: 2.4
     */
    it('should create default configuration with enabled=false', async () => {
      const metadata = {
        sourceId: 'new_source',
        displayName: 'New Source',
        description: 'A new book source',
        website: 'https://example.com',
        supportedFormats: ['pdf', 'epub'],
        defaultRateLimitMs: 2000,
        defaultBatchSize: 25
      };

      const result = await service.createDefaultConfiguration(metadata);

      expect(result.source_id).toBe('new_source');
      expect(result.display_name).toBe('New Source');
      expect(result.description).toBe('A new book source');
      expect(result.website).toBe('https://example.com');
      expect(result.enabled).toBe(false); // Default is disabled
      expect(result.priority).toBe(100); // Default priority
      expect(result.rate_limit_ms).toBe(2000);
      expect(result.batch_size).toBe(25);
      expect(result.supported_formats).toEqual(['pdf', 'epub']);
      expect(result.source_specific_config).toEqual({});
    });

    /**
     * Test Internet Archive special case
     * Requirements: 7.1
     */
    it('should create Internet Archive config with enabled=true', async () => {
      const metadata = {
        sourceId: 'internet_archive',
        displayName: 'Internet Archive',
        description: 'The Internet Archive',
        website: 'https://archive.org',
        supportedFormats: ['pdf'],
        defaultRateLimitMs: 1500,
        defaultBatchSize: 30
      };

      const result = await service.createDefaultConfiguration(metadata);

      expect(result.source_id).toBe('internet_archive');
      expect(result.enabled).toBe(true); // IA is enabled by default
      expect(result.priority).toBe(1); // IA has highest priority
    });

    /**
     * Test returning existing configuration
     * Requirements: 2.4
     */
    it('should return existing configuration if already exists', async () => {
      const existingConfig = {
        source_id: 'existing_source',
        display_name: 'Existing Source',
        enabled: true,
        priority: 5,
        rate_limit_ms: 3000,
        batch_size: 50,
        source_specific_config: { custom: 'value' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };
      (service as any).cache.set('existing_source', existingConfig);
      (service as any).cacheValid = true;

      const metadata = {
        sourceId: 'existing_source',
        displayName: 'Different Name',
        description: 'Different description',
        website: 'https://different.com',
        supportedFormats: ['txt'],
        defaultRateLimitMs: 1000,
        defaultBatchSize: 10
      };

      const result = await service.createDefaultConfiguration(metadata);

      // Should return existing config, not create new one
      expect(result).toEqual(existingConfig);
    });

    /**
     * Test default values when metadata is minimal
     * Requirements: 2.4
     */
    it('should use default values when metadata is minimal', async () => {
      const metadata = {
        sourceId: 'minimal_source'
      };

      const result = await service.createDefaultConfiguration(metadata as any);

      expect(result.source_id).toBe('minimal_source');
      expect(result.display_name).toBe('minimal_source'); // Falls back to sourceId
      expect(result.description).toBe('');
      expect(result.website).toBe('');
      expect(result.enabled).toBe(false);
      expect(result.priority).toBe(100);
      expect(result.rate_limit_ms).toBe(1500); // Default
      expect(result.batch_size).toBe(30); // Default
      expect(result.supported_formats).toEqual(['pdf']); // Default
    });
  });

  describe('cache management', () => {
    /**
     * Test cache invalidation
     */
    it('should invalidate cache', () => {
      (service as any).cacheValid = true;
      service.invalidateCache();
      expect((service as any).cacheValid).toBe(false);
    });

    /**
     * Test cache clearing
     */
    it('should clear cache completely', () => {
      (service as any).cache.set('test', { source_id: 'test' });
      (service as any).cacheValid = true;

      service.clearCache();

      expect((service as any).cache.size).toBe(0);
      expect((service as any).cacheValid).toBe(false);
    });
  });

  describe('exists', () => {
    /**
     * Test checking if source exists
     */
    it('should return true for existing source', async () => {
      (service as any).cache.set('existing', { source_id: 'existing' });
      (service as any).cacheValid = true;

      const result = await service.exists('existing');
      expect(result).toBe(true);
    });

    it('should return false for non-existing source', async () => {
      const result = await service.exists('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('deleteConfiguration', () => {
    /**
     * Test deleting configuration
     */
    it('should return false for invalid source ID', async () => {
      const result = await service.deleteConfiguration('');
      expect(result).toBe(false);
    });

    it('should remove from cache when Supabase not initialized', async () => {
      (service as any).cache.set('test', { source_id: 'test' });

      const result = await service.deleteConfiguration('test');

      expect(result).toBe(true);
      expect((service as any).cache.has('test')).toBe(false);
    });
  });
});
