/**
 * BulkActionsBar Component
 * 
 * Floating action bar for bulk operations on selected books.
 * Supports category update, genre update, and bulk deletion.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import React, { useState, useEffect } from 'react';
import {
  X, Trash2, Tag, BookOpen, Loader, AlertCircle, Check,
  ChevronDown
} from 'lucide-react';
import { useAppTheme } from '../../../hooks/useAppTheme';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_HEALTH_SECRET || '';

// Genre taxonomy
const PRIMARY_GENRES = [
  'Philosophy', 'Religion', 'Theology', 'Sacred Texts', 'History',
  'Biography', 'Science', 'Mathematics', 'Medicine', 'Law',
  'Politics', 'Economics', 'Literature', 'Poetry', 'Drama',
  'Mythology', 'Military & Strategy', 'Education', 'Linguistics',
  'Ethics', 'Anthropology', 'Sociology', 'Psychology', 'Geography',
  'Astronomy', 'Alchemy & Esoterica', 'Art & Architecture'
];

interface Category {
  id: string;
  name: string;
}

interface BulkActionsBarProps {
  selectedCount: number;
  selectedBookIds: string[];
  onComplete: () => void;
  onClearSelection: () => void;
}

type BulkOperation = 'update_category' | 'update_genre' | 'delete';

interface OperationResult {
  bookId: string;
  status: 'success' | 'error';
  message?: string;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  selectedBookIds,
  onComplete,
  onClearSelection,
}) => {
  const theme = useAppTheme();
  
  // Dropdown state
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Operation state
  const [operating, setOperating] = useState(false);
  const [operation, setOperation] = useState<BulkOperation | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OperationResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_URL}/categories`);
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.bulk-dropdown')) {
        setShowCategoryDropdown(false);
        setShowGenreDropdown(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Perform bulk operation
  const performBulkOperation = async (
    operationType: BulkOperation,
    data?: { category?: string; genres?: string[] }
  ) => {
    setOperating(true);
    setOperation(operationType);
    setProgress(0);
    setResults([]);
    setShowCategoryDropdown(false);
    setShowGenreDropdown(false);
    setShowDeleteConfirm(false);

    try {
      const response = await fetch(`${API_URL}/admin/books/bulk`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ADMIN_SECRET}`,
        },
        body: JSON.stringify({
          operation: operationType,
          bookIds: selectedBookIds,
          data,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setResults(result.results || []);
        setProgress(100);
        
        // Show results briefly then complete
        setShowResults(true);
        setTimeout(() => {
          setShowResults(false);
          onComplete();
        }, 2000);
      } else {
        setResults([{ bookId: '', status: 'error', message: result.error || 'Operation failed' }]);
        setShowResults(true);
      }
    } catch (err) {
      setResults([{ bookId: '', status: 'error', message: 'Failed to connect to server' }]);
      setShowResults(true);
    } finally {
      setOperating(false);
      setOperation(null);
    }
  };

  // Handle category update
  const handleCategoryUpdate = (category: string) => {
    performBulkOperation('update_category', { category });
  };

  // Handle genre update
  const handleGenreUpdate = (genre: string) => {
    performBulkOperation('update_genre', { genres: [genre] });
  };

  // Handle delete
  const handleDelete = () => {
    performBulkOperation('delete');
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div 
      className="sticky bottom-4 z-40 mx-auto max-w-4xl"
    >
      <div 
        className="rounded-xl shadow-2xl p-4"
        style={{ 
          backgroundColor: theme.colors.secondarySurface,
          border: `1px solid ${theme.colors.logoAccent}40`,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Results Display */}
        {showResults && results.length > 0 && (
          <div 
            className="mb-4 p-3 rounded-lg"
            style={{ 
              backgroundColor: errorCount > 0 ? '#3d1f1f' : '#0d3320',
              border: `1px solid ${errorCount > 0 ? '#991b1b' : '#166534'}`
            }}
          >
            <div className="flex items-center gap-2">
              {errorCount > 0 ? (
                <AlertCircle size={18} className="text-red-400" />
              ) : (
                <Check size={18} className="text-green-400" />
              )}
              <span style={{ color: errorCount > 0 ? '#f87171' : '#4ade80' }}>
                {successCount > 0 && `${successCount} succeeded`}
                {successCount > 0 && errorCount > 0 && ', '}
                {errorCount > 0 && `${errorCount} failed`}
              </span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {operating && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: theme.colors.mutedText }}>
              <span>Processing {operation?.replace('_', ' ')}...</span>
              <span>{progress}%</span>
            </div>
            <div 
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: `${theme.colors.logoAccent}30` }}
            >
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  backgroundColor: theme.colors.accent,
                  width: `${progress}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Selection Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClearSelection}
              className="p-2 rounded-lg transition-colors"
              style={{ 
                backgroundColor: `${theme.colors.logoAccent}20`,
                color: theme.colors.mutedText
              }}
              title="Clear selection"
            >
              <X size={18} />
            </button>
            <span className="text-sm font-medium" style={{ color: theme.colors.primaryText }}>
              {selectedCount} book{selectedCount !== 1 ? 's' : ''} selected
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {/* Category Update */}
            <div className="relative bulk-dropdown">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCategoryDropdown(!showCategoryDropdown);
                  setShowGenreDropdown(false);
                }}
                disabled={operating}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
                style={{ 
                  backgroundColor: `${theme.colors.accent}15`,
                  color: theme.colors.accent,
                }}
              >
                <Tag size={16} />
                Category
                <ChevronDown size={14} />
              </button>
              
              {showCategoryDropdown && (
                <div 
                  className="absolute bottom-full mb-2 left-0 w-48 max-h-64 overflow-y-auto rounded-lg shadow-xl z-50"
                  style={{ 
                    backgroundColor: theme.colors.secondarySurface,
                    border: `1px solid ${theme.colors.logoAccent}40`
                  }}
                >
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryUpdate(cat.name)}
                      className="w-full px-3 py-2 text-left text-sm transition-colors hover:opacity-80"
                      style={{ 
                        color: theme.colors.primaryText,
                        borderBottom: `1px solid ${theme.colors.logoAccent}20`
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Genre Update */}
            <div className="relative bulk-dropdown">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGenreDropdown(!showGenreDropdown);
                  setShowCategoryDropdown(false);
                }}
                disabled={operating}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
                style={{ 
                  backgroundColor: `${theme.colors.accent}15`,
                  color: theme.colors.accent,
                }}
              >
                <BookOpen size={16} />
                Genre
                <ChevronDown size={14} />
              </button>
              
              {showGenreDropdown && (
                <div 
                  className="absolute bottom-full mb-2 left-0 w-56 max-h-64 overflow-y-auto rounded-lg shadow-xl z-50"
                  style={{ 
                    backgroundColor: theme.colors.secondarySurface,
                    border: `1px solid ${theme.colors.logoAccent}40`
                  }}
                >
                  {PRIMARY_GENRES.map(genre => (
                    <button
                      key={genre}
                      onClick={() => handleGenreUpdate(genre)}
                      className="w-full px-3 py-2 text-left text-sm transition-colors hover:opacity-80"
                      style={{ 
                        color: theme.colors.primaryText,
                        borderBottom: `1px solid ${theme.colors.logoAccent}20`
                      }}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delete */}
            <div className="relative">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={operating}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                }}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div 
            className="mt-4 p-4 rounded-lg"
            style={{ 
              backgroundColor: '#3d1f1f',
              border: '1px solid #991b1b'
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">
                  Delete {selectedCount} book{selectedCount !== 1 ? 's' : ''}?
                </p>
                <p className="text-xs text-red-300 mt-1">
                  This will permanently delete the selected books and their associated files. This action cannot be undone.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                    style={{ 
                      border: '1px solid #991b1b',
                      color: '#f87171',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={operating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white rounded-lg transition-colors disabled:opacity-50"
                    style={{ backgroundColor: '#dc2626' }}
                  >
                    {operating ? (
                      <>
                        <Loader size={12} className="animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 size={12} />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkActionsBar;
