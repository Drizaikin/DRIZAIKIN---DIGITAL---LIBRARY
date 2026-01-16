/**
 * BookEditModal Component
 * 
 * Modal form for editing book metadata.
 * Includes genre dropdown from taxonomy and validation.
 * 
 * Requirements: 2.1, 2.2, 2.4, 2.5, 2.6
 */

import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader } from 'lucide-react';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { Book } from './BookManagementPanel';

// Genre taxonomy - matches services/ingestion/genreTaxonomy.js
const PRIMARY_GENRES = [
  'Philosophy',
  'Religion',
  'Theology',
  'Sacred Texts',
  'History',
  'Biography',
  'Science',
  'Mathematics',
  'Medicine',
  'Law',
  'Politics',
  'Economics',
  'Literature',
  'Poetry',
  'Drama',
  'Mythology',
  'Military & Strategy',
  'Education',
  'Linguistics',
  'Ethics',
  'Anthropology',
  'Sociology',
  'Psychology',
  'Geography',
  'Astronomy',
  'Alchemy & Esoterica',
  'Art & Architecture'
];

interface BookEditModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Book>) => Promise<void>;
}

interface FormData {
  title: string;
  author: string;
  category: string;
  genres: string[];
  description: string;
  published_year: string;
  isbn: string;
}

interface FormErrors {
  title?: string;
  author?: string;
  genres?: string;
  published_year?: string;
}

const BookEditModal: React.FC<BookEditModalProps> = ({
  book,
  isOpen,
  onClose,
  onSave,
}) => {
  const theme = useAppTheme();
  const [formData, setFormData] = useState<FormData>({
    title: '',
    author: '',
    category: '',
    genres: [],
    description: '',
    published_year: '',
    isbn: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Initialize form data when book changes
  useEffect(() => {
    if (book) {
      setFormData({
        title: book.title || '',
        author: book.author || '',
        category: book.category || '',
        genres: book.genres || [],
        description: book.description || '',
        published_year: book.published_year?.toString() || '',
        isbn: book.isbn || '',
      });
      setErrors({});
      setTouched(new Set());
    }
  }, [book]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.author.trim()) {
      newErrors.author = 'Author is required';
    }

    if (formData.genres.length > 0) {
      const invalidGenres = formData.genres.filter(g => !PRIMARY_GENRES.includes(g));
      if (invalidGenres.length > 0) {
        newErrors.genres = `Invalid genres: ${invalidGenres.join(', ')}`;
      }
    }

    if (formData.published_year) {
      const year = parseInt(formData.published_year);
      if (isNaN(year) || year < 0 || year > new Date().getFullYear() + 1) {
        newErrors.published_year = 'Invalid year';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input change
  const handleChange = (field: keyof FormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => new Set(prev).add(field));
  };

  // Handle genre toggle
  const handleGenreToggle = (genre: string) => {
    setFormData(prev => {
      const newGenres = prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre].slice(0, 3); // Max 3 genres
      
      // Auto-sync category with first genre
      const newCategory = newGenres.length > 0 ? newGenres[0] : prev.category;
      
      return { ...prev, genres: newGenres, category: newCategory };
    });
    setTouched(prev => new Set(prev).add('genres'));
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setSaving(true);
    try {
      const updates: Partial<Book> = {
        title: formData.title.trim(),
        author: formData.author.trim(),
        category: formData.category.trim() || undefined,
        genres: formData.genres.length > 0 ? formData.genres : undefined,
        description: formData.description.trim() || undefined,
        published_year: formData.published_year ? parseInt(formData.published_year) : undefined,
        isbn: formData.isbn.trim() || undefined,
      };

      await onSave(updates);
    } finally {
      setSaving(false);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: theme.colors.secondarySurface }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${theme.colors.logoAccent}40` }}
        >
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.accent }}>
            Edit Book
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg transition-colors"
            style={{ color: theme.colors.mutedText }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.colors.primaryText }}>
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${errors.title && touched.has('title') ? '#ef4444' : theme.colors.logoAccent}40`,
                color: theme.colors.primaryText,
              }}
              placeholder="Enter book title"
            />
            {errors.title && touched.has('title') && (
              <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.title}
              </p>
            )}
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.colors.primaryText }}>
              Author <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => handleChange('author', e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${errors.author && touched.has('author') ? '#ef4444' : theme.colors.logoAccent}40`,
                color: theme.colors.primaryText,
              }}
              placeholder="Enter author name"
            />
            {errors.author && touched.has('author') && (
              <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.author}
              </p>
            )}
          </div>

          {/* Genres */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.colors.primaryText }}>
              Genres <span className="text-xs" style={{ color: theme.colors.mutedText }}>(select up to 3)</span>
            </label>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg" style={{ backgroundColor: theme.colors.primaryBg }}>
              {PRIMARY_GENRES.map(genre => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => handleGenreToggle(genre)}
                  disabled={!formData.genres.includes(genre) && formData.genres.length >= 3}
                  className="px-3 py-1.5 text-xs rounded-full transition-colors disabled:opacity-40"
                  style={{ 
                    backgroundColor: formData.genres.includes(genre) 
                      ? theme.colors.accent 
                      : `${theme.colors.logoAccent}30`,
                    color: formData.genres.includes(genre) 
                      ? '#fff' 
                      : theme.colors.primaryText,
                  }}
                >
                  {genre}
                </button>
              ))}
            </div>
            {errors.genres && (
              <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.genres}
              </p>
            )}
            {formData.genres.length > 0 && (
              <p className="mt-1 text-xs" style={{ color: theme.colors.mutedText }}>
                Selected: {formData.genres.join(', ')}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.colors.primaryText }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${theme.colors.logoAccent}40`,
                color: theme.colors.primaryText,
              }}
              placeholder="Enter book description"
            />
          </div>

          {/* Published Year and ISBN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: theme.colors.primaryText }}>
                Published Year
              </label>
              <input
                type="number"
                value={formData.published_year}
                onChange={(e) => handleChange('published_year', e.target.value)}
                min="0"
                max={new Date().getFullYear() + 1}
                className="w-full px-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${errors.published_year ? '#ef4444' : theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText,
                }}
                placeholder="e.g., 1984"
              />
              {errors.published_year && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.published_year}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: theme.colors.primaryText }}>
                ISBN
              </label>
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => handleChange('isbn', e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText,
                }}
                placeholder="e.g., 978-0-123456-78-9"
              />
            </div>
          </div>

          {/* Category (read-only, synced with first genre) */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.colors.primaryText }}>
              Category <span className="text-xs" style={{ color: theme.colors.mutedText }}>(auto-synced with first genre)</span>
            </label>
            <input
              type="text"
              value={formData.category}
              readOnly
              className="w-full px-4 py-2.5 text-sm rounded-lg cursor-not-allowed"
              style={{ 
                backgroundColor: `${theme.colors.primaryBg}80`,
                border: `1px solid ${theme.colors.logoAccent}40`,
                color: theme.colors.mutedText,
              }}
            />
          </div>
        </form>

        {/* Footer */}
        <div 
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: `1px solid ${theme.colors.logoAccent}40` }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg transition-colors"
            style={{ 
              border: `1px solid ${theme.colors.logoAccent}40`,
              color: theme.colors.primaryText,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: theme.colors.accent }}
          >
            {saving ? (
              <>
                <Loader size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookEditModal;
