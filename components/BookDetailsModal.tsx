import React, { useState, useEffect } from 'react';
import { Book, BookStatus, BorrowRequest } from '../types';
import { X, MapPin, Hash, Calendar, User, BookOpen, Download, ExternalLink, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface BookDetailsModalProps {
  book: Book;
  onClose: () => void;
  userId?: string;
  onBorrowRequest?: (bookId: string) => Promise<{ success: boolean; error?: string }>;
}

const BookDetailsModal: React.FC<BookDetailsModalProps> = ({ book, onClose, userId, onBorrowRequest }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [checkingRequest, setCheckingRequest] = useState(true);

  const currentUser = authService.getCurrentUser();

  // Record book view when modal opens (Requirement 5.2)
  useEffect(() => {
    const recordView = async () => {
      const viewUserId = userId || currentUser?.id;
      if (!viewUserId) return;
      
      try {
        await fetch(`${API_URL}/search-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: viewUserId, type: 'view', bookId: book.id })
        });
      } catch (err) {
        console.error('Failed to record book view:', err);
      }
    };
    
    recordView();
  }, [book.id, userId, currentUser?.id]);

  // Check if user has a pending request for this book
  useEffect(() => {
    const checkPendingRequest = async () => {
      if (!currentUser) {
        setCheckingRequest(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/borrow-requests/${currentUser.id}`);
        if (response.ok) {
          const requests: BorrowRequest[] = await response.json();
          const pendingForThisBook = requests.some(
            (req) => req.bookId === book.id && req.status === 'pending'
          );
          setHasPendingRequest(pendingForThisBook);
        }
      } catch (err) {
        console.error('Error checking pending requests:', err);
      } finally {
        setCheckingRequest(false);
      }
    };

    checkPendingRequest();
  }, [currentUser, book.id]);

  const handleBorrow = async () => {
    if (!currentUser) {
      setMessage({ type: 'error', text: 'Please log in to borrow books.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Use the onBorrowRequest handler if provided, otherwise call API directly
      if (onBorrowRequest) {
        const result = await onBorrowRequest(book.id);
        if (result.success) {
          setMessage({ type: 'success', text: '✅ Borrow request submitted! Please wait for admin approval. Check "My Loans" to track your request status.' });
          setHasPendingRequest(true);
        } else {
          setMessage({ type: 'error', text: result.error || 'Failed to submit borrow request.' });
        }
      } else {
        // Fallback to direct API call
        const response = await fetch(`${API_URL}/borrow-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, bookId: book.id })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setMessage({ type: 'success', text: '✅ Borrow request submitted! Please wait for admin approval. Check "My Loans" to track your request status.' });
          setHasPendingRequest(true);
        } else {
          setMessage({ type: 'error', text: data.error || 'Failed to submit borrow request.' });
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!currentUser) {
      setMessage({ type: 'error', text: 'Please log in to join the waitlist.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/waitlist/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, bookId: book.id })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: `✅ You've joined the waitlist! Your position: #${data.position}` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to join waitlist.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };
  const getStatusColor = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return 'bg-green-100 text-green-700 border-green-200';
      case BookStatus.WAITLIST: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case BookStatus.BORROWED: return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const getStatusIcon = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return <CheckCircle size={16} />;
      case BookStatus.WAITLIST: return <Clock size={16} />;
      case BookStatus.BORROWED: return <AlertCircle size={16} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 md:p-6 flex items-center justify-between z-10">
          <h2 className="text-xl md:text-2xl font-serif font-bold text-indigo-900">Book Details</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Book Cover */}
            <div className="md:col-span-1">
              <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-slate-200">
                <img 
                  src={book.coverUrl} 
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Status Badge */}
              <div className="mt-4">
                <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border font-semibold ${getStatusColor(book.status)}`}>
                  {getStatusIcon(book.status)}
                  {book.status}
                </div>
              </div>

              {/* Soft Copy Download */}
              {book.hasSoftCopy && book.softCopyUrl && (
                <div className="mt-4 space-y-2">
                  <a
                    href={book.softCopyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                  >
                    <ExternalLink size={18} />
                    View PDF Online
                  </a>
                  <a
                    href={book.softCopyUrl}
                    download={`${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                  >
                    <Download size={18} />
                    Download PDF
                  </a>
                  <p className="text-xs text-center text-slate-500">
                    Digital version available
                  </p>
                </div>
              )}
            </div>

            {/* Book Information */}
            <div className="md:col-span-2 space-y-6">
              {/* Title & Author */}
              <div>
                <h1 className="text-2xl md:text-3xl font-serif font-bold text-indigo-900 mb-2">
                  {book.title}
                </h1>
                <div className="flex items-center gap-2 text-slate-600">
                  <User size={16} />
                  <p className="text-lg">{book.author}</p>
                </div>
              </div>

              {/* Description */}
              {book.description && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase mb-2">Description</h3>
                  <p className="text-slate-700 leading-relaxed">{book.description}</p>
                </div>
              )}

              {/* Book Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                    <BookOpen size={16} />
                    <span className="font-medium">Category</span>
                  </div>
                  <p className="text-indigo-600 font-semibold">{book.category}</p>
                </div>

                {/* ISBN */}
                {book.isbn && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <Hash size={16} />
                      <span className="font-medium">ISBN</span>
                    </div>
                    <p className="text-slate-700 font-mono text-sm">{book.isbn}</p>
                  </div>
                )}

                {/* Published Year */}
                {book.publishedYear && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <Calendar size={16} />
                      <span className="font-medium">Published</span>
                    </div>
                    <p className="text-slate-700 font-semibold">{book.publishedYear}</p>
                  </div>
                )}

                {/* Publisher */}
                {book.publisher && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <BookOpen size={16} />
                      <span className="font-medium">Publisher</span>
                    </div>
                    <p className="text-slate-700">{book.publisher}</p>
                  </div>
                )}
              </div>

              {/* Library Location */}
              {book.callNumber && (
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                  <h3 className="text-sm font-semibold text-indigo-600 uppercase mb-3 flex items-center gap-2">
                    <MapPin size={16} />
                    Library Location
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Call Number</p>
                      <p className="font-bold text-indigo-600">{book.callNumber}</p>
                    </div>
                    {book.shelfLocation && (
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Shelf Location</p>
                        <p className="font-semibold text-slate-700">{book.shelfLocation}</p>
                      </div>
                    )}
                    {book.floorNumber && (
                      <div>
                        <p className="text-xs text-slate-600 mb-1">Floor</p>
                        <p className="font-semibold text-slate-700">Floor {book.floorNumber}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Availability */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-600 uppercase mb-3">Availability</h3>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Physical Copies</span>
                  <span className={`font-bold text-lg ${book.copiesAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {book.copiesAvailable} / {book.totalCopies}
                  </span>
                </div>
                <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${book.copiesAvailable > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${(book.copiesAvailable / book.totalCopies) * 100}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-200">
                {/* Message Display */}
                {message && (
                  <div className={`p-3 rounded-lg text-sm ${
                    message.type === 'success' 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {message.text}
                  </div>
                )}

                <div className="flex gap-3">
                  {book.status === BookStatus.AVAILABLE ? (
                    hasPendingRequest ? (
                      <button 
                        disabled
                        className="flex-1 py-3 bg-amber-100 text-amber-700 font-semibold rounded-lg border border-amber-200 flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <Clock size={18} />
                        Request Pending
                      </button>
                    ) : checkingRequest ? (
                      <button 
                        disabled
                        className="flex-1 py-3 bg-slate-100 text-slate-500 font-semibold rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <Loader2 size={18} className="animate-spin" />
                        Loading...
                      </button>
                    ) : (
                      <button 
                        onClick={handleBorrow}
                        disabled={isLoading}
                        className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Request to Borrow'
                        )}
                      </button>
                    )
                  ) : (
                    <button 
                      onClick={handleJoinWaitlist}
                      disabled={isLoading}
                      className="flex-1 py-3 border-2 border-amber-500 text-amber-600 font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Join Waitlist'
                      )}
                    </button>
                  )}
                  <button 
                    onClick={onClose}
                    className="px-6 py-3 border border-slate-300 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDetailsModal;
