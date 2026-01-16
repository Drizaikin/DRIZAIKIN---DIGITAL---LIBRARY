/**
 * BookListView Component
 * 
 * Displays a paginated, sortable, filterable table of books.
 * Supports multi-select for bulk operations.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import React, { useState, useEffect } from 'react';
import {
  Search, Filter, SortAsc, SortDesc, Edit2, Trash2, Image,
  ChevronLeft, ChevronRight, Loader, AlertCircle, Calendar,
  BookOpen, X
} from 'lucide-react';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { Book, BookFilters, SortField, SortOrder } from './BookManagementPanel';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface BookListViewProps {
  books: Book[];
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  sortBy: SortField;
  sortOrder: SortOrder;
  filters: BookFilters;
  selectedBooks: string[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSort: (field: SortField) => void;
  onFilter: (filters: BookFilters) => void;
  onSelect: (bookIds: string[]) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  onCoverUpload: (book: Book) => void;
}

interface Category {
  id: string;
  name: string;
}

const BookListView: React.FC<BookListViewProps> = ({
  books,
  loading,
  error,
  page,
  pageSize,
  totalPages,
  totalCount,
  sortBy,
  sortOrder,
  filters,
  selectedBooks,
  onPageChange,
  onPageSizeChange,
  onSort,
  onFilter,
  onSelect,
  onEdit,
  onDelete,
  onCoverUpload,
}) => {
  const theme = useAppTheme();
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);

  // Fetch categories for filter dropdown
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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFilter({ ...filters, search: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handle select all
  const handleSelectAll = () => {
    if (selectedBooks.length === books.length) {
      onSelect([]);
    } else {
      onSelect(books.map(b => b.id));
    }
  };

  // Handle single select
  const handleSelectBook = (bookId: string) => {
    if (selectedBooks.includes(bookId)) {
      onSelect(selectedBooks.filter(id => id !== bookId));
    } else {
      onSelect([...selectedBooks, bookId]);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchInput('');
    onFilter({});
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get source badge color
  const getSourceColor = (source?: string) => {
    switch (source) {
      case 'internet_archive': return { bg: '#1e3a5f', text: '#60a5fa' };
      case 'open_library': return { bg: '#1e3a2e', text: '#4ade80' };
      case 'google_books': return { bg: '#3d2e1e', text: '#fbbf24' };
      case 'manual': return { bg: '#3d1e3d', text: '#c084fc' };
      case 'extraction': return { bg: '#1e3d3d', text: '#2dd4bf' };
      default: return { bg: '#2d2d2d', text: '#9ca3af' };
    }
  };

  const hasActiveFilters = filters.category || filters.genre || filters.source || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div 
        className="p-4 rounded-xl space-y-4"
        style={{ 
          backgroundColor: theme.colors.secondarySurface,
          border: `1px solid ${theme.colors.logoAccent}40`
        }}
      >
        {/* Search Input */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search 
              size={18} 
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: theme.colors.mutedText }}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, author, or ISBN..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${theme.colors.logoAccent}40`,
                color: theme.colors.primaryText,
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors"
            style={{ 
              backgroundColor: hasActiveFilters ? `${theme.colors.accent}20` : theme.colors.primaryBg,
              border: `1px solid ${hasActiveFilters ? theme.colors.accent : theme.colors.logoAccent}40`,
              color: hasActiveFilters ? theme.colors.accent : theme.colors.primaryText,
            }}
          >
            <Filter size={16} />
            Filters
            {hasActiveFilters && (
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: theme.colors.accent }}
              />
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3"
            style={{ borderTop: `1px solid ${theme.colors.logoAccent}30` }}
          >
            {/* Category Filter */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.mutedText }}>
                Category
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => onFilter({ ...filters, category: e.target.value || undefined })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText,
                }}
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Source Filter */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.mutedText }}>
                Source
              </label>
              <select
                value={filters.source || ''}
                onChange={(e) => onFilter({ ...filters, source: e.target.value || undefined })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText,
                }}
              >
                <option value="">All Sources</option>
                <option value="internet_archive">Internet Archive</option>
                <option value="open_library">Open Library</option>
                <option value="google_books">Google Books</option>
                <option value="manual">Manual</option>
                <option value="extraction">Extraction</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.mutedText }}>
                Added From
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => onFilter({ ...filters, dateFrom: e.target.value || undefined })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText,
                }}
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.mutedText }}>
                Added To
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => onFilter({ ...filters, dateTo: e.target.value || undefined })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText,
                }}
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors"
                  style={{ 
                    color: theme.colors.accent,
                    backgroundColor: `${theme.colors.accent}10`,
                  }}
                >
                  <X size={14} />
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm" style={{ color: theme.colors.mutedText }}>
          <span>
            Showing {books.length} of {totalCount} books
            {hasActiveFilters && ' (filtered)'}
          </span>
          <div className="flex items-center gap-2">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 text-sm rounded focus:outline-none"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${theme.colors.logoAccent}40`,
                color: theme.colors.primaryText,
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div 
          className="p-4 rounded-lg flex items-center gap-3"
          style={{ 
            backgroundColor: '#3d1f1f',
            border: '1px solid #991b1b',
            color: '#f87171'
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader 
            size={32} 
            className="animate-spin"
            style={{ color: theme.colors.accent }}
          />
        </div>
      )}

      {/* Book Table */}
      {!loading && !error && (
        <div 
          className="rounded-xl overflow-hidden"
          style={{ 
            backgroundColor: theme.colors.secondarySurface,
            border: `1px solid ${theme.colors.logoAccent}40`
          }}
        >
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: theme.colors.primaryBg }}>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={books.length > 0 && selectedBooks.length === books.length}
                      onChange={handleSelectAll}
                      className="rounded"
                      style={{ accentColor: theme.colors.accent }}
                    />
                  </th>
                  <th className="w-16 px-2 py-3 text-left text-xs font-medium" style={{ color: theme.colors.mutedText }}>
                    Cover
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium cursor-pointer hover:opacity-80"
                    style={{ color: theme.colors.mutedText }}
                    onClick={() => onSort('title')}
                  >
                    <div className="flex items-center gap-1">
                      Title {getSortIcon('title')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium cursor-pointer hover:opacity-80"
                    style={{ color: theme.colors.mutedText }}
                    onClick={() => onSort('author')}
                  >
                    <div className="flex items-center gap-1">
                      Author {getSortIcon('author')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium cursor-pointer hover:opacity-80"
                    style={{ color: theme.colors.mutedText }}
                    onClick={() => onSort('category')}
                  >
                    <div className="flex items-center gap-1">
                      Category {getSortIcon('category')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: theme.colors.mutedText }}>
                    Source
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium cursor-pointer hover:opacity-80"
                    style={{ color: theme.colors.mutedText }}
                    onClick={() => onSort('added_date')}
                  >
                    <div className="flex items-center gap-1">
                      Added {getSortIcon('added_date')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: theme.colors.mutedText }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {books.map((book, index) => (
                  <tr 
                    key={book.id}
                    className="transition-colors"
                    style={{ 
                      borderTop: `1px solid ${theme.colors.logoAccent}20`,
                      backgroundColor: selectedBooks.includes(book.id) ? `${theme.colors.accent}10` : 'transparent'
                    }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedBooks.includes(book.id)}
                        onChange={() => handleSelectBook(book.id)}
                        className="rounded"
                        style={{ accentColor: theme.colors.accent }}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <div 
                        className="w-10 h-14 rounded overflow-hidden"
                        style={{ backgroundColor: theme.colors.primaryBg }}
                      >
                        {book.cover_url ? (
                          <img 
                            src={book.cover_url} 
                            alt={book.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen size={16} style={{ color: theme.colors.mutedText }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div 
                        className="font-medium text-sm line-clamp-1"
                        style={{ color: theme.colors.primaryText }}
                      >
                        {book.title}
                      </div>
                      {book.isbn && (
                        <div className="text-xs" style={{ color: theme.colors.mutedText }}>
                          ISBN: {book.isbn}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: theme.colors.primaryText }}>
                        {book.author}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span 
                        className="text-xs px-2 py-1 rounded"
                        style={{ 
                          backgroundColor: `${theme.colors.accent}15`,
                          color: theme.colors.accent
                        }}
                      >
                        {book.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {book.source && (
                        <span 
                          className="text-xs px-2 py-1 rounded"
                          style={{ 
                            backgroundColor: getSourceColor(book.source).bg,
                            color: getSourceColor(book.source).text
                          }}
                        >
                          {book.source.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: theme.colors.mutedText }}>
                        {formatDate(book.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onCoverUpload(book)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: theme.colors.mutedText }}
                          title="Update Cover"
                        >
                          <Image size={16} />
                        </button>
                        <button
                          onClick={() => onEdit(book)}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: theme.colors.accent }}
                          title="Edit Book"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(book)}
                          className="p-2 rounded-lg transition-colors text-red-400"
                          title="Delete Book"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden divide-y" style={{ borderColor: `${theme.colors.logoAccent}20` }}>
            {books.map((book) => (
              <div 
                key={book.id}
                className="p-4"
                style={{ 
                  backgroundColor: selectedBooks.includes(book.id) ? `${theme.colors.accent}10` : 'transparent'
                }}
              >
                <div className="flex gap-3">
                  <input
                    type="checkbox"
                    checked={selectedBooks.includes(book.id)}
                    onChange={() => handleSelectBook(book.id)}
                    className="mt-1 rounded"
                    style={{ accentColor: theme.colors.accent }}
                  />
                  <div 
                    className="w-12 h-16 rounded overflow-hidden flex-shrink-0"
                    style={{ backgroundColor: theme.colors.primaryBg }}
                  >
                    {book.cover_url ? (
                      <img 
                        src={book.cover_url} 
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={16} style={{ color: theme.colors.mutedText }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 
                      className="font-medium text-sm line-clamp-2"
                      style={{ color: theme.colors.primaryText }}
                    >
                      {book.title}
                    </h4>
                    <p className="text-xs mt-0.5" style={{ color: theme.colors.mutedText }}>
                      {book.author}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span 
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ 
                          backgroundColor: `${theme.colors.accent}15`,
                          color: theme.colors.accent
                        }}
                      >
                        {book.category}
                      </span>
                      {book.source && (
                        <span 
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ 
                            backgroundColor: getSourceColor(book.source).bg,
                            color: getSourceColor(book.source).text
                          }}
                        >
                          {book.source.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${theme.colors.logoAccent}20` }}>
                  <span className="text-xs" style={{ color: theme.colors.mutedText }}>
                    <Calendar size={12} className="inline mr-1" />
                    {formatDate(book.created_at)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onCoverUpload(book)}
                      className="p-2 rounded-lg"
                      style={{ color: theme.colors.mutedText }}
                    >
                      <Image size={18} />
                    </button>
                    <button
                      onClick={() => onEdit(book)}
                      className="p-2 rounded-lg"
                      style={{ color: theme.colors.accent }}
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(book)}
                      className="p-2 rounded-lg text-red-400"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {books.length === 0 && (
            <div className="p-12 text-center">
              <BookOpen 
                size={48} 
                className="mx-auto mb-3"
                style={{ color: `${theme.colors.mutedText}50` }}
              />
              <p style={{ color: theme.colors.mutedText }}>No books found</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-2 text-sm"
                  style={{ color: theme.colors.accent }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="p-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`,
              color: theme.colors.primaryText
            }}
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className="w-8 h-8 rounded-lg text-sm font-medium transition-colors"
                  style={{ 
                    backgroundColor: page === pageNum ? theme.colors.accent : theme.colors.secondarySurface,
                    color: page === pageNum ? '#fff' : theme.colors.primaryText,
                    border: `1px solid ${page === pageNum ? theme.colors.accent : theme.colors.logoAccent}40`
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="p-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`,
              color: theme.colors.primaryText
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default BookListView;
