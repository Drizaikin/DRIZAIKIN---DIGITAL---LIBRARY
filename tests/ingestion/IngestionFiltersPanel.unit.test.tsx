/**
 * Unit Tests for Ingestion Filters Panel Component
 * 
 * Tests the React component for managing ingestion filter configuration.
 * 
 * Requirements: 5.8.1-5.8.7
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import IngestionFiltersPanel from '../../components/IngestionFiltersPanel';

// Mock the genre taxonomy
vi.mock('../../services/ingestion/genreTaxonomy', () => ({
  PRIMARY_GENRES: [
    'Philosophy',
    'Religion',
    'History',
    'Science',
    'Literature',
    'Fiction'
  ]
}));

// Mock the theme hook
vi.mock('../../hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#d4af37',
      primaryBg: '#0a0a0a',
      secondarySurface: '#1a1a1a',
      primaryText: '#e5e5e5',
      mutedText: '#a0a0a0',
      logoAccent: '#d4af37'
    }
  })
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('IngestionFiltersPanel - Unit Tests', () => {
  
  beforeEach(() => {
    // Reset fetch mock
    vi.clearAllMocks();
    
    // Mock localStorage
    Storage.prototype.getItem = vi.fn(() => 'test-secret-123');
    
    // Default successful responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/admin/ingestion/filters')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            config: {
              allowedGenres: ['Philosophy', 'History'],
              allowedAuthors: ['Robin Sharma', 'Paulo Coelho'],
              enableGenreFilter: true,
              enableAuthorFilter: false
            },
            availableGenres: ['Philosophy', 'Religion', 'History', 'Science', 'Literature', 'Fiction']
          })
        });
      }
      if (url.includes('/admin/ingestion/filter-stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            statistics: {
              totalEvaluated: 1000,
              passed: 450,
              filtered: 550,
              filteredByGenre: 400,
              filteredByAuthor: 150,
              jobsAnalyzed: 10,
              topFilteredGenres: [],
              topFilteredAuthors: []
            }
          })
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('Component Rendering', () => {
    
    it('should render the component correctly', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Ingestion Filters')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/Configure which books to ingest/i)).toBeInTheDocument();
      expect(screen.getByText('Filter Configuration')).toBeInTheDocument();
      expect(screen.getByText('Filter Statistics')).toBeInTheDocument();
    });
    
    it('should show loading state initially', () => {
      render(<IngestionFiltersPanel />);
      
      // Check for loading spinner (animated div)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
    
    it('should display genre filter section', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Genre Filter')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/Select genres to allow/i)).toBeInTheDocument();
    });
    
    it('should display author filter section', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Author Filter')).toBeInTheDocument();
      });
      
      expect(screen.getByPlaceholderText(/e.g., Robin Sharma/i)).toBeInTheDocument();
    });
    
    it('should display action buttons', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Save Configuration')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
    });
  });
  
  describe('Genre Dropdown Population', () => {
    
    it('should populate genre dropdown from taxonomy', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Philosophy')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Religion')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Science')).toBeInTheDocument();
      expect(screen.getByText('Literature')).toBeInTheDocument();
      expect(screen.getByText('Fiction')).toBeInTheDocument();
    });
    
    it('should show selected genres from loaded configuration', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        const philosophyButton = screen.getByText('Philosophy');
        expect(philosophyButton).toBeInTheDocument();
      });
      
      // Check that Philosophy and History are selected (from mock config)
      const philosophyButton = screen.getByText('Philosophy');
      const historyButton = screen.getByText('History');
      
      // Selected buttons should have different styling (backgroundColor = accent color)
      expect(philosophyButton).toHaveStyle({ backgroundColor: '#d4af37' });
      expect(historyButton).toHaveStyle({ backgroundColor: '#d4af37' });
    });
    
    it('should display genre count when genres are selected', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('2 genres selected')).toBeInTheDocument();
      });
    });
  });
  
  describe('Author Input', () => {
    
    it('should accept comma-separated author values', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        const authorInput = screen.getByPlaceholderText(/e.g., Robin Sharma/i) as HTMLTextAreaElement;
        expect(authorInput).toBeInTheDocument();
      });
      
      const authorInput = screen.getByPlaceholderText(/e.g., Robin Sharma/i) as HTMLTextAreaElement;
      
      fireEvent.change(authorInput, {
        target: { value: 'Author One, Author Two, Author Three' }
      });
      
      expect(authorInput.value).toBe('Author One, Author Two, Author Three');
    });
    
    it('should load existing authors from configuration', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        const authorInput = screen.getByPlaceholderText(/e.g., Robin Sharma/i) as HTMLTextAreaElement;
        expect(authorInput.value).toBe('Robin Sharma, Paulo Coelho');
      });
    });
  });
  
  describe('Save Button', () => {
    
    it('should trigger API call when save button is clicked', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Save Configuration')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Configuration');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/admin/ingestion/filters'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-secret-123'
            })
          })
        );
      });
    });
    
    it('should show success message after successful save', async () => {
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        // Default GET responses
        if (url.includes('/admin/ingestion/filters')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              config: {
                allowedGenres: [],
                allowedAuthors: [],
                enableGenreFilter: false,
                enableAuthorFilter: false
              }
            })
          });
        }
        if (url.includes('/admin/ingestion/filter-stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              statistics: {
                totalEvaluated: 0,
                passed: 0,
                filtered: 0,
                filteredByGenre: 0,
                filteredByAuthor: 0,
                jobsAnalyzed: 0,
                topFilteredGenres: [],
                topFilteredAuthors: []
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Save Configuration')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Configuration');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      });
    });
    
    it('should disable save button while saving', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Save Configuration')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Configuration') as HTMLButtonElement;
      fireEvent.click(saveButton);
      
      // Button should be disabled immediately
      expect(saveButton).toBeDisabled();
    });
  });
  
  describe('Clear Button', () => {
    
    it('should reset configuration when clear button is clicked', async () => {
      // Mock window.confirm
      global.confirm = vi.fn(() => true);
      
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
      });
      
      const clearButton = screen.getByText('Clear All Filters');
      fireEvent.click(clearButton);
      
      expect(global.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Are you sure')
      );
      
      // Check that author input is cleared
      await waitFor(() => {
        const authorInput = screen.getByPlaceholderText(/e.g., Robin Sharma/i) as HTMLTextAreaElement;
        expect(authorInput.value).toBe('');
      });
    });
    
    it('should not reset configuration if user cancels', async () => {
      // Mock window.confirm to return false
      global.confirm = vi.fn(() => false);
      
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
      });
      
      const clearButton = screen.getByText('Clear All Filters');
      fireEvent.click(clearButton);
      
      // Configuration should remain unchanged
      await waitFor(() => {
        const authorInput = screen.getByPlaceholderText(/e.g., Robin Sharma/i) as HTMLTextAreaElement;
        expect(authorInput.value).toBe('Robin Sharma, Paulo Coelho');
      });
    });
  });
  
  describe('Validation Errors', () => {
    
    it('should display validation errors when save fails', async () => {
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
              success: false,
              errors: ['Invalid genres: InvalidGenre']
            })
          });
        }
        // Default GET responses
        if (url.includes('/admin/ingestion/filters')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              config: {
                allowedGenres: [],
                allowedAuthors: [],
                enableGenreFilter: false,
                enableAuthorFilter: false
              }
            })
          });
        }
        if (url.includes('/admin/ingestion/filter-stats')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              statistics: {
                totalEvaluated: 0,
                passed: 0,
                filtered: 0,
                filteredByGenre: 0,
                filteredByAuthor: 0,
                jobsAnalyzed: 0,
                topFilteredGenres: [],
                topFilteredAuthors: []
              }
            })
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Save Configuration')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Configuration');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid genres: InvalidGenre/i)).toBeInTheDocument();
      });
    });
  });
  
  describe('Filter Statistics Display', () => {
    
    it('should display filter statistics', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Filter Statistics')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Total Evaluated')).toBeInTheDocument();
      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('Passed')).toBeInTheDocument();
      expect(screen.getByText('450')).toBeInTheDocument();
      expect(screen.getByText('Filtered')).toBeInTheDocument();
      expect(screen.getByText('550')).toBeInTheDocument();
    });
    
    it('should display jobs analyzed count', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Jobs Analyzed')).toBeInTheDocument();
      });
      
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });
  
  describe('Enable/Disable Toggles', () => {
    
    it('should toggle genre filter enable state', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        const genreSection = screen.getByText('Genre Filter').closest('div');
        expect(genreSection).toBeInTheDocument();
      });
      
      // Find the checkbox for genre filter
      const checkboxes = screen.getAllByRole('checkbox');
      const genreCheckbox = checkboxes[0]; // First checkbox is genre filter
      
      // Initially enabled (from mock config)
      expect(genreCheckbox).toBeChecked();
      
      // Toggle off
      fireEvent.click(genreCheckbox);
      expect(genreCheckbox).not.toBeChecked();
      
      // Toggle back on
      fireEvent.click(genreCheckbox);
      expect(genreCheckbox).toBeChecked();
    });
    
    it('should toggle author filter enable state', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        const authorSection = screen.getByText('Author Filter').closest('div');
        expect(authorSection).toBeInTheDocument();
      });
      
      // Find the checkbox for author filter
      const checkboxes = screen.getAllByRole('checkbox');
      const authorCheckbox = checkboxes[1]; // Second checkbox is author filter
      
      // Initially disabled (from mock config)
      expect(authorCheckbox).not.toBeChecked();
      
      // Toggle on
      fireEvent.click(authorCheckbox);
      expect(authorCheckbox).toBeChecked();
      
      // Toggle back off
      fireEvent.click(authorCheckbox);
      expect(authorCheckbox).not.toBeChecked();
    });
  });
  
  describe('Genre Selection', () => {
    
    it('should toggle genre selection when genre button is clicked', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Science')).toBeInTheDocument();
      });
      
      const scienceButton = screen.getByText('Science');
      
      // Initially not selected
      expect(scienceButton).not.toHaveStyle({ backgroundColor: '#d4af37' });
      
      // Click to select
      fireEvent.click(scienceButton);
      
      // Should now be selected
      await waitFor(() => {
        expect(screen.getByText('3 genres selected')).toBeInTheDocument();
      });
    });
    
    it('should deselect genre when clicking selected genre', async () => {
      render(<IngestionFiltersPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Philosophy')).toBeInTheDocument();
      });
      
      const philosophyButton = screen.getByText('Philosophy');
      
      // Initially selected (from mock config)
      expect(philosophyButton).toHaveStyle({ backgroundColor: '#d4af37' });
      
      // Click to deselect
      fireEvent.click(philosophyButton);
      
      // Should now show 1 genre selected (only History remains)
      await waitFor(() => {
        expect(screen.getByText('1 genre selected')).toBeInTheDocument();
      });
    });
  });
});
