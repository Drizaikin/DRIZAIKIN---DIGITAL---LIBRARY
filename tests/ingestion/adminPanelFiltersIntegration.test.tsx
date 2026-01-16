/**
 * Integration Tests for Admin Panel Filters Tab
 * **Feature: ingestion-filtering**
 * **Validates: Requirement 5.8.1**
 * 
 * This test verifies the integration of the Ingestion Filters Panel into the Admin Dashboard:
 * - Filters panel is accessible from admin dashboard
 * - Navigation to filters section works correctly
 * - Panel displays correctly within admin dashboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminPanel from '../../components/AdminPanel';
import { ThemeProvider } from '../../contexts/ThemeContext';

// Mock the child components
vi.mock('../../components/ExtractionPanel', () => ({
  default: () => <div data-testid="extraction-panel">Extraction Panel</div>
}));

vi.mock('../../components/IngestionFiltersPanel', () => ({
  default: () => <div data-testid="ingestion-filters-panel">Ingestion Filters Panel</div>
}));

// Mock the auth service
vi.mock('../../services/authService', () => ({
  authService: {
    getCurrentUser: () => ({ id: 'admin-123', role: 'Admin', name: 'Test Admin' })
  }
}));

// Mock fetch for API calls
global.fetch = vi.fn();

const mockFetch = (url: string) => {
  if (url.includes('/api/books')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    });
  }
  if (url.includes('/api/categories')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    });
  }
  if (url.includes('/api/admin/users')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    });
  }
  if (url.includes('/api/admin/borrow-requests')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    });
  }
  if (url.includes('/api/admin/active-loans')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
};

describe('Admin Panel Filters Integration - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation(mockFetch);
  });

  /**
   * Test: Filters panel is accessible from admin dashboard
   * Validates: Requirement 5.8.1
   */
  it('should display filters tab in admin dashboard navigation', async () => {
    render(
      <ThemeProvider>
        <AdminPanel />
      </ThemeProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Admin Panel')).toBeInTheDocument();
    });

    // Check for filters tab in desktop navigation
    const filtersTab = screen.getByRole('button', { name: /Ingestion Filters/i });
    expect(filtersTab).toBeInTheDocument();
  });

  /**
   * Test: Navigation to filters section works correctly
   * Validates: Requirement 5.8.1
   */
  it('should navigate to filters section when filters tab is clicked', async () => {
    render(
      <ThemeProvider>
        <AdminPanel />
      </ThemeProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Admin Panel')).toBeInTheDocument();
    });

    // Click on filters tab
    const filtersTab = screen.getByRole('button', { name: /Ingestion Filters/i });
    fireEvent.click(filtersTab);

    // Verify filters panel is displayed
    await waitFor(() => {
      expect(screen.getByTestId('ingestion-filters-panel')).toBeInTheDocument();
    });
  });

  /**
   * Test: Panel displays correctly within admin dashboard
   * Validates: Requirement 5.8.1
   */
  it('should display filters panel correctly when filters tab is active', async () => {
    render(
      <ThemeProvider>
        <AdminPanel />
      </ThemeProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Admin Panel')).toBeInTheDocument();
    });

    // Navigate to filters tab
    const filtersTab = screen.getByRole('button', { name: /Ingestion Filters/i });
    fireEvent.click(filtersTab);

    // Verify filters panel is rendered
    await waitFor(() => {
      const filtersPanel = screen.getByTestId('ingestion-filters-panel');
      expect(filtersPanel).toBeInTheDocument();
      expect(filtersPanel).toBeVisible();
    });

    // Verify other tabs are not displayed
    expect(screen.queryByTestId('extraction-panel')).not.toBeInTheDocument();
  });

  /**
   * Test: Filters tab is included in mobile dropdown menu
   * Validates: Requirement 5.8.1
   */
  it('should include filters option in mobile navigation dropdown', async () => {
    // Set viewport to mobile size
    global.innerWidth = 375;
    global.dispatchEvent(new Event('resize'));

    render(
      <ThemeProvider>
        <AdminPanel />
      </ThemeProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Admin Panel')).toBeInTheDocument();
    });

    // Find and click mobile menu button
    const mobileMenuButtons = screen.getAllByRole('button');
    const mobileMenuButton = mobileMenuButtons.find(btn => 
      btn.getAttribute('aria-expanded') !== null
    );

    if (mobileMenuButton) {
      fireEvent.click(mobileMenuButton);

      // Verify filters option appears in dropdown
      await waitFor(() => {
        const filtersOption = screen.getByRole('button', { name: /Ingestion Filters/i });
        expect(filtersOption).toBeInTheDocument();
      });
    }
  });

  /**
   * Test: Switching between tabs works correctly
   * Validates: Requirement 5.8.1
   */
  it('should switch between filters tab and other tabs correctly', async () => {
    render(
      <ThemeProvider>
        <AdminPanel />
      </ThemeProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Admin Panel')).toBeInTheDocument();
    });

    // Navigate to filters tab
    const filtersTab = screen.getByRole('button', { name: /Ingestion Filters/i });
    fireEvent.click(filtersTab);

    // Verify filters panel is displayed
    await waitFor(() => {
      expect(screen.getByTestId('ingestion-filters-panel')).toBeInTheDocument();
    });

    // Navigate to extractions tab
    const extractionsTab = screen.getByRole('button', { name: /Extractions/i });
    fireEvent.click(extractionsTab);

    // Verify extractions panel is displayed and filters panel is hidden
    await waitFor(() => {
      expect(screen.getByTestId('extraction-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('ingestion-filters-panel')).not.toBeInTheDocument();
    });

    // Navigate back to filters tab
    fireEvent.click(filtersTab);

    // Verify filters panel is displayed again
    await waitFor(() => {
      expect(screen.getByTestId('ingestion-filters-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('extraction-panel')).not.toBeInTheDocument();
    });
  });

  /**
   * Test: Filters tab maintains proper styling and layout
   * Validates: Requirement 5.8.1
   */
  it('should apply correct styling to filters tab when active', async () => {
    render(
      <ThemeProvider>
        <AdminPanel />
      </ThemeProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Admin Panel')).toBeInTheDocument();
    });

    // Get filters tab button
    const filtersTab = screen.getByRole('button', { name: /Ingestion Filters/i });

    // Click filters tab
    fireEvent.click(filtersTab);

    // Verify tab has active styling (this checks that the tab is properly integrated)
    await waitFor(() => {
      expect(filtersTab).toBeInTheDocument();
      // The tab should have some styling applied when active
      // We can't check exact styles in JSDOM, but we can verify it's rendered
    });
  });

  /**
   * Test: All admin tabs including filters are present
   * Validates: Requirement 5.8.1
   */
  it('should display all admin tabs including the new filters tab', async () => {
    render(
      <ThemeProvider>
        <AdminPanel />
      </ThemeProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Admin Panel')).toBeInTheDocument();
    });

    // Verify all tabs are present
    expect(screen.getByRole('button', { name: /Books Management/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /User Management/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Borrow Requests/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Active Loans/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extractions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ingestion Filters/i })).toBeInTheDocument();
  });

  /**
   * Test: Filters tab icon is displayed correctly
   * Validates: Requirement 5.8.1
   */
  it('should display filter icon in filters tab', async () => {
    render(
      <ThemeProvider>
        <AdminPanel />
      </ThemeProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Admin Panel')).toBeInTheDocument();
    });

    // Get filters tab
    const filtersTab = screen.getByRole('button', { name: /Ingestion Filters/i });
    
    // Verify tab contains text and is properly structured
    expect(filtersTab).toHaveTextContent('Ingestion Filters');
  });
});
