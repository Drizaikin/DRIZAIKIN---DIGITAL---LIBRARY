/**
 * AIBookSearch Component
 * 
 * AI-powered book search with multi-source support.
 * Allows searching and selecting books for ingestion.
 * 
 * Requirements: 4.1, 4.3, 4.4, 4.5, 9.1, 9.6, 10.2, 10.3
 */

import React, { useState } from 'react';
import {
  Search, Loader, AlertCircle, BookOpen, Check, Plus,
  Calendar, Star, ExternalLink, Archive, Library, BookMarked,
  Filter, X
} from 'lucide-react';
import { useAppTheme } from '../../../hooks/useAppTheme';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_HEALTH_SECRET || '';

// Genre taxonomy for filter
const PRIMARY_GENRES = [
  'Philosophy', 'Religion', 'Theology', 'Sacred Texts', 'History',
  'Biography', 'Science', 'Mathematics', 'Medicine', 'Law',
  'Politics', 'Economics', 'Literature', 'Poetry', 'Drama',
  'Mythology', 'Military & Strategy', 'Education', 'Linguistics',
  'Ethics', 'Anthropology', 'Sociology', 'Psychology', 'Geography',
  'Astronomy', 'Alchemy & Esoterica', 'Art & Architecture'
];

interface SearchResult {
  identifier: string;
  title: string;
  author: string;
  description: string;
  year?: number;
  coverUrl?: string;
  relevanceScore: number;
  alreadyInLibrary: boolean;
  source: 'internet_archive' | 'open_library' | 'google_books';
  accessType: 'public_domain' | 'open_access' | 'preview_only';
}

interface SearchCriteria {
  query: string;
  topic?: string;
  author?: string;
  yearFrom?: number;
  yearTo?: number;
  genre?: string;
  sources: string[];
  accessTypes: string[];
}

interface AIBookSearchProps {
  onIngest: (books: Array<{ identifier: string; source: string }>) => Promise<void>;
}

const AIBookSearch: React.FC<AIBookSearchProps> = ({ onIngest }) => {
  const theme = useAppTheme();
  
  // Search state
  const [criteria, setCriteria] = useState<SearchCriteria>({
    query: '',
    sources: ['internet_archive', 'open_library', 'google_books'],
    accessTypes: ['public_domain', 'open_access', 'preview_only'],
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, number>>({});
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Selection state
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  // Handle search
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!criteria.query.trim()) return;
    
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setSelectedBooks(new Set());
    
    try {
      const response = await fetch(`${API_URL}/admin/books/search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ADMIN_SECRET}`,
        },
        body: JSON.stringify({
          query: criteria.query,
          topic: criteria.topic || undefined,
          author: criteria.author || undefined,
          yearFrom: criteria.yearFrom || undefined,
          yearTo: criteria.yearTo || undefined,
          genre: criteria.genre || undefined,
          sources: criteria.sources.length > 0 ? criteria.sources : undefined,
          accessType: criteria.accessTypes.length > 0 ? criteria.accessTypes : undefined,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.results || []);
        setSourceBreakdown(data.sourceBreakdown || {});
      } else {
        setSearchError(data.error || 'Search failed');
        setResults([]);
      }
    } catch (err) {
      setSearchError('Failed to connect to search service');
      setResults([]);
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Handle source toggle
  const handleSourceToggle = (source: string) => {
    setCriteria(prev => ({
      ...prev,
      sources: prev.sources.includes(source)
        ? prev.sources.filter(s => s !== source)
        : [...prev.sources, source],
    }));
  };

  // Handle access type toggle
  const handleAccessTypeToggle = (type: string) => {
    setCriteria(prev => ({
      ...prev,
      accessTypes: prev.accessTypes.includes(type)
        ? prev.accessTypes.filter(t => t !== type)
        : [...prev.accessTypes, type],
    }));
  };

  // Handle book selection
  const handleSelectBook = (identifier: string) => {
    setSelectedBooks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(identifier)) {
        newSet.delete(identifier);
      } else {
        newSet.add(identifier);
      }
      return newSet;
    });
  };

  // Handle select all (non-duplicate)
  const handleSelectAll = () => {
    const nonDuplicates = results.filter(r => !r.alreadyInLibrary);
    if (selectedBooks.size === nonDuplicates.length) {
      setSelectedBooks(new Set());
    } else {
      setSelectedBooks(new Set(nonDuplicates.map(r => r.identifier)));
    }
  };

  // Handle ingestion
  const handleIngest = async () => {
    if (selectedBooks.size === 0) return;
    
    setIngesting(true);
    try {
      const booksToIngest = results
        .filter(r => selectedBooks.has(r.identifier))
        .map(r => ({ identifier: r.identifier, source: r.source }));
      
      await onIngest(booksToIngest);
      setSelectedBooks(new Set());
      setShowConfirmDialog(false);
    } finally {
      setIngesting(false);
    }
  };

  // Get source icon
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'internet_archive': return <Archive size={14} />;
      case 'open_library': return <Library size={14} />;
      case 'google_books': return <BookMarked size={14} />;
      default: return <BookOpen size={14} />;
    }
  };

  // Get source color
  const getSourceColor = (source: string) => {
    switch (source) {
      case 'internet_archive': return { bg: '#1e3a5f', text: '#60a5fa' };
      case 'open_library': return { bg: '#1e3a2e', text: '#4ade80' };
      case 'google_books': return { bg: '#3d2e1e', text: '#fbbf24' };
      default: return { bg: '#2d2d2d', text: '#9ca3af' };
    }
  };

  // Get access type color
  const getAccessTypeColor = (type: string) => {
    switch (type) {
      case 'public_domain': return { bg: '#1e3a2e', text: '#4ade80' };
      case 'open_access': return { bg: '#1e3a5f', text: '#60a5fa' };
      case 'preview_only': return { bg: '#3d2e1e', text: '#fbbf24' };
      default: return { bg: '#2d2d2d', text: '#9ca3af' };
    }
  };

  const nonDuplicateCount = results.filter(r => !r.alreadyInLibrary).length;

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div 
        className="p-4 rounded-xl"
        style={{ 
          backgroundColor: theme.colors.secondarySurface,
          border: `1px solid ${theme.colors.logoAccent}40`
        }}
      >
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Main Search Input */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search 
                size={18} 
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: theme.colors.mutedText }}
              />
              <input
                type="text"
                value={criteria.query}
                onChange={(e) => setCriteria(prev => ({ ...prev, query: e.target.value }))}
                placeholder="Search for books by title, topic, or keyword..."
                className="w-full pl-10 pr-4 py-3 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText,
                }}
              />
            </div>
            <button
              type="submit"
              disabled={searching || !criteria.query.trim()}
              className="flex items-center justify-center gap-2 px-6 py-3 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: theme.colors.accent }}
            >
              {searching ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Search
                </>
              )}
            </button>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm"
            style={{ color: theme.colors.accent }}
          >
            <Filter size={14} />
            {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
          </button>

          {/* Advanced Filters */}
          {showAdvanced && (
            <div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4"
              style={{ borderTop: `1px solid ${theme.colors.logoAccent}30` }}
            >
              {/* Author */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.mutedText }}>
                  Author
                </label>
                <input
                  type="text"
                  value={criteria.author || ''}
                  onChange={(e) => setCriteria(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Author name"
                  className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText,
                  }}
                />
              </div>

              {/* Year Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.mutedText }}>
                    Year From
                  </label>
                  <input
                    type="number"
                    value={criteria.yearFrom || ''}
                    onChange={(e) => setCriteria(prev => ({ ...prev, yearFrom: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="1800"
                    className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                    style={{ 
                      backgroundColor: theme.colors.primaryBg,
                      border: `1px solid ${theme.colors.logoAccent}40`,
                      color: theme.colors.primaryText,
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.mutedText }}>
                    Year To
                  </label>
                  <input
                    type="number"
                    value={criteria.yearTo || ''}
                    onChange={(e) => setCriteria(prev => ({ ...prev, yearTo: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="2024"
                    className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                    style={{ 
                      backgroundColor: theme.colors.primaryBg,
                      border: `1px solid ${theme.colors.logoAccent}40`,
                      color: theme.colors.primaryText,
                    }}
                  />
                </div>
              </div>

              {/* Genre */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.mutedText }}>
                  Genre
                </label>
                <select
                  value={criteria.genre || ''}
                  onChange={(e) => setCriteria(prev => ({ ...prev, genre: e.target.value || undefined }))}
                  className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText,
                  }}
                >
                  <option value="">All Genres</option>
                  {PRIMARY_GENRES.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              {/* Sources */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium mb-2" style={{ color: theme.colors.mutedText }}>
                  Sources
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'internet_archive', label: 'Internet Archive', icon: <Archive size={14} /> },
                    { id: 'open_library', label: 'Open Library', icon: <Library size={14} /> },
                    { id: 'google_books', label: 'Google Books', icon: <BookMarked size={14} /> },
                  ].map(source => (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => handleSourceToggle(source.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors"
                      style={{ 
                        backgroundColor: criteria.sources.includes(source.id) 
                          ? getSourceColor(source.id).bg 
                          : theme.colors.primaryBg,
                        color: criteria.sources.includes(source.id) 
                          ? getSourceColor(source.id).text 
                          : theme.colors.mutedText,
                        border: `1px solid ${criteria.sources.includes(source.id) 
                          ? getSourceColor(source.id).text 
                          : theme.colors.logoAccent}40`,
                      }}
                    >
                      {source.icon}
                      {source.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Access Types */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium mb-2" style={{ color: theme.colors.mutedText }}>
                  Access Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'public_domain', label: 'Public Domain' },
                    { id: 'open_access', label: 'Open Access' },
                    { id: 'preview_only', label: 'Preview Only' },
                  ].map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleAccessTypeToggle(type.id)}
                      className="px-3 py-1.5 text-xs rounded-full transition-colors"
                      style={{ 
                        backgroundColor: criteria.accessTypes.includes(type.id) 
                          ? getAccessTypeColor(type.id).bg 
                          : theme.colors.primaryBg,
                        color: criteria.accessTypes.includes(type.id) 
                          ? getAccessTypeColor(type.id).text 
                          : theme.colors.mutedText,
                        border: `1px solid ${criteria.accessTypes.includes(type.id) 
                          ? getAccessTypeColor(type.id).text 
                          : theme.colors.logoAccent}40`,
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Error Message */}
      {searchError && (
        <div 
          className="p-4 rounded-lg flex items-center gap-3"
          style={{ 
            backgroundColor: '#3d1f1f',
            border: '1px solid #991b1b',
            color: '#f87171'
          }}
        >
          <AlertCircle size={20} />
          <span>{searchError}</span>
        </div>
      )}

      {/* Results */}
      {hasSearched && !searching && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-medium" style={{ color: theme.colors.primaryText }}>
                {results.length} Results Found
              </h4>
              {Object.keys(sourceBreakdown).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(sourceBreakdown).map(([source, count]) => (
                    <span 
                      key={source}
                      className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
                      style={{ 
                        backgroundColor: getSourceColor(source).bg,
                        color: getSourceColor(source).text
                      }}
                    >
                      {getSourceIcon(source)}
                      {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {nonDuplicateCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{ 
                    backgroundColor: `${theme.colors.accent}15`,
                    color: theme.colors.accent,
                  }}
                >
                  {selectedBooks.size === nonDuplicateCount ? 'Deselect All' : 'Select All New'}
                </button>
                {selectedBooks.size > 0 && (
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-white rounded-lg transition-colors"
                    style={{ backgroundColor: theme.colors.accent }}
                  >
                    <Plus size={14} />
                    Ingest {selectedBooks.size} Books
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Results List */}
          {results.length > 0 ? (
            <div 
              className="rounded-xl overflow-hidden divide-y"
              style={{ 
                backgroundColor: theme.colors.secondarySurface,
                border: `1px solid ${theme.colors.logoAccent}40`,
                borderColor: `${theme.colors.logoAccent}20`
              }}
            >
              {results.map((result) => (
                <div 
                  key={result.identifier}
                  className="p-4 transition-colors"
                  style={{ 
                    backgroundColor: selectedBooks.has(result.identifier) 
                      ? `${theme.colors.accent}10` 
                      : 'transparent',
                    opacity: result.alreadyInLibrary ? 0.6 : 1,
                  }}
                >
                  <div className="flex gap-4">
                    {/* Selection Checkbox */}
                    <div className="flex-shrink-0 pt-1">
                      {result.alreadyInLibrary ? (
                        <div 
                          className="w-5 h-5 rounded flex items-center justify-center"
                          style={{ backgroundColor: `${theme.colors.logoAccent}30` }}
                          title="Already in library"
                        >
                          <Check size={14} style={{ color: theme.colors.mutedText }} />
                        </div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedBooks.has(result.identifier)}
                          onChange={() => handleSelectBook(result.identifier)}
                          className="w-5 h-5 rounded"
                          style={{ accentColor: theme.colors.accent }}
                        />
                      )}
                    </div>

                    {/* Cover */}
                    <div 
                      className="w-16 h-20 rounded overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: theme.colors.primaryBg }}
                    >
                      {result.coverUrl ? (
                        <img 
                          src={result.coverUrl} 
                          alt={result.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen size={20} style={{ color: theme.colors.mutedText }} />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 
                            className="font-medium text-sm line-clamp-1"
                            style={{ color: theme.colors.primaryText }}
                          >
                            {result.title}
                          </h5>
                          <p className="text-xs mt-0.5" style={{ color: theme.colors.mutedText }}>
                            {result.author}
                          </p>
                        </div>
                        
                        {/* Relevance Score */}
                        <div 
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs flex-shrink-0"
                          style={{ 
                            backgroundColor: `${theme.colors.accent}15`,
                            color: theme.colors.accent
                          }}
                        >
                          <Star size={12} />
                          {Math.round(result.relevanceScore * 100)}%
                        </div>
                      </div>

                      {/* Description */}
                      {result.description && (
                        <p 
                          className="text-xs mt-2 line-clamp-2"
                          style={{ color: theme.colors.mutedText }}
                        >
                          {result.description}
                        </p>
                      )}

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Source */}
                        <span 
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                          style={{ 
                            backgroundColor: getSourceColor(result.source).bg,
                            color: getSourceColor(result.source).text
                          }}
                        >
                          {getSourceIcon(result.source)}
                          {result.source.replace('_', ' ')}
                        </span>

                        {/* Access Type */}
                        <span 
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ 
                            backgroundColor: getAccessTypeColor(result.accessType).bg,
                            color: getAccessTypeColor(result.accessType).text
                          }}
                        >
                          {result.accessType.replace('_', ' ')}
                        </span>

                        {/* Year */}
                        {result.year && (
                          <span 
                            className="flex items-center gap-1 text-xs"
                            style={{ color: theme.colors.mutedText }}
                          >
                            <Calendar size={12} />
                            {result.year}
                          </span>
                        )}

                        {/* Already in Library */}
                        {result.alreadyInLibrary && (
                          <span 
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ 
                              backgroundColor: '#1e3a2e',
                              color: '#4ade80'
                            }}
                          >
                            In Library
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div 
              className="p-12 rounded-xl text-center"
              style={{ 
                backgroundColor: theme.colors.secondarySurface,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <BookOpen 
                size={48} 
                className="mx-auto mb-3"
                style={{ color: `${theme.colors.mutedText}50` }}
              />
              <p style={{ color: theme.colors.mutedText }}>No books found</p>
              <p className="text-sm mt-1" style={{ color: theme.colors.mutedText }}>
                Try adjusting your search criteria
              </p>
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!hasSearched && !searching && (
        <div 
          className="p-12 rounded-xl text-center"
          style={{ 
            backgroundColor: theme.colors.secondarySurface,
            border: `1px solid ${theme.colors.logoAccent}40`
          }}
        >
          <Search 
            size={48} 
            className="mx-auto mb-3"
            style={{ color: `${theme.colors.mutedText}50` }}
          />
          <p style={{ color: theme.colors.primaryText }}>Search for books to add to your library</p>
          <p className="text-sm mt-1" style={{ color: theme.colors.mutedText }}>
            Enter a search term above to find books from multiple sources
          </p>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-xl w-full max-w-md p-6"
            style={{ backgroundColor: theme.colors.secondarySurface }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.accent }}>
              Confirm Ingestion
            </h3>
            <p className="text-sm mb-4" style={{ color: theme.colors.primaryText }}>
              You are about to queue {selectedBooks.size} book(s) for ingestion. This will:
            </p>
            <ul className="text-sm space-y-1 mb-6" style={{ color: theme.colors.mutedText }}>
              <li>• Download book metadata and PDFs</li>
              <li>• Apply AI genre classification</li>
              <li>• Add books to your library</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={ingesting}
                className="flex-1 px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ 
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleIngest}
                disabled={ingesting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: theme.colors.accent }}
              >
                {ingesting ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Queuing...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIBookSearch;
