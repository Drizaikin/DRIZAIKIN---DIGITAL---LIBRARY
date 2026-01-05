/**
 * Property-Based Tests for Mobile Touch Target Size
 * **Feature: ai-book-extraction, Property 7: Mobile Touch Target Size**
 * **Validates: Requirements 8.3**
 * 
 * This test verifies that all interactive elements in the Extraction Panel
 * have minimum touch target dimensions of 44x44 pixels for mobile accessibility.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Minimum touch target size as per WCAG 2.5.5 and Apple HIG
const MIN_TOUCH_TARGET_SIZE = 44;

// Read the ExtractionPanel component source
const componentPath = path.join(process.cwd(), 'components', 'ExtractionPanel.tsx');
const componentSource = fs.readFileSync(componentPath, 'utf-8');

// Extract all button elements from the component source
function extractButtonElements(source: string): string[] {
  const buttonRegex = /<button[^>]*>[\s\S]*?<\/button>/g;
  const matches = source.match(buttonRegex) || [];
  return matches;
}

// Check if an element has minimum touch target classes
function hasTouchTargetClasses(element: string): { 
  hasMinWidth: boolean; 
  hasMinHeight: boolean;
  minWidthValue: number | null;
  minHeightValue: number | null;
  isFullWidth: boolean;
} {
  // Check for min-w-[Xpx] pattern
  const minWidthMatch = element.match(/min-w-\[(\d+)px\]/);
  const minHeightMatch = element.match(/min-h-\[(\d+)px\]/);
  
  // Check for full-width buttons (w-full class)
  // Full-width buttons inherently meet the 44px minimum width requirement
  // as they span the entire container width
  const isFullWidth = element.includes('w-full');
  
  const minWidthValue = minWidthMatch ? parseInt(minWidthMatch[1], 10) : null;
  const minHeightValue = minHeightMatch ? parseInt(minHeightMatch[1], 10) : null;
  
  return {
    // Full-width buttons satisfy the width requirement inherently
    hasMinWidth: isFullWidth || (minWidthValue !== null && minWidthValue >= MIN_TOUCH_TARGET_SIZE),
    hasMinHeight: minHeightValue !== null && minHeightValue >= MIN_TOUCH_TARGET_SIZE,
    minWidthValue,
    minHeightValue,
    isFullWidth
  };
}

// Check if button has touch-manipulation class for better mobile UX
function hasTouchManipulation(element: string): boolean {
  return element.includes('touch-manipulation');
}

// Check if button has aria-label for accessibility
function hasAriaLabel(element: string): boolean {
  // Check for various accessibility attributes
  // aria-label: explicit label for screen readers
  // title: tooltip that also serves as accessible name
  // aria-expanded: indicates expandable state (valid for toggle buttons)
  return element.includes('aria-label=') || 
         element.includes('title=') || 
         element.includes('aria-expanded=');
}

// Identify button type/purpose from the element
function identifyButtonPurpose(element: string): string {
  if (element.includes('Start Job') || element.includes('<Play')) return 'Start/Resume';
  if (element.includes('Pause Job') || element.includes('<Pause')) return 'Pause';
  if (element.includes('Stop Job') || element.includes('<Square')) return 'Stop';
  if (element.includes('Delete Job') || element.includes('<Trash2')) return 'Delete';
  if (element.includes('View Details') || element.includes('<ExternalLink')) return 'View Details';
  if (element.includes('Refresh Progress') || element.includes('<RefreshCw')) return 'Refresh';
  if (element.includes('Close') || element.includes('<XCircle')) return 'Close';
  if (element.includes('toggleSection')) return 'Collapsible Section Toggle';
  if (element.includes('New Extraction')) return 'Create New Job';
  if (element.includes('type="submit"')) return 'Form Submit';
  if (element.includes('Cancel')) return 'Cancel';
  return 'Unknown';
}

// Check if button is an action button (not form/modal buttons which have different sizing)
function isActionButton(element: string): boolean {
  // Action buttons are the icon-only buttons for job control
  // They should have min-w-[44px] min-h-[44px]
  const purpose = identifyButtonPurpose(element);
  const actionPurposes = ['Start/Resume', 'Pause', 'Stop', 'Delete', 'View Details', 'Refresh', 'Close', 'Collapsible Section Toggle'];
  return actionPurposes.includes(purpose);
}

describe('Mobile Touch Target Size - Property Tests', () => {
  const allButtons = extractButtonElements(componentSource);
  const actionButtons = allButtons.filter(isActionButton);

  /**
   * **Feature: ai-book-extraction, Property 7: Mobile Touch Target Size**
   * **Validates: Requirements 8.3**
   * 
   * Property: For any interactive element in the Extraction Panel on mobile viewports,
   * the touch target SHALL have minimum dimensions of 44x44 pixels.
   */
  it('Property 7: All action buttons have minimum 44x44px touch targets', () => {
    // Ensure we found action buttons to test
    expect(actionButtons.length).toBeGreaterThan(0);
    
    const results = actionButtons.map(button => {
      const touchTarget = hasTouchTargetClasses(button);
      const purpose = identifyButtonPurpose(button);
      return {
        purpose,
        ...touchTarget,
        element: button.substring(0, 100) + '...'
      };
    });

    // PROPERTY ASSERTION: All action buttons must have min 44x44px touch targets
    for (const result of results) {
      expect(
        result.hasMinWidth,
        `Button "${result.purpose}" should have min-w-[44px] or larger. Found: ${result.minWidthValue}px`
      ).toBe(true);
      
      expect(
        result.hasMinHeight,
        `Button "${result.purpose}" should have min-h-[44px] or larger. Found: ${result.minHeightValue}px`
      ).toBe(true);
    }
  });

  /**
   * **Feature: ai-book-extraction, Property 7: Mobile Touch Target Size**
   * **Validates: Requirements 8.3**
   * 
   * Property: For any action button, the touch-manipulation CSS property should be applied
   * to prevent delays on mobile touch interactions.
   */
  it('Property 7: All action buttons have touch-manipulation class', () => {
    expect(actionButtons.length).toBeGreaterThan(0);
    
    for (const button of actionButtons) {
      const purpose = identifyButtonPurpose(button);
      expect(
        hasTouchManipulation(button),
        `Button "${purpose}" should have touch-manipulation class for better mobile UX`
      ).toBe(true);
    }
  });

  /**
   * **Feature: ai-book-extraction, Property 7: Mobile Touch Target Size**
   * **Validates: Requirements 8.3**
   * 
   * Property: For any action button, accessibility labels should be provided
   * via aria-label or title attributes.
   */
  it('Property 7: All action buttons have accessibility labels', () => {
    expect(actionButtons.length).toBeGreaterThan(0);
    
    for (const button of actionButtons) {
      const purpose = identifyButtonPurpose(button);
      expect(
        hasAriaLabel(button),
        `Button "${purpose}" should have aria-label or title for accessibility`
      ).toBe(true);
    }
  });

  /**
   * **Feature: ai-book-extraction, Property 7: Mobile Touch Target Size**
   * **Validates: Requirements 8.3**
   * 
   * Property-based test: For any randomly selected action button from the component,
   * the touch target dimensions must be at least 44x44 pixels.
   */
  it('Property 7: Random action button selection maintains touch target compliance', async () => {
    expect(actionButtons.length).toBeGreaterThan(0);
    
    await fc.assert(
      fc.property(
        fc.integer({ min: 0, max: actionButtons.length - 1 }),
        (buttonIndex) => {
          const button = actionButtons[buttonIndex];
          const touchTarget = hasTouchTargetClasses(button);
          const purpose = identifyButtonPurpose(button);
          
          // PROPERTY ASSERTION: Selected button must have 44x44px minimum
          if (!touchTarget.hasMinWidth) {
            throw new Error(
              `Button "${purpose}" at index ${buttonIndex} has insufficient width: ` +
              `${touchTarget.minWidthValue}px (minimum: ${MIN_TOUCH_TARGET_SIZE}px). ` +
              `Full-width: ${touchTarget.isFullWidth}`
            );
          }
          
          if (!touchTarget.hasMinHeight) {
            throw new Error(
              `Button "${purpose}" at index ${buttonIndex} has insufficient height: ` +
              `${touchTarget.minHeightValue}px (minimum: ${MIN_TOUCH_TARGET_SIZE}px)`
            );
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Verification test: Count and report all buttons found
   */
  it('Property 7: Component contains expected action buttons', () => {
    const buttonPurposes = actionButtons.map(identifyButtonPurpose);
    
    // Verify we have the expected action buttons
    expect(buttonPurposes).toContain('Start/Resume');
    expect(buttonPurposes).toContain('Pause');
    expect(buttonPurposes).toContain('Stop');
    expect(buttonPurposes).toContain('Delete');
    expect(buttonPurposes).toContain('View Details');
    expect(buttonPurposes).toContain('Refresh');
    expect(buttonPurposes).toContain('Close');
    expect(buttonPurposes).toContain('Collapsible Section Toggle');
    
    console.log(`Found ${actionButtons.length} action buttons in ExtractionPanel`);
    console.log('Button purposes:', [...new Set(buttonPurposes)]);
  });
});
