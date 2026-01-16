/**
 * CoverUploadModal Component
 * 
 * Modal for uploading or updating book cover images.
 * Supports file upload with drag-and-drop and URL input.
 * 
 * Requirements: 3.1, 3.2, 3.4
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, Link, Image, Loader, AlertCircle, Check } from 'lucide-react';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { Book } from './BookManagementPanel';

// Supported image formats
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface CoverUploadModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File | string) => Promise<void>;
}

type UploadMode = 'file' | 'url';

const CoverUploadModal: React.FC<CoverUploadModalProps> = ({
  book,
  isOpen,
  onClose,
  onUpload,
}) => {
  const theme = useAppTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<UploadMode>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlPreview, setUrlPreview] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setUrlInput('');
      setUrlPreview(null);
      setUrlError(null);
      setError(null);
      setUploadProgress(0);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading) {
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
  }, [isOpen, uploading, onClose]);

  // Validate file
  const validateFile = (file: File): string | null => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return 'Invalid file format. Please use JPEG, PNG, or WebP.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 5MB.';
    }
    return null;
  };

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle URL input change
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setUrlInput(url);
    setUrlError(null);
    setUrlPreview(null);

    if (url.trim()) {
      // Validate URL format
      try {
        new URL(url);
        // Set preview after a short delay
        const timer = setTimeout(() => {
          setUrlPreview(url);
        }, 500);
        return () => clearTimeout(timer);
      } catch {
        setUrlError('Invalid URL format');
      }
    }
  };

  // Handle URL preview load error
  const handleUrlPreviewError = () => {
    setUrlError('Unable to load image from URL');
    setUrlPreview(null);
  };

  // Handle upload
  const handleUpload = async () => {
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      if (mode === 'file' && selectedFile) {
        await onUpload(selectedFile);
      } else if (mode === 'url' && urlInput.trim()) {
        await onUpload(urlInput.trim());
      }

      clearInterval(progressInterval);
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Check if can upload
  const canUpload = mode === 'file' 
    ? selectedFile !== null 
    : urlInput.trim() !== '' && !urlError;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: theme.colors.secondarySurface }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${theme.colors.logoAccent}40` }}
        >
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.accent }}>
            Update Cover Image
          </h3>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 rounded-lg transition-colors"
            style={{ color: theme.colors.mutedText }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Book Info */}
          <div className="flex items-center gap-3">
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
                  <Image size={20} style={{ color: theme.colors.mutedText }} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h4 
                className="font-medium text-sm line-clamp-1"
                style={{ color: theme.colors.primaryText }}
              >
                {book.title}
              </h4>
              <p className="text-xs" style={{ color: theme.colors.mutedText }}>
                {book.author}
              </p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('file')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors"
              style={{ 
                backgroundColor: mode === 'file' ? `${theme.colors.accent}20` : theme.colors.primaryBg,
                border: `1px solid ${mode === 'file' ? theme.colors.accent : theme.colors.logoAccent}40`,
                color: mode === 'file' ? theme.colors.accent : theme.colors.primaryText,
              }}
            >
              <Upload size={16} />
              Upload File
            </button>
            <button
              onClick={() => setMode('url')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors"
              style={{ 
                backgroundColor: mode === 'url' ? `${theme.colors.accent}20` : theme.colors.primaryBg,
                border: `1px solid ${mode === 'url' ? theme.colors.accent : theme.colors.logoAccent}40`,
                color: mode === 'url' ? theme.colors.accent : theme.colors.primaryText,
              }}
            >
              <Link size={16} />
              Enter URL
            </button>
          </div>

          {/* File Upload Mode */}
          {mode === 'file' && (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
                style={{ 
                  borderColor: isDragging ? theme.colors.accent : `${theme.colors.logoAccent}60`,
                  backgroundColor: isDragging ? `${theme.colors.accent}10` : 'transparent',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={SUPPORTED_FORMATS.join(',')}
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                
                {previewUrl ? (
                  <div className="space-y-3">
                    <img 
                      src={previewUrl} 
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-lg shadow-lg"
                    />
                    <p className="text-sm" style={{ color: theme.colors.primaryText }}>
                      {selectedFile?.name}
                    </p>
                    <p className="text-xs" style={{ color: theme.colors.mutedText }}>
                      Click or drag to replace
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload 
                      size={40} 
                      className="mx-auto"
                      style={{ color: theme.colors.mutedText }}
                    />
                    <div>
                      <p className="text-sm font-medium" style={{ color: theme.colors.primaryText }}>
                        Drop image here or click to browse
                      </p>
                      <p className="text-xs mt-1" style={{ color: theme.colors.mutedText }}>
                        JPEG, PNG, or WebP • Max 5MB
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* URL Input Mode */}
          {mode === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: theme.colors.primaryText }}>
                  Image URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={handleUrlChange}
                  placeholder="https://example.com/cover.jpg"
                  className="w-full px-4 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${urlError ? '#ef4444' : theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText,
                  }}
                />
                {urlError && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {urlError}
                  </p>
                )}
              </div>

              {/* URL Preview */}
              {urlPreview && !urlError && (
                <div 
                  className="p-4 rounded-lg text-center"
                  style={{ backgroundColor: theme.colors.primaryBg }}
                >
                  <img 
                    src={urlPreview} 
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg shadow-lg"
                    onError={handleUrlPreviewError}
                  />
                  <p className="text-xs mt-2 flex items-center justify-center gap-1" style={{ color: '#4ade80' }}>
                    <Check size={12} />
                    Image loaded successfully
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div 
              className="p-3 rounded-lg flex items-center gap-2 text-sm"
              style={{ 
                backgroundColor: '#3d1f1f',
                border: '1px solid #991b1b',
                color: '#f87171'
              }}
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs" style={{ color: theme.colors.mutedText }}>
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div 
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: `${theme.colors.logoAccent}30` }}
              >
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ 
                    backgroundColor: theme.colors.accent,
                    width: `${uploadProgress}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: `1px solid ${theme.colors.logoAccent}40` }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm rounded-lg transition-colors"
            style={{ 
              border: `1px solid ${theme.colors.logoAccent}40`,
              color: theme.colors.primaryText,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!canUpload || uploading}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: theme.colors.accent }}
          >
            {uploading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload Cover
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverUploadModal;
