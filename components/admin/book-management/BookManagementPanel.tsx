/**
 * BookManagementPanel Component
 * 
 * Main container for the Admin Book Management feature.
 * Provides tab navigation between list view and AI search.
 * 
 * Requirements: 1.1
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Search, AlertCircle, RefreshCw } from 'lucide-react';
import { useAppTheme } from '../../../hooks/useAppTheme';
import BookListView from './BookListView';
import AIBookSearch from './AIBookSearch';
import BookEditModal from './BookEditModal';
import CoverUploadModal from './CoverUploadModal';
import BulkActionsBar from './BulkActionsBar';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_HEALTH_SECRET || '';

// Helper to get auth headers
const getAuthHeaders = () => ({
  'Authorization': `Bearer ${ADMIN_SECRET}`,
  'Content-Type': 'application/json',
});

// Types
export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  genres?: string[];
  description?: string;
  cover_url?: string;
  soft_copy_url?: string;
  has_soft_copy?: boolean;
  published_year?: number;
  isbn?: string;
  call_number?: string;
  shelf_location?: string;
  floor_number?: number;
  copies_available: number;
  total_copies: number;
  popularity: number;
  created_at: string;
  source?: string;
  source_identifier?: string;
  access_type?: string;
}

export interface BookFilters {
  search?: string;
  category?: string;
  genre?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type SortField = 'title' | 'author' | 'added_date' | 'category';
export type SortOrder = 'asc' | 'desc';

type TabType = 'list' | 'search';

const BookManagementPanel: React.FC = () => {
  const theme = useAppTheme();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('list');
  
  // Book list state
  const [books, setBooks] = useState<Book[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter and sort state
  const [filters, setFilters] = useState<BookFilters>({});
  const [sortBy, setSortBy] = useState<SortField>('added_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Selection state
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  
  // Modal state
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [coverUploadBook, setCoverUploadBook] = useState<Book | null>(null);
  
  // Message state
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch books from API
  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
      });
      
      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);
      if (filters.genre) params.append('genre', filters.genre);
      if (filters.source) params.append('source', filters.source);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      
      const response = await fetch(`${API_URL}/admin/books?${params}`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setBooks(data.books || []);
        setTotalCount(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setError(data.error || 'Failed to fetch books');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Error fetching books:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, filters]);

  // Initial fetch
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Show message helper
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Handle sort change
  const handleSort = (field: SortField) => {
    if (field === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Handle filter change
  const handleFilter = (newFilters: BookFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  // Handle selection
  const handleSelect = (bookIds: string[]) => {
    setSelectedBooks(bookIds);
  };

  // Handle edit
  const handleEdit = (book: Book) => {
    setEditingBook(book);
  };

  // Handle cover upload
  const handleCoverUpload = (book: Book) => {
    setCoverUploadBook(book);
  };

  // Handle delete
  const handleDelete = async (book: Book) => {
    if (!confirm(`Are you sure you want to delete "${book.title}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/admin/books/${book.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', `"${book.title}" deleted successfully`);
        fetchBooks();
        setSelectedBooks(prev => prev.filter(id => id !== book.id));
      } else {
        showMessage('error', data.error || 'Failed to delete book');
      }
    } catch (err) {
      showMessage('error', 'Failed to delete book');
      console.error('Error deleting book:', err);
    }
  };

  // Handle book save (from edit modal)
  const handleSaveBook = async (updates: Partial<Book>) => {
    if (!editingBook) return;
    
    try {
      const response = await fetch(`${API_URL}/admin/books/${editingBook.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', 'Book updated successfully');
        setEditingBook(null);
        fetchBooks();
      } else {
        showMessage('error', data.error || 'Failed to update book');
      }
    } catch (err) {
      showMessage('error', 'Failed to update book');
      console.error('Error updating book:', err);
    }
  };

  // Handle cover save
  const handleSaveCover = async (file: File | string) => {
    if (!coverUploadBook) return;
    
    try {
      const formData = new FormData();
      
      if (typeof file === 'string') {
        formData.append('coverUrl', file);
      } else {
        formData.append('file', file);
      }
      
      const response = await fetch(`${API_URL}/admin/books/${coverUploadBook.id}/cover`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
        },
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', 'Cover updated successfully');
        setCoverUploadBook(null);
        fetchBooks();
      } else {
        showMessage('error', data.error || 'Failed to update cover');
      }
    } catch (err) {
      showMessage('error', 'Failed to update cover');
      console.error('Error updating cover:', err);
    }
  };

  // Handle bulk operation complete
  const handleBulkComplete = () => {
    setSelectedBooks([]);
    fetchBooks();
  };

  // Handle ingestion from AI search
  const handleIngest = async (bookIdentifiers: Array<{ identifier: string; source: string }>) => {
    try {
      const response = await fetch(`${API_URL}/admin/books/ingest`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ books: bookIdentifiers }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('success', `Queued ${data.queued} books for ingestion`);
        // Switch to list view to see results
        setActiveTab('list');
        fetchBooks();
      } else {
        showMessage('error', data.error || 'Failed to queue books');
      }
    } catch (err) {
      showMessage('error', 'Failed to queue books for ingestion');
      console.error('Error ingesting books:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Message Toast */}
      {message && (
        <div 
          className="fixed top-20 right-4 left-4 md:left-auto md:w-96 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm"
          style={{
            backgroundColor: message.type === 'success' ? '#0d3320' : '#3d1f1f',
            color: message.type === 'success' ? '#4ade80' : '#f87171',
            border: `1px solid ${message.type === 'success' ? '#166534' : '#991b1b'}`
          }}
        >
          {message.type === 'error' && <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold" style={{ color: theme.colors.accent }}>
            Book Management
          </h3>
          <p className="text-sm" style={{ color: theme.colors.mutedText }}>
            View, edit, and manage library books
          </p>
        </div>
        <button
          onClick={() => fetchBooks()}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors"
          style={{ 
            backgroundColor: `${theme.colors.accent}15`,
            color: theme.colors.accent,
          }}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div 
        className="flex gap-1 border-b"
        style={{ borderColor: `${theme.colors.logoAccent}40` }}
      >
        <button
          onClick={() => setActiveTab('list')}
          className="flex items-center gap-2 px-4 py-3 font-medium transition-all"
          style={{ 
            color: activeTab === 'list' ? theme.colors.accent : theme.colors.mutedText,
            borderBottom: activeTab === 'list' ? `2px solid ${theme.colors.accent}` : '2px solid transparent'
          }}
        >
          <BookOpen size={18} />
          Book List
          {totalCount > 0 && (
            <span 
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ 
                backgroundColor: `${theme.colors.accent}20`,
                color: theme.colors.accent 
              }}
            >
              {totalCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className="flex items-center gap-2 px-4 py-3 font-medium transition-all"
          style={{ 
            color: activeTab === 'search' ? theme.colors.accent : theme.colors.mutedText,
            borderBottom: activeTab === 'search' ? `2px solid ${theme.colors.accent}` : '2px solid transparent'
          }}
        >
          <Search size={18} />
          AI Book Search
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedBooks.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedBooks.length}
          selectedBookIds={selectedBooks}
          onComplete={handleBulkComplete}
          onClearSelection={() => setSelectedBooks([])}
        />
      )}

      {/* Tab Content */}
      {activeTab === 'list' ? (
        <BookListView
          books={books}
          loading={loading}
          error={error}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          totalCount={totalCount}
          sortBy={sortBy}
          sortOrder={sortOrder}
          filters={filters}
          selectedBooks={selectedBooks}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          onSort={handleSort}
          onFilter={handleFilter}
          onSelect={handleSelect}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCoverUpload={handleCoverUpload}
        />
      ) : (
        <AIBookSearch onIngest={handleIngest} />
      )}

      {/* Edit Modal */}
      {editingBook && (
        <BookEditModal
          book={editingBook}
          isOpen={true}
          onClose={() => setEditingBook(null)}
          onSave={handleSaveBook}
        />
      )}

      {/* Cover Upload Modal */}
      {coverUploadBook && (
        <CoverUploadModal
          book={coverUploadBook}
          isOpen={true}
          onClose={() => setCoverUploadBook(null)}
          onUpload={handleSaveCover}
        />
      )}
    </div>
  );
};

export default BookManagementPanel;
