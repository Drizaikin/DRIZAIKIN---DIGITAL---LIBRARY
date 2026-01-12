/**
 * Property-Based Tests for Action Logging Completeness
 * **Feature: admin-health-dashboard, Property 4: Action Logging Completeness**
 * **Validates: Requirements 7.5, 7.6**
 * 
 * This test verifies that for any admin action triggered through the Health_API,
 * the action SHALL be logged with a timestamp and the action type before returning
 * a response.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Import the logging functions from the actions API
import { 
  logAction, 
  getActionLogs, 
  clearActionLogs,
  validateAuthorization 
} from '../../api/admin/health/actions.js';

// Store original env value
let originalAdminSecret: string | undefined;

describe('Action Logging Completeness - Property Tests', () => {
  beforeEach(() => {
    // Store original value and clear logs
    originalAdminSecret = process.env.ADMIN_HEALTH_SECRET;
    clearActionLogs();
  });

  afterEach(() => {
    // Restore original value
    if (originalAdminSecret !== undefined) {
      process.env.ADMIN_HEALTH_SECRET = originalAdminSecret;
    } else {
      delete process.env.ADMIN_HEALTH_SECRET;
    }
    clearActionLogs();
  });

  /**
   * **Feature: admin-health-dashboard, Property 4: Action Logging Completeness**
   * **Validates: Requirement 7.5**
   * 
   * Property: For any admin action, the log entry SHALL contain a timestamp
   */
  it('Property 4a: Every logged action has a valid timestamp', () => {
    fc.assert(
      fc.property(
        // Generate random action names
        fc.constantFrom(
          'trigger_ingestion',
          'trigger_maintenance',
          'pause_ingestion',
          'resume_ingestion'
        ),
        // Generate random admin IDs
        fc.string({ minLength: 1, maxLength: 32 }),
        (action, adminId) => {
          const logEntry = logAction(action, adminId, { test: true });
          
          // Verify timestamp exists and is valid ISO format
          expect(logEntry.timestamp).toBeDefined();
          expect(typeof logEntry.timestamp).toBe('string');
          
          // Verify it's a valid ISO date string
          const parsedDate = new Date(logEntry.timestamp);
          expect(parsedDate.toString()).not.toBe('Invalid Date');
          
          // Verify timestamp is recent (within last minute)
          const now = Date.now();
          const logTime = parsedDate.getTime();
          expect(logTime).toBeLessThanOrEqual(now);
          expect(logTime).toBeGreaterThan(now - 60000);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 7.5**
   * 
   * Property: For any admin action, the log entry SHALL contain the action type
   */
  it('Property 4b: Every logged action has the action type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'trigger_ingestion',
          'trigger_maintenance',
          'pause_ingestion',
          'resume_ingestion'
        ),
        fc.string({ minLength: 1, maxLength: 32 }),
        (action, adminId) => {
          const logEntry = logAction(action, adminId, {});
          
          // Verify action type is recorded
          expect(logEntry.action).toBe(action);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 7.5**
   * 
   * Property: For any admin action, the log entry SHALL contain the admin identifier
   */
  it('Property 4c: Every logged action has the admin identifier', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'trigger_ingestion',
          'trigger_maintenance',
          'pause_ingestion',
          'resume_ingestion'
        ),
        fc.string({ minLength: 1, maxLength: 32 }),
        (action, adminId) => {
          const logEntry = logAction(action, adminId, {});
          
          // Verify admin ID is recorded
          expect(logEntry.adminId).toBe(adminId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 7.5**
   * 
   * Property: All logged actions are retrievable via getActionLogs
   */
  it('Property 4d: All logged actions are retrievable', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of actions
        fc.array(
          fc.record({
            action: fc.constantFrom(
              'trigger_ingestion',
              'trigger_maintenance',
              'pause_ingestion',
              'resume_ingestion'
            ),
            adminId: fc.string({ minLength: 1, maxLength: 16 })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (actions) => {
          clearActionLogs();
          
          // Log all actions
          const loggedEntries = actions.map(({ action, adminId }) => 
            logAction(action, adminId, {})
          );
          
          // Retrieve logs
          const retrievedLogs = getActionLogs(actions.length);
          
          // Verify all actions are present
          expect(retrievedLogs.length).toBe(actions.length);
          
          // Verify each logged action matches
          for (let i = 0; i < actions.length; i++) {
            expect(retrievedLogs[i].action).toBe(actions[i].action);
            expect(retrievedLogs[i].adminId).toBe(actions[i].adminId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 7.5**
   * 
   * Property: Log entries are ordered chronologically
   */
  it('Property 4e: Log entries are chronologically ordered', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            'trigger_ingestion',
            'trigger_maintenance',
            'pause_ingestion',
            'resume_ingestion'
          ),
          { minLength: 2, maxLength: 10 }
        ),
        (actions) => {
          clearActionLogs();
          
          // Log actions sequentially
          actions.forEach((action, index) => {
            logAction(action, `admin-${index}`, {});
          });
          
          // Retrieve logs
          const logs = getActionLogs(actions.length);
          
          // Verify chronological order
          for (let i = 1; i < logs.length; i++) {
            const prevTime = new Date(logs[i - 1].timestamp).getTime();
            const currTime = new Date(logs[i].timestamp).getTime();
            expect(currTime).toBeGreaterThanOrEqual(prevTime);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 7.5**
   * 
   * Property: Log limit parameter works correctly
   */
  it('Property 4f: Log limit parameter returns correct number of entries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 20 }),
        fc.integer({ min: 1, max: 10 }),
        (totalActions, limit) => {
          clearActionLogs();
          
          // Log multiple actions
          for (let i = 0; i < totalActions; i++) {
            logAction('trigger_ingestion', `admin-${i}`, {});
          }
          
          // Retrieve with limit
          const logs = getActionLogs(limit);
          
          // Should return min(limit, totalActions) entries
          const expectedCount = Math.min(limit, totalActions);
          expect(logs.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 7.5**
   * 
   * Property: Missing admin ID defaults to 'unknown'
   */
  it('Property 4g: Missing admin ID defaults to unknown', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'trigger_ingestion',
          'trigger_maintenance',
          'pause_ingestion',
          'resume_ingestion'
        ),
        (action) => {
          // Log with undefined/null admin ID
          const logEntry1 = logAction(action, undefined as any, {});
          const logEntry2 = logAction(action, null as any, {});
          const logEntry3 = logAction(action, '', {});
          
          // Should default to 'unknown' for falsy values
          expect(logEntry1.adminId).toBe('unknown');
          expect(logEntry2.adminId).toBe('unknown');
          expect(logEntry3.adminId).toBe('unknown');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirement 7.5**
   * 
   * Property: Log entry contains success status
   */
  it('Property 4h: Log entry contains success status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'trigger_ingestion',
          'trigger_maintenance',
          'pause_ingestion',
          'resume_ingestion'
        ),
        fc.boolean(),
        (action, success) => {
          const logEntry = logAction(action, 'admin', { success });
          
          // Verify success status is recorded
          expect(typeof logEntry.success).toBe('boolean');
          expect(logEntry.success).toBe(success);
        }
      ),
      { numRuns: 100 }
    );
  });
});
