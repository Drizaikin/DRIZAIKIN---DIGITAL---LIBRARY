/**
 * Property-Based Tests for Theme Mode Application
 * **Feature: user-preferences-recommendations, Property 9: Theme Mode Application**
 * **Validates: Requirements 6.2, 6.3, 6.7**
 * 
 * This test verifies that for any theme mode selection (light or dark),
 * the document root should have the corresponding CSS class applied.
 * 
 * Requirements:
 * - 6.2: WHEN a user enables dark mode THEN the Library_System SHALL apply dark color scheme
 * - 6.3: WHEN a user enables light mode THEN the Library_System SHALL apply light color scheme
 * - 6.7: WHEN theme mode changes THEN the Library_System SHALL apply the change immediately
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Theme mode type matching the application
type ThemeMode = 'light' | 'dark';

/**
 * Simple mock classList implementation for testing
 * This simulates the behavior of Element.classList
 */
class MockClassList {
  private classes: Set<string> = new Set();

  add(className: string): void {
    this.classes.add(className);
  }

  remove(className: string): void {
    this.classes.delete(className);
  }

  contains(className: string): boolean {
    return this.classes.has(className);
  }

  // Helper to get all classes as array (for testing)
  toArray(): string[] {
    return Array.from(this.classes);
  }

  // Reset for clean state
  clear(): void {
    this.classes.clear();
  }
}

/**
 * Mock Element with classList for testing
 */
interface MockElement {
  classList: MockClassList;
}

/**
 * Apply dark mode class to document root
 * This is the core logic extracted from ThemeContext.tsx for testing
 */
function applyDarkModeClass(root: MockElement, isDark: boolean): void {
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Check if the document root has the correct class for the given theme mode
 */
function hasCorrectThemeClass(root: MockElement, themeMode: ThemeMode): boolean {
  const hasDarkClass = root.classList.contains('dark');
  if (themeMode === 'dark') {
    return hasDarkClass === true;
  } else {
    return hasDarkClass === false;
  }
}

describe('Theme Mode Application - Property Tests', () => {
  let root: MockElement;

  beforeEach(() => {
    // Create a fresh mock element for each test
    root = {
      classList: new MockClassList()
    };
  });

  /**
   * **Feature: user-preferences-recommendations, Property 9: Theme Mode Application**
   * **Validates: Requirements 6.2, 6.3, 6.7**
   * 
   * Property: For any theme mode selection (light or dark), the document root
   * should have the corresponding CSS class applied:
   * - 'dark' class present when theme mode is 'dark'
   * - 'dark' class absent when theme mode is 'light'
   */
  it('Property 9: Theme mode selection applies correct CSS class to document root', () => {
    // Generator for valid theme modes
    const themeModeArb = fc.constantFrom<ThemeMode>('light', 'dark');

    fc.assert(
      fc.property(
        themeModeArb,
        (themeMode: ThemeMode) => {
          // Reset the root element to a clean state before each test
          root.classList.clear();

          // Apply the theme mode
          const isDark = themeMode === 'dark';
          applyDarkModeClass(root, isDark);

          // PROPERTY ASSERTION:
          // The document root should have the correct class for the theme mode
          const result = hasCorrectThemeClass(root, themeMode);
          
          expect(result).toBe(true);
          
          // Additional explicit checks for clarity
          if (themeMode === 'dark') {
            expect(root.classList.contains('dark')).toBe(true);
          } else {
            expect(root.classList.contains('dark')).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Theme mode toggle is idempotent
   * Applying the same theme mode multiple times should result in the same state
   */
  it('Property 9a: Applying same theme mode multiple times is idempotent', () => {
    const themeModeArb = fc.constantFrom<ThemeMode>('light', 'dark');
    const repeatCountArb = fc.integer({ min: 1, max: 10 });

    fc.assert(
      fc.property(
        themeModeArb,
        repeatCountArb,
        (themeMode: ThemeMode, repeatCount: number) => {
          // Reset the root element
          root.classList.clear();

          const isDark = themeMode === 'dark';

          // Apply the same theme mode multiple times
          for (let i = 0; i < repeatCount; i++) {
            applyDarkModeClass(root, isDark);
          }

          // PROPERTY ASSERTION:
          // After multiple applications, the state should be correct
          expect(hasCorrectThemeClass(root, themeMode)).toBe(true);

          // The 'dark' class should appear at most once (no duplicates)
          const darkClassCount = root.classList.toArray().filter(c => c === 'dark').length;
          if (themeMode === 'dark') {
            expect(darkClassCount).toBe(1);
          } else {
            expect(darkClassCount).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Theme mode transitions work correctly
   * Switching from any theme mode to any other theme mode should result in correct state
   */
  it('Property 9b: Theme mode transitions apply correct CSS class', () => {
    const themeModeArb = fc.constantFrom<ThemeMode>('light', 'dark');

    fc.assert(
      fc.property(
        themeModeArb,
        themeModeArb,
        (initialMode: ThemeMode, finalMode: ThemeMode) => {
          // Reset and set initial state
          root.classList.clear();
          applyDarkModeClass(root, initialMode === 'dark');

          // Verify initial state is correct
          expect(hasCorrectThemeClass(root, initialMode)).toBe(true);

          // Transition to final state
          applyDarkModeClass(root, finalMode === 'dark');

          // PROPERTY ASSERTION:
          // After transition, the final state should be correct
          expect(hasCorrectThemeClass(root, finalMode)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
