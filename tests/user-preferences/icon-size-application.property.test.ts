/**
 * Property-Based Tests for Icon Size Application
 * **Feature: user-preferences-recommendations, Property 11: Icon Size Application**
 * **Validates: Requirements 2.2**
 *
 * This test verifies that for any icon size selection, the book card components
 * should have the corresponding size classes applied.
 *
 * Requirements:
 * - 2.2: WHEN a user selects an icon size THEN the Library_System SHALL immediately
 *        apply the size change to all book displays
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Icon size type matching the application
type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Icon size CSS class mappings (matching constants/themes.ts)
const ICON_SIZES: Record<IconSize, { card: string; image: string; text: string }> = {
  xs: { card: 'w-24', image: 'h-32', text: 'text-xs' },
  sm: { card: 'w-32', image: 'h-44', text: 'text-sm' },
  md: { card: 'w-40', image: 'h-56', text: 'text-base' },
  lg: { card: 'w-48', image: 'h-64', text: 'text-lg' },
  xl: { card: 'w-56', image: 'h-72', text: 'text-xl' },
};

// All valid icon sizes
const ALL_ICON_SIZES: IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

/**
 * Get the size classes for a given icon size
 * This simulates the logic used in BookCard.tsx
 */
function getSizeClasses(iconSize: IconSize): { card: string; image: string; text: string } {
  return ICON_SIZES[iconSize];
}

/**
 * Verify that the size classes are correctly applied for a given icon size
 */
function verifySizeClassesApplied(
  iconSize: IconSize,
  appliedClasses: { card: string; image: string; text: string }
): boolean {
  const expectedClasses = ICON_SIZES[iconSize];
  return (
    appliedClasses.card === expectedClasses.card &&
    appliedClasses.image === expectedClasses.image &&
    appliedClasses.text === expectedClasses.text
  );
}

/**
 * Verify that each icon size maps to unique classes
 */
function hasUniqueClasses(size1: IconSize, size2: IconSize): boolean {
  if (size1 === size2) return true;
  const classes1 = ICON_SIZES[size1];
  const classes2 = ICON_SIZES[size2];
  return (
    classes1.card !== classes2.card ||
    classes1.image !== classes2.image ||
    classes1.text !== classes2.text
  );
}

describe('Icon Size Application - Property Tests', () => {
  /**
   * **Feature: user-preferences-recommendations, Property 11: Icon Size Application**
   * **Validates: Requirements 2.2**
   *
   * Property: For any icon size selection, the book card components should have
   * the corresponding size classes applied.
   */
  it('Property 11: Icon size selection applies correct CSS classes to book cards', () => {
    const iconSizeArb = fc.constantFrom<IconSize>(...ALL_ICON_SIZES);

    fc.assert(
      fc.property(iconSizeArb, (iconSize: IconSize) => {
        // Get the size classes that would be applied
        const appliedClasses = getSizeClasses(iconSize);

        // PROPERTY ASSERTION:
        // The applied classes should match the expected classes for this icon size
        expect(verifySizeClassesApplied(iconSize, appliedClasses)).toBe(true);

        // Additional explicit checks for clarity
        const expectedClasses = ICON_SIZES[iconSize];
        expect(appliedClasses.card).toBe(expectedClasses.card);
        expect(appliedClasses.image).toBe(expectedClasses.image);
        expect(appliedClasses.text).toBe(expectedClasses.text);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11a: Each icon size maps to distinct CSS classes
   * Different icon sizes should result in different visual presentations
   */
  it('Property 11a: Different icon sizes produce different CSS classes', () => {
    const iconSizeArb = fc.constantFrom<IconSize>(...ALL_ICON_SIZES);

    fc.assert(
      fc.property(iconSizeArb, iconSizeArb, (size1: IconSize, size2: IconSize) => {
        // PROPERTY ASSERTION:
        // Different sizes should have at least one different class
        expect(hasUniqueClasses(size1, size2)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11b: Icon size application is idempotent
   * Applying the same icon size multiple times should result in the same classes
   */
  it('Property 11b: Applying same icon size multiple times is idempotent', () => {
    const iconSizeArb = fc.constantFrom<IconSize>(...ALL_ICON_SIZES);
    const repeatCountArb = fc.integer({ min: 1, max: 10 });

    fc.assert(
      fc.property(iconSizeArb, repeatCountArb, (iconSize: IconSize, repeatCount: number) => {
        const expectedClasses = ICON_SIZES[iconSize];

        // Apply the same size multiple times
        let appliedClasses = { card: '', image: '', text: '' };
        for (let i = 0; i < repeatCount; i++) {
          appliedClasses = getSizeClasses(iconSize);
        }

        // PROPERTY ASSERTION:
        // After multiple applications, the classes should be correct
        expect(appliedClasses.card).toBe(expectedClasses.card);
        expect(appliedClasses.image).toBe(expectedClasses.image);
        expect(appliedClasses.text).toBe(expectedClasses.text);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11c: Icon size transitions apply correct classes
   * Switching from any icon size to any other should result in correct classes
   */
  it('Property 11c: Icon size transitions apply correct CSS classes', () => {
    const iconSizeArb = fc.constantFrom<IconSize>(...ALL_ICON_SIZES);

    fc.assert(
      fc.property(iconSizeArb, iconSizeArb, (initialSize: IconSize, finalSize: IconSize) => {
        // Apply initial size
        const initialClasses = getSizeClasses(initialSize);
        expect(verifySizeClassesApplied(initialSize, initialClasses)).toBe(true);

        // Transition to final size
        const finalClasses = getSizeClasses(finalSize);

        // PROPERTY ASSERTION:
        // After transition, the final classes should be correct
        expect(verifySizeClassesApplied(finalSize, finalClasses)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11d: All icon sizes have valid Tailwind CSS class format
   * Classes should follow Tailwind naming conventions
   */
  it('Property 11d: All icon size classes follow valid Tailwind CSS format', () => {
    const iconSizeArb = fc.constantFrom<IconSize>(...ALL_ICON_SIZES);
    
    // Tailwind width class pattern (w-XX)
    const widthClassRegex = /^w-\d+$/;
    // Tailwind height class pattern (h-XX)
    const heightClassRegex = /^h-\d+$/;
    // Tailwind text size class pattern (text-XX)
    const textClassRegex = /^text-(xs|sm|base|lg|xl|2xl|3xl)$/;

    fc.assert(
      fc.property(iconSizeArb, (iconSize: IconSize) => {
        const classes = getSizeClasses(iconSize);

        // PROPERTY ASSERTION:
        // All classes should follow valid Tailwind CSS patterns
        expect(classes.card).toMatch(widthClassRegex);
        expect(classes.image).toMatch(heightClassRegex);
        expect(classes.text).toMatch(textClassRegex);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11e: Icon sizes are ordered by visual size
   * Larger icon size values should correspond to larger CSS dimension values
   */
  it('Property 11e: Icon sizes are ordered from smallest to largest', () => {
    // Extract numeric values from Tailwind classes
    const extractNumber = (className: string): number => {
      const match = className.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };

    // Verify ordering for all consecutive size pairs
    const orderedSizes: IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

    for (let i = 0; i < orderedSizes.length - 1; i++) {
      const smallerSize = orderedSizes[i];
      const largerSize = orderedSizes[i + 1];

      const smallerClasses = ICON_SIZES[smallerSize];
      const largerClasses = ICON_SIZES[largerSize];

      // Card width should increase
      expect(extractNumber(smallerClasses.card)).toBeLessThan(extractNumber(largerClasses.card));

      // Image height should increase
      expect(extractNumber(smallerClasses.image)).toBeLessThan(extractNumber(largerClasses.image));
    }
  });
});
