import React, { useState, useEffect, useRef } from 'react';
import { Book, BorrowRequest } from '../types';
import { 
  Plus, Trash2, Edit2, Save, X, Package, AlertCircle, Search,
  SortAsc, SortDesc, Filter, Image, Calendar, TrendingUp, Users,
  BookOpen, UserCog, Shield, GraduationCap, ClipboardList, Check, XCircle, Clock,
  Download, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';
import { authService } from '../services/authService';
import { uploadPdfToSupabase, isDirectUploadAvailable } from '../services/supabaseClient';
import LiveTimer from './LiveTimer';
import ExtractionPanel from './ExtractionPanel';
import { useAppTheme } from '../hooks/useAppTheme';

// Use environment variable or relative path for Vercel deployment
const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Category {
  id: string;
  name: string;
}

interface BookWithDetails extends Book {
  isbn?: string;
  publishedYear?: number;
  addedDate?: string;
  borrowCount?: number;
  categoryId?: string;
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'Reader' | 'Premium' | 'Admin';
  created_at: string;
}

interface ActiveLoan {
  id: string;
  checkoutDate: string;
  dueDate: string;
  isOverdue: boolean;
  fineAmount: number;
  daysRemaining: number;
  userId: string;
  userName: string;
  userUsername: string;
  book: {
    id: string;
    title: string;
    author: string;
    coverUrl: string;
    category: string;
  };
}

type SortField = 'title' | 'author' | 'popularity' | 'publishedYear' | 'addedDate' | 'borrowCount';
type SortOrder = 'asc' | 'desc';
type AdminTab = 'books' | 'users' | 'requests' | 'loans' | 'extractions';

const AdminPanel: React.FC = () => {
  const theme = useAppTheme();
  const [activeTab, setActiveTab] = useState<AdminTab>('books');
  const [books, setBooks] = useState<BookWithDetails[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([]);
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBook, setEditingBook] = useState<BookWithDetails | null>(null);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Mobile navigation state (Requirement 9.1, 9.2)
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [yearFilter, setYearFilter] = useState<string>('');
  
  // Borrow requests state
  const [requestSearchQuery, setRequestSearchQuery] = useState('');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Active loans state
  const [loansSearchQuery, setLoansSearchQuery] = useState('');

  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    categoryId: '',
    coverUrl: '',
    description: '',
    totalCopies: 1,
    copiesAvailable: 1,
    isbn: '',
    publishedYear: new Date().getFullYear(),
    publisher: '',
    callNumber: '',
    shelfLocation: '',
    floorNumber: 1,
    softCopyUrl: '',
    hasSoftCopy: false
  });

  useEffect(() => {
    fetchBooks();
    fetchCategories();
    fetchUsers();
    fetchBorrowRequests();
    fetchActiveLoans();
  }, []);

  // Check scroll position for tab navigation arrows (Requirement 9.1, 9.5)
  useEffect(() => {
    const checkScroll = () => {
      if (tabsContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      }
    };

    const container = tabsContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  // Scroll tabs left/right (Requirement 9.1)
  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = 150;
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Handle tab change and close mobile menu
  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setShowMobileMenu(false);
  };

  const fetchBooks = async () => {
    try {
      const response = await fetch(`${API_URL}/books`);
      if (response.ok) {
        const data = await response.json();
        setBooks(data);
      }
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/users`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchBorrowRequests = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/borrow-requests`);
      if (response.ok) {
        const data = await response.json();
        setBorrowRequests(data);
      }
    } catch (err) {
      console.error('Failed to fetch borrow requests:', err);
    }
  };

  const fetchActiveLoans = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/active-loans`);
      if (response.ok) {
        const data = await response.json();
        setActiveLoans(data);
      }
    } catch (err) {
      console.error('Failed to fetch active loans:', err);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      // Find the request being approved to get the bookId
      const approvedRequest = borrowRequests.find(r => r.id === requestId);
      const currentUser = authService.getCurrentUser();
      
      const response = await fetch(`${API_URL}/admin/borrow-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentUser?.id })
      });

      if (response.ok) {
        showMessage('success', 'Request approved successfully! Loan created.');
        
        // Update local state immediately for real-time count update
        if (approvedRequest) {
          // Update copies_available for all other requests of the same book
          setBorrowRequests(prevRequests => 
            prevRequests
              .filter(r => r.id !== requestId) // Remove approved request
              .map(r => {
                if (r.bookId === approvedRequest.bookId) {
                  // Decrement copies_available for requests of the same book
                  return {
                    ...r,
                    copiesAvailable: Math.max(0, (r.copiesAvailable || 0) - 1)
                  };
                }
                return r;
              })
          );
        }
        
        // Also refresh from server to ensure consistency
        fetchBorrowRequests();
        fetchBooks(); // Refresh book counts
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to approve request');
      }
    } catch (err) {
      showMessage('error', 'Failed to approve request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      const currentUser = authService.getCurrentUser();
      
      const response = await fetch(`${API_URL}/admin/borrow-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentUser?.id, rejectionReason: rejectionReason || undefined })
      });

      if (response.ok) {
        showMessage('success', 'Request rejected successfully.');
        fetchBorrowRequests();
        setRejectingRequestId(null);
        setRejectionReason('');
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to reject request');
      }
    } catch (err) {
      showMessage('error', 'Failed to reject request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'Reader' | 'Premium' | 'Admin') => {
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        showMessage('success', 'User role updated successfully!');
        fetchUsers();
        setEditingUser(null);
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to update user role');
      }
    } catch (err) {
      showMessage('error', 'Failed to update user role');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/admin/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBook)
      });

      const data = await response.json();
      
      if (response.ok) {
        showMessage('success', 'Book added successfully!');
        setShowAddForm(false);
        resetNewBookForm();
        fetchBooks();
      } else {
        console.error('Failed to add book:', data);
        showMessage('error', data.error || 'Failed to add book');
      }
    } catch (err) {
      console.error('Error adding book:', err);
      showMessage('error', 'Failed to add book - network error');
    }
  };

  const handleUpdateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;

    try {
      const response = await fetch(`${API_URL}/admin/books/${editingBook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingBook.title,
          author: editingBook.author,
          categoryId: editingBook.categoryId,
          coverUrl: editingBook.coverUrl,
          description: editingBook.description,
          isbn: editingBook.isbn,
          publishedYear: editingBook.publishedYear,
          totalCopies: editingBook.totalCopies,
          copiesAvailable: editingBook.copiesAvailable,
          callNumber: editingBook.callNumber,
          shelfLocation: editingBook.shelfLocation,
          floorNumber: editingBook.floorNumber,
          softCopyUrl: editingBook.softCopyUrl,
          hasSoftCopy: editingBook.hasSoftCopy
        })
      });

      if (response.ok) {
        showMessage('success', 'Book updated successfully!');
        setEditingBook(null);
        fetchBooks();
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to update book');
      }
    } catch (err) {
      showMessage('error', 'Failed to update book');
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) return;

    try {
      const response = await fetch(`${API_URL}/admin/books/${bookId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showMessage('success', 'Book deleted successfully!');
        fetchBooks();
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to delete book');
      }
    } catch (err) {
      showMessage('error', 'Failed to delete book');
    }
  };

  const resetNewBookForm = () => {
    setNewBook({
      title: '',
      author: '',
      categoryId: '',
      coverUrl: '',
      description: '',
      totalCopies: 1,
      copiesAvailable: 1,
      isbn: '',
      publishedYear: new Date().getFullYear(),
      publisher: '',
      callNumber: '',
      shelfLocation: '',
      floorNumber: 1,
      softCopyUrl: '',
      hasSoftCopy: false
    });
  };

  const filteredBooks = books
    .filter(book => {
      const matchesSearch = 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.isbn && book.isbn.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
      const matchesStatus = statusFilter === 'All' || book.status === statusFilter;
      const matchesYear = !yearFilter || book.publishedYear?.toString() === yearFilter;
      return matchesSearch && matchesCategory && matchesStatus && matchesYear;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'author':
          comparison = a.author.localeCompare(b.author);
          break;
        case 'popularity':
          comparison = (a.popularity || 0) - (b.popularity || 0);
          break;
        case 'publishedYear':
          comparison = (a.publishedYear || 0) - (b.publishedYear || 0);
          break;
        case 'borrowCount':
          comparison = (a.borrowCount || 0) - (b.borrowCount || 0);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const uniqueYears = [...new Set(books.map(b => b.publishedYear).filter(Boolean) as number[])].sort((a, b) => b - a);

  // Filter borrow requests
  const filteredRequests = borrowRequests.filter(request => {
    const searchLower = requestSearchQuery.toLowerCase();
    return (
      (request.userName?.toLowerCase().includes(searchLower) || false) ||
      (request.userUsername?.toLowerCase().includes(searchLower) || false) ||
      (request.bookTitle?.toLowerCase().includes(searchLower) || false) ||
      (request.bookAuthor?.toLowerCase().includes(searchLower) || false)
    );
  });

  const pendingRequestsCount = borrowRequests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div 
          className="h-8 w-8 border-4 rounded-full animate-spin"
          style={{ 
            borderColor: `${theme.colors.accent}30`,
            borderTopColor: theme.colors.accent 
          }} 
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <header className="mb-6 md:mb-8">
        <h2 
          className="text-2xl md:text-3xl font-serif font-bold mb-2"
          style={{ color: theme.colors.accent }}
        >
          Admin Panel
        </h2>
        <p 
          className="text-sm md:text-base"
          style={{ color: theme.colors.mutedText }}
        >
          Manage book inventory, users, and library resources.
        </p>
      </header>

      {/* Mobile Tab Navigation - Dropdown (Requirement 9.2) */}
      <div className="md:hidden mb-6">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg shadow-sm"
          style={{ 
            backgroundColor: theme.colors.secondarySurface,
            border: `1px solid ${theme.colors.logoAccent}40`
          }}
          aria-expanded={showMobileMenu}
          aria-haspopup="true"
        >
          <span 
            className="flex items-center gap-2 font-medium"
            style={{ color: theme.colors.accent }}
          >
            {activeTab === 'books' && <><BookOpen size={18} /> Books Management</>}
            {activeTab === 'users' && <><UserCog size={18} /> User Management</>}
            {activeTab === 'requests' && (
              <>
                <ClipboardList size={18} /> Borrow Requests
                {pendingRequestsCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                  </span>
                )}
              </>
            )}
            {activeTab === 'loans' && (
              <>
                <Clock size={18} /> Active Loans
                {activeLoans.length > 0 && (
                  <span 
                    className="text-xs font-bold rounded-full px-2 py-0.5"
                    style={{ backgroundColor: `${theme.colors.accent}20`, color: theme.colors.accent }}
                  >
                    {activeLoans.length}
                  </span>
                )}
              </>
            )}
            {activeTab === 'extractions' && <><Download size={18} /> Extractions</>}
          </span>
          <Menu 
            size={20} 
            className={`transition-transform ${showMobileMenu ? 'rotate-90' : ''}`}
            style={{ color: theme.colors.mutedText }}
          />
        </button>

        {/* Mobile Dropdown Menu (Requirement 9.3) */}
        {showMobileMenu && (
          <div 
            className="absolute left-4 right-4 mt-1 rounded-lg shadow-lg z-40 overflow-hidden"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <button
              onClick={() => handleTabChange('books')}
              className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors"
              style={{ 
                backgroundColor: activeTab === 'books' ? `${theme.colors.accent}15` : 'transparent',
                color: activeTab === 'books' ? theme.colors.accent : theme.colors.primaryText
              }}
            >
              <BookOpen size={18} />
              Books Management
            </button>
            <button
              onClick={() => handleTabChange('users')}
              className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors"
              style={{ 
                backgroundColor: activeTab === 'users' ? `${theme.colors.accent}15` : 'transparent',
                color: activeTab === 'users' ? theme.colors.accent : theme.colors.primaryText
              }}
            >
              <UserCog size={18} />
              User Management
            </button>
            <button
              onClick={() => handleTabChange('requests')}
              className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
              style={{ 
                backgroundColor: activeTab === 'requests' ? `${theme.colors.accent}15` : 'transparent',
                color: activeTab === 'requests' ? theme.colors.accent : theme.colors.primaryText
              }}
            >
              <span className="flex items-center gap-2">
                <ClipboardList size={18} />
                Borrow Requests
              </span>
              {pendingRequestsCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('loans')}
              className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
              style={{ 
                backgroundColor: activeTab === 'loans' ? `${theme.colors.accent}15` : 'transparent',
                color: activeTab === 'loans' ? theme.colors.accent : theme.colors.primaryText
              }}
            >
              <span className="flex items-center gap-2">
                <Clock size={18} />
                Active Loans
              </span>
              {activeLoans.length > 0 && (
                <span 
                  className="text-xs font-bold rounded-full px-2 py-0.5"
                  style={{ backgroundColor: `${theme.colors.accent}20`, color: theme.colors.accent }}
                >
                  {activeLoans.length}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('extractions')}
              className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors"
              style={{ 
                backgroundColor: activeTab === 'extractions' ? `${theme.colors.accent}15` : 'transparent',
                color: activeTab === 'extractions' ? theme.colors.accent : theme.colors.primaryText
              }}
            >
              <Download size={18} />
              Extractions
            </button>
          </div>
        )}
      </div>

      {/* Desktop Tab Navigation - Horizontal scrollable (Requirement 9.1, 9.4, 9.5) */}
      <div className="hidden md:block relative mb-6">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={() => scrollTabs('left')}
            className="absolute left-0 top-0 bottom-0 z-10 px-2 flex items-center"
            style={{ 
              background: `linear-gradient(to right, ${theme.colors.primaryBg}, ${theme.colors.primaryBg}, transparent)`
            }}
            aria-label="Scroll tabs left"
          >
            <ChevronLeft size={20} style={{ color: theme.colors.mutedText }} />
          </button>
        )}

        {/* Scrollable tabs container */}
        <div
          ref={tabsContainerRef}
          className="flex gap-1 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            borderBottom: `1px solid ${theme.colors.logoAccent}40`
          }}
        >
          <button
            onClick={() => setActiveTab('books')}
            className="flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap"
            style={{ 
              color: activeTab === 'books' ? theme.colors.accent : theme.colors.mutedText,
              borderBottom: activeTab === 'books' ? `2px solid ${theme.colors.accent}` : '2px solid transparent'
            }}
          >
            <BookOpen size={18} />
            Books Management
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className="flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap"
            style={{ 
              color: activeTab === 'users' ? theme.colors.accent : theme.colors.mutedText,
              borderBottom: activeTab === 'users' ? `2px solid ${theme.colors.accent}` : '2px solid transparent'
            }}
          >
            <UserCog size={18} />
            User Management
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className="flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap"
            style={{ 
              color: activeTab === 'requests' ? theme.colors.accent : theme.colors.mutedText,
              borderBottom: activeTab === 'requests' ? `2px solid ${theme.colors.accent}` : '2px solid transparent'
            }}
          >
            <ClipboardList size={18} />
            Borrow Requests
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('loans')}
            className="flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap"
            style={{ 
              color: activeTab === 'loans' ? theme.colors.accent : theme.colors.mutedText,
              borderBottom: activeTab === 'loans' ? `2px solid ${theme.colors.accent}` : '2px solid transparent'
            }}
          >
            <Clock size={18} />
            Active Loans
            {activeLoans.length > 0 && (
              <span 
                className="text-xs font-bold rounded-full px-2 py-0.5 ml-1"
                style={{ backgroundColor: `${theme.colors.accent}20`, color: theme.colors.accent }}
              >
                {activeLoans.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('extractions')}
            className="flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap"
            style={{ 
              color: activeTab === 'extractions' ? theme.colors.accent : theme.colors.mutedText,
              borderBottom: activeTab === 'extractions' ? `2px solid ${theme.colors.accent}` : '2px solid transparent'
            }}
          >
            <Download size={18} />
            Extractions
          </button>
        </div>

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={() => scrollTabs('right')}
            className="absolute right-0 top-0 bottom-0 z-10 px-2 flex items-center"
            style={{ 
              background: `linear-gradient(to left, ${theme.colors.primaryBg}, ${theme.colors.primaryBg}, transparent)`
            }}
            aria-label="Scroll tabs right"
          >
            <ChevronRight size={20} style={{ color: theme.colors.mutedText }} />
          </button>
        )}
      </div>

      {message && (
        <div 
          className="fixed top-20 md:top-24 right-4 left-4 md:left-auto px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm"
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

      {activeTab === 'books' && (
        <>
          <div 
            className="p-3 md:p-4 rounded-xl mb-6 space-y-3 md:space-y-4"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="relative w-full">
                <Search 
                  className="absolute left-3 top-1/2 -translate-y-1/2" 
                  size={16}
                  style={{ color: theme.colors.mutedText }}
                />
                <input
                  type="text"
                  placeholder="Search by title, author, or ISBN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText,
                    '--tw-ring-color': `${theme.colors.accent}40`
                  } as React.CSSProperties}
                />
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 text-white text-sm rounded-lg transition-colors whitespace-nowrap w-full md:w-auto"
                style={{ backgroundColor: theme.colors.accent }}
              >
                <Plus size={16} />
                Add New Book
              </button>
            </div>

            <div 
              className="flex flex-col sm:flex-row flex-wrap gap-2 md:gap-3 items-start sm:items-center pt-3"
              style={{ borderTop: `1px solid ${theme.colors.logoAccent}30` }}
            >
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={14} className="hidden sm:block" style={{ color: theme.colors.mutedText }} />
                <span className="text-xs" style={{ color: theme.colors.mutedText }}>Filters:</span>
              </div>
              
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="flex-1 sm:flex-none px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText
                  }}
                >
                  <option value="All">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText
                  }}
                >
                  <option value="All">All Status</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="BORROWED">Borrowed</option>
                  <option value="WAITLIST">Waitlist</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                <span className="text-xs" style={{ color: theme.colors.mutedText }}>Sort:</span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="flex-1 sm:flex-none px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText
                  }}
                >
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                  <option value="popularity">Popularity</option>
                  <option value="publishedYear">Year</option>
                  <option value="borrowCount">Borrowed</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 rounded-lg"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText
                  }}
                >
                  {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                </button>
              </div>
            </div>
          </div>

          {showAddForm && (
            <BookFormModal
              title="Add New Book"
              book={newBook}
              categories={categories}
              onClose={() => setShowAddForm(false)}
              onSubmit={handleAddBook}
              onChange={setNewBook}
            />
          )}

          {editingBook && (
            <BookFormModal
              title="Edit Book"
              book={editingBook}
              categories={categories}
              onClose={() => setEditingBook(null)}
              onSubmit={handleUpdateBook}
              onChange={(updates) => setEditingBook({ ...editingBook, ...updates })}
              isEdit
            />
          )}

          <div 
            className="rounded-xl overflow-hidden hidden md:block"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: theme.colors.primaryBg, borderBottom: `1px solid ${theme.colors.logoAccent}40` }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Book</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Category</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Year</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Stock</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Borrowed</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Status</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.map((book, index) => (
                    <tr 
                      key={book.id} 
                      style={{ 
                        borderBottom: index < filteredBooks.length - 1 ? `1px solid ${theme.colors.logoAccent}20` : 'none'
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            className="w-12 h-16 object-cover rounded shadow-sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[200px]" style={{ color: theme.colors.accent }}>{book.title}</p>
                            <p className="text-sm" style={{ color: theme.colors.mutedText }}>{book.author}</p>
                            {book.isbn && <p className="text-xs" style={{ color: theme.colors.mutedText }}>ISBN: {book.isbn}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className="text-sm px-2 py-1 rounded"
                          style={{ backgroundColor: theme.colors.primaryBg, color: theme.colors.primaryText }}
                        >
                          {book.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{ color: theme.colors.primaryText }}>
                        {book.publishedYear || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${book.copiesAvailable > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {book.copiesAvailable} / {book.totalCopies}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm" style={{ color: theme.colors.primaryText }}>{book.borrowCount || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          book.status === 'AVAILABLE' 
                            ? 'bg-green-900/50 text-green-400' 
                            : book.status === 'WAITLIST'
                            ? 'bg-yellow-900/50 text-yellow-400'
                            : 'bg-red-900/50 text-red-400'
                        }`}>
                          {book.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingBook(book)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: theme.colors.accent }}
                            title="Edit Book"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteBook(book.id)}
                            className="p-2 text-red-400 rounded-lg transition-colors"
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

            {filteredBooks.length === 0 && (
              <div className="text-center py-12" style={{ color: theme.colors.mutedText }}>
                No books found matching your filters.
              </div>
            )}
          </div>

          <div className="md:hidden space-y-3">
            {filteredBooks.map((book) => (
              <div 
                key={book.id} 
                className="p-3 rounded-xl"
                style={{ 
                  backgroundColor: theme.colors.secondarySurface,
                  border: `1px solid ${theme.colors.logoAccent}40`
                }}
              >
                <div className="flex gap-3">
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-16 h-20 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: theme.colors.accent }}>{book.title}</p>
                    <p className="text-xs truncate" style={{ color: theme.colors.mutedText }}>{book.author}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span 
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: theme.colors.primaryBg, color: theme.colors.primaryText }}
                      >
                        {book.category}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        book.status === 'AVAILABLE' 
                          ? 'bg-green-900/50 text-green-400' 
                          : book.status === 'WAITLIST'
                          ? 'bg-yellow-900/50 text-yellow-400'
                          : 'bg-red-900/50 text-red-400'
                      }`}>
                        {book.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs font-medium ${book.copiesAvailable > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Stock: {book.copiesAvailable}/{book.totalCopies}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingBook(book)}
                          className="p-1.5 rounded"
                          style={{ color: theme.colors.accent }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book.id)}
                          className="p-1.5 text-red-400 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredBooks.length === 0 && (
              <div 
                className="text-center py-12 rounded-xl"
                style={{ 
                  backgroundColor: theme.colors.secondarySurface,
                  color: theme.colors.mutedText
                }}
              >
                No books found matching your filters.
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-right" style={{ color: theme.colors.mutedText }}>
            Showing {filteredBooks.length} of {books.length} books
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <div 
              className="p-3 md:p-4 rounded-xl"
              style={{ 
                backgroundColor: theme.colors.secondarySurface,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-lg" style={{ backgroundColor: `${theme.colors.accent}20` }}>
                  <Users size={16} style={{ color: theme.colors.accent }} />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold" style={{ color: theme.colors.accent }}>{users.length}</p>
                  <p className="text-[10px] md:text-xs" style={{ color: theme.colors.mutedText }}>Total Users</p>
                </div>
              </div>
            </div>
            <div 
              className="p-3 md:p-4 rounded-xl"
              style={{ 
                backgroundColor: theme.colors.secondarySurface,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}>
                  <GraduationCap size={16} className="text-green-400" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-green-400">
                    {users.filter(u => u.role === 'Reader').length}
                  </p>
                  <p className="text-[10px] md:text-xs" style={{ color: theme.colors.mutedText }}>Readers</p>
                </div>
              </div>
            </div>
            <div 
              className="p-3 md:p-4 rounded-xl"
              style={{ 
                backgroundColor: theme.colors.secondarySurface,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-lg" style={{ backgroundColor: 'rgba(251, 146, 60, 0.2)' }}>
                  <Shield size={16} className="text-orange-400" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-orange-400">
                    {users.filter(u => u.role === 'Admin').length}
                  </p>
                  <p className="text-[10px] md:text-xs" style={{ color: theme.colors.mutedText }}>Admins</p>
                </div>
              </div>
            </div>
          </div>

          <div 
            className="p-3 md:p-4 rounded-xl"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: theme.colors.mutedText }} />
              <input
                type="text"
                placeholder="Search users by name, email, or admission number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText
                }}
              />
            </div>
          </div>

          <div 
            className="rounded-xl overflow-hidden hidden md:block"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: theme.colors.primaryBg, borderBottom: `1px solid ${theme.colors.logoAccent}40` }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>User</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Admission/Employee ID</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Current Role</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Joined</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter(user => 
                      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      user.username.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((user, index, arr) => (
                    <tr 
                      key={user.id}
                      style={{ borderBottom: index < arr.length - 1 ? `1px solid ${theme.colors.logoAccent}20` : 'none' }}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium" style={{ color: theme.colors.accent }}>{user.name}</p>
                          <p className="text-sm" style={{ color: theme.colors.mutedText }}>{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className="text-sm font-mono px-2 py-1 rounded"
                          style={{ backgroundColor: theme.colors.primaryBg, color: theme.colors.primaryText }}
                        >
                          {user.username}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingUser?.id === user.id ? (
                          <select
                            value={editingUser.role}
                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                            className="px-3 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2"
                            style={{ 
                              backgroundColor: theme.colors.primaryBg,
                              border: `1px solid ${theme.colors.logoAccent}40`,
                              color: theme.colors.primaryText
                            }}
                          >
                            <option value="Student">Student</option>
                            <option value="Lecturer">Lecturer</option>
                            <option value="Faculty">Faculty</option>
                            <option value="Admin">Admin</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            user.role === 'Admin' 
                              ? 'bg-orange-900/50 text-orange-400' 
                              : user.role === 'Premium'
                              ? 'bg-purple-900/50 text-purple-400'
                              : 'bg-blue-900/50 text-blue-400'
                          }`}>
                            {user.role === 'Admin' && <Shield size={12} />}
                            {user.role === 'Reader' && <GraduationCap size={12} />}
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{ color: theme.colors.primaryText }}>
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {editingUser?.id === user.id ? (
                            <>
                              <button
                                onClick={() => handleUpdateUserRole(user.id, editingUser.role)}
                                className="p-2 text-green-400 rounded-lg"
                                title="Save Changes"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={() => setEditingUser(null)}
                                className="p-2 rounded-lg"
                                style={{ color: theme.colors.mutedText }}
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setEditingUser(user)}
                              className="p-2 rounded-lg"
                              style={{ color: theme.colors.accent }}
                              title="Edit Role"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {users.filter(user => 
              user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.username.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && (
              <div className="text-center py-12" style={{ color: theme.colors.mutedText }}>
                No users found matching your search.
              </div>
            )}
          </div>

          <div className="md:hidden space-y-3">
            {users
              .filter(user => 
                user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.username.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((user) => (
              <div 
                key={user.id} 
                className="p-4 rounded-xl"
                style={{ 
                  backgroundColor: theme.colors.secondarySurface,
                  border: `1px solid ${theme.colors.logoAccent}40`
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: theme.colors.accent }}>{user.name}</p>
                    <p className="text-xs truncate" style={{ color: theme.colors.mutedText }}>{user.email}</p>
                    <p 
                      className="text-xs font-mono px-2 py-0.5 rounded inline-block mt-1"
                      style={{ backgroundColor: theme.colors.primaryBg, color: theme.colors.primaryText }}
                    >
                      {user.username}
                    </p>
                  </div>
                  {editingUser?.id === user.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleUpdateUserRole(user.id, editingUser.role)}
                        className="p-1.5 text-green-400 rounded"
                      >
                        <Save size={14} />
                      </button>
                      <button
                        onClick={() => setEditingUser(null)}
                        className="p-1.5 rounded"
                        style={{ color: theme.colors.mutedText }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingUser(user)}
                      className="p-1.5 rounded"
                      style={{ color: theme.colors.accent }}
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs mb-1" style={{ color: theme.colors.mutedText }}>Role:</p>
                    {editingUser?.id === user.id ? (
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                        className="px-2 py-1 text-xs rounded focus:outline-none focus:ring-2"
                        style={{ 
                          backgroundColor: theme.colors.primaryBg,
                          border: `1px solid ${theme.colors.logoAccent}40`,
                          color: theme.colors.primaryText
                        }}
                      >
                        <option value="Student">Student</option>
                        <option value="Lecturer">Lecturer</option>
                        <option value="Faculty">Faculty</option>
                        <option value="Admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'Admin' 
                          ? 'bg-orange-900/50 text-orange-400' 
                          : user.role === 'Premium'
                          ? 'bg-purple-900/50 text-purple-400'
                          : 'bg-blue-900/50 text-blue-400'
                      }`}>
                        {user.role === 'Admin' && <Shield size={10} />}
                        {user.role === 'Reader' && <GraduationCap size={10} />}
                        {user.role}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs mb-1" style={{ color: theme.colors.mutedText }}>Joined:</p>
                    <p className="text-xs" style={{ color: theme.colors.primaryText }}>{new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {users.filter(user => 
              user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.username.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && (
              <div 
                className="text-center py-12 rounded-xl"
                style={{ 
                  backgroundColor: theme.colors.secondarySurface,
                  color: theme.colors.mutedText
                }}
              >
                No users found matching your search.
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-right" style={{ color: theme.colors.mutedText }}>
            Showing {users.filter(user => 
              user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.username.toLowerCase().includes(searchQuery.toLowerCase())
            ).length} of {users.length} users
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Search and filter */}
          <div 
            className="p-3 md:p-4 rounded-xl"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: theme.colors.mutedText }} />
              <input
                type="text"
                placeholder="Search by user name, admission number, book title, or author..."
                value={requestSearchQuery}
                onChange={(e) => setRequestSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText
                }}
              />
            </div>
          </div>

          {/* Desktop table view */}
          <div 
            className="rounded-xl overflow-hidden hidden md:block"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: theme.colors.primaryBg, borderBottom: `1px solid ${theme.colors.logoAccent}40` }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Book</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Requested By</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Available</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Requested</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request, index) => (
                    <tr 
                      key={request.id}
                      style={{ borderBottom: index < filteredRequests.length - 1 ? `1px solid ${theme.colors.logoAccent}20` : 'none' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={request.bookCoverUrl || 'https://via.placeholder.com/48x64'}
                            alt={request.bookTitle}
                            className="w-12 h-16 object-cover rounded shadow-sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[200px]" style={{ color: theme.colors.accent }}>{request.bookTitle}</p>
                            <p className="text-sm" style={{ color: theme.colors.mutedText }}>{request.bookAuthor}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium" style={{ color: theme.colors.primaryText }}>{request.userName}</p>
                          <p 
                            className="text-xs font-mono px-2 py-0.5 rounded inline-block"
                            style={{ backgroundColor: theme.colors.primaryBg, color: theme.colors.mutedText }}
                          >
                            {request.userUsername}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${(request.copiesAvailable || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {request.copiesAvailable || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{ color: theme.colors.primaryText }}>
                        {new Date(request.requestedAt).toLocaleDateString()}
                        <br />
                        <span className="text-xs" style={{ color: theme.colors.mutedText }}>
                          {new Date(request.requestedAt).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {rejectingRequestId === request.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              placeholder="Rejection reason (optional)"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              className="px-2 py-1 text-xs rounded focus:outline-none focus:ring-2"
                              style={{ 
                                backgroundColor: theme.colors.primaryBg,
                                border: `1px solid ${theme.colors.logoAccent}40`,
                                color: theme.colors.primaryText
                              }}
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleRejectRequest(request.id)}
                                disabled={processingRequestId === request.id}
                                className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                {processingRequestId === request.id ? 'Rejecting...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => { setRejectingRequestId(null); setRejectionReason(''); }}
                                className="px-2 py-1 text-xs rounded"
                                style={{ 
                                  border: `1px solid ${theme.colors.logoAccent}40`,
                                  color: theme.colors.primaryText
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleApproveRequest(request.id)}
                              disabled={processingRequestId === request.id || (request.copiesAvailable || 0) === 0}
                              className="p-2 text-green-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              title={request.copiesAvailable === 0 ? 'No copies available' : 'Approve Request'}
                            >
                              {processingRequestId === request.id ? (
                                <div className="h-4 w-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                              ) : (
                                <Check size={16} />
                              )}
                            </button>
                            <button
                              onClick={() => setRejectingRequestId(request.id)}
                              disabled={processingRequestId === request.id}
                              className="p-2 text-red-400 rounded-lg disabled:opacity-50"
                              title="Reject Request"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredRequests.length === 0 && (
              <div className="text-center py-12" style={{ color: theme.colors.mutedText }}>
                {borrowRequests.length === 0 ? 'No pending borrow requests.' : 'No requests found matching your search.'}
              </div>
            )}
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {filteredRequests.map((request) => (
              <div 
                key={request.id} 
                className="p-4 rounded-xl"
                style={{ 
                  backgroundColor: theme.colors.secondarySurface,
                  border: `1px solid ${theme.colors.logoAccent}40`
                }}
              >
                <div className="flex gap-3 mb-3">
                  <img
                    src={request.bookCoverUrl || 'https://via.placeholder.com/48x64'}
                    alt={request.bookTitle}
                    className="w-16 h-20 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: theme.colors.accent }}>{request.bookTitle}</p>
                    <p className="text-xs truncate" style={{ color: theme.colors.mutedText }}>{request.bookAuthor}</p>
                    <div className="mt-2">
                      <p className="text-xs font-medium" style={{ color: theme.colors.primaryText }}>{request.userName}</p>
                      <p 
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded inline-block"
                        style={{ backgroundColor: theme.colors.primaryBg, color: theme.colors.mutedText }}
                      >
                        {request.userUsername}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div>
                    <span style={{ color: theme.colors.mutedText }}>Available: </span>
                    <span className={`font-medium ${(request.copiesAvailable || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {request.copiesAvailable || 0}
                    </span>
                  </div>
                  <div style={{ color: theme.colors.mutedText }}>
                    {new Date(request.requestedAt).toLocaleDateString()}
                  </div>
                </div>

                {rejectingRequestId === request.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Rejection reason (optional)"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: theme.colors.primaryBg,
                        border: `1px solid ${theme.colors.logoAccent}40`,
                        color: theme.colors.primaryText
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        disabled={processingRequestId === request.id}
                        className="flex-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        {processingRequestId === request.id ? 'Rejecting...' : 'Confirm Reject'}
                      </button>
                      <button
                        onClick={() => { setRejectingRequestId(null); setRejectionReason(''); }}
                        className="px-3 py-1.5 text-xs rounded"
                        style={{ 
                          border: `1px solid ${theme.colors.logoAccent}40`,
                          color: theme.colors.primaryText
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveRequest(request.id)}
                      disabled={processingRequestId === request.id || (request.copiesAvailable || 0) === 0}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingRequestId === request.id ? (
                        <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingRequestId(request.id)}
                      disabled={processingRequestId === request.id}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-red-400 rounded disabled:opacity-50"
                      style={{ border: `1px solid rgba(248, 113, 113, 0.4)` }}
                    >
                      <XCircle size={12} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            {filteredRequests.length === 0 && (
              <div 
                className="text-center py-12 rounded-xl"
                style={{ 
                  backgroundColor: theme.colors.secondarySurface,
                  color: theme.colors.mutedText
                }}
              >
                {borrowRequests.length === 0 ? 'No pending borrow requests.' : 'No requests found matching your search.'}
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-right" style={{ color: theme.colors.mutedText }}>
            Showing {filteredRequests.length} of {borrowRequests.length} requests
          </div>
        </div>
      )}

      {activeTab === 'loans' && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div 
              className="p-3 md:p-4 rounded-xl"
              style={{ 
                backgroundColor: theme.colors.secondarySurface,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}>
                  <BookOpen size={16} className="text-green-400" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-green-400">{activeLoans.length}</p>
                  <p className="text-[10px] md:text-xs" style={{ color: theme.colors.mutedText }}>Active Loans</p>
                </div>
              </div>
            </div>
            <div 
              className="p-3 md:p-4 rounded-xl"
              style={{ 
                backgroundColor: theme.colors.secondarySurface,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                  <AlertCircle size={16} className="text-red-400" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-red-400">
                    {activeLoans.filter(l => l.isOverdue).length}
                  </p>
                  <p className="text-[10px] md:text-xs" style={{ color: theme.colors.mutedText }}>Overdue</p>
                </div>
              </div>
            </div>
            <div 
              className="p-3 md:p-4 rounded-xl"
              style={{ 
                backgroundColor: theme.colors.secondarySurface,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-lg" style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)' }}>
                  <Clock size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-amber-400">
                    {activeLoans.filter(l => !l.isOverdue && l.daysRemaining <= 3).length}
                  </p>
                  <p className="text-[10px] md:text-xs" style={{ color: theme.colors.mutedText }}>Due Soon</p>
                </div>
              </div>
            </div>
            <div 
              className="p-3 md:p-4 rounded-xl"
              style={{ 
                backgroundColor: theme.colors.secondarySurface,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-lg" style={{ backgroundColor: `${theme.colors.accent}20` }}>
                  <Users size={16} style={{ color: theme.colors.accent }} />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold" style={{ color: theme.colors.accent }}>
                    {new Set(activeLoans.map(l => l.userId)).size}
                  </p>
                  <p className="text-[10px] md:text-xs" style={{ color: theme.colors.mutedText }}>Borrowers</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div 
            className="p-3 md:p-4 rounded-xl"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: theme.colors.mutedText }} />
              <input
                type="text"
                placeholder="Search by user name, admission number, book title, or author..."
                value={loansSearchQuery}
                onChange={(e) => setLoansSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText
                }}
              />
            </div>
          </div>

          {/* Desktop table view */}
          <div 
            className="rounded-xl overflow-hidden hidden md:block"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: theme.colors.primaryBg, borderBottom: `1px solid ${theme.colors.logoAccent}40` }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Book</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Borrower</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Checkout</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Due Date</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Time Remaining</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold" style={{ color: theme.colors.mutedText }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLoans
                    .filter(loan => {
                      const searchLower = loansSearchQuery.toLowerCase();
                      return (
                        loan.userName?.toLowerCase().includes(searchLower) ||
                        loan.userUsername?.toLowerCase().includes(searchLower) ||
                        loan.book?.title?.toLowerCase().includes(searchLower) ||
                        loan.book?.author?.toLowerCase().includes(searchLower)
                      );
                    })
                    .map((loan, index, arr) => (
                    <tr 
                      key={loan.id}
                      style={{ 
                        backgroundColor: loan.isOverdue ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        borderBottom: index < arr.length - 1 ? `1px solid ${theme.colors.logoAccent}20` : 'none'
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={loan.book?.coverUrl || 'https://via.placeholder.com/48x64'}
                            alt={loan.book?.title}
                            className="w-12 h-16 object-cover rounded shadow-sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[200px]" style={{ color: theme.colors.accent }}>{loan.book?.title}</p>
                            <p className="text-sm" style={{ color: theme.colors.mutedText }}>{loan.book?.author}</p>
                            <p className="text-xs" style={{ color: theme.colors.mutedText }}>{loan.book?.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium" style={{ color: theme.colors.primaryText }}>{loan.userName}</p>
                          <p 
                            className="text-xs font-mono px-2 py-0.5 rounded inline-block"
                            style={{ backgroundColor: theme.colors.primaryBg, color: theme.colors.mutedText }}
                          >
                            {loan.userUsername}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{ color: theme.colors.primaryText }}>
                        {new Date(loan.checkoutDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center text-sm" style={{ color: theme.colors.primaryText }}>
                        {new Date(loan.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <LiveTimer dueDate={new Date(loan.dueDate)} compact />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {loan.isOverdue ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-900/50 text-red-400">
                              <AlertCircle size={12} />
                              Overdue
                            </span>
                            {loan.fineAmount > 0 && (
                              <p className="text-xs text-red-400 mt-1">Fine: KES {loan.fineAmount}</p>
                            )}
                          </div>
                        ) : loan.daysRemaining <= 3 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-900/50 text-amber-400">
                            <Clock size={12} />
                            Due Soon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-400">
                            <Check size={12} />
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activeLoans.filter(loan => {
              const searchLower = loansSearchQuery.toLowerCase();
              return (
                loan.userName?.toLowerCase().includes(searchLower) ||
                loan.userUsername?.toLowerCase().includes(searchLower) ||
                loan.book?.title?.toLowerCase().includes(searchLower) ||
                loan.book?.author?.toLowerCase().includes(searchLower)
              );
            }).length === 0 && (
              <div className="text-center py-12" style={{ color: theme.colors.mutedText }}>
                {activeLoans.length === 0 ? 'No active loans.' : 'No loans found matching your search.'}
              </div>
            )}
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {activeLoans
              .filter(loan => {
                const searchLower = loansSearchQuery.toLowerCase();
                return (
                  loan.userName?.toLowerCase().includes(searchLower) ||
                  loan.userUsername?.toLowerCase().includes(searchLower) ||
                  loan.book?.title?.toLowerCase().includes(searchLower) ||
                  loan.book?.author?.toLowerCase().includes(searchLower)
                );
              })
              .map((loan) => (
              <div 
                key={loan.id} 
                className={`p-4 rounded-xl ${loan.isOverdue ? 'border-l-4 border-red-400' : loan.daysRemaining <= 3 ? 'border-l-4 border-amber-400' : 'border-l-4 border-green-400'}`}
                style={{ 
                  backgroundColor: theme.colors.secondarySurface,
                  border: `1px solid ${theme.colors.logoAccent}40`
                }}
              >
                <div className="flex gap-3 mb-3">
                  <img
                    src={loan.book?.coverUrl || 'https://via.placeholder.com/48x64'}
                    alt={loan.book?.title}
                    className="w-16 h-20 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: theme.colors.accent }}>{loan.book?.title}</p>
                    <p className="text-xs truncate" style={{ color: theme.colors.mutedText }}>{loan.book?.author}</p>
                    <div className="mt-2">
                      <p className="text-xs font-medium" style={{ color: theme.colors.primaryText }}>{loan.userName}</p>
                      <p 
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded inline-block"
                        style={{ backgroundColor: theme.colors.primaryBg, color: theme.colors.mutedText }}
                      >
                        {loan.userUsername}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div style={{ color: theme.colors.mutedText }}>
                    Due: {new Date(loan.dueDate).toLocaleDateString()}
                  </div>
                  {loan.isOverdue ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-900/50 text-red-400">
                      <AlertCircle size={10} />
                      Overdue {loan.fineAmount > 0 && `- KES ${loan.fineAmount}`}
                    </span>
                  ) : loan.daysRemaining <= 3 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-900/50 text-amber-400">
                      <Clock size={10} />
                      Due Soon
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-900/50 text-green-400">
                      <Check size={10} />
                      Active
                    </span>
                  )}
                </div>

                {/* Live Timer */}
                <LiveTimer dueDate={new Date(loan.dueDate)} />
              </div>
            ))}
            
            {activeLoans.filter(loan => {
              const searchLower = loansSearchQuery.toLowerCase();
              return (
                loan.userName?.toLowerCase().includes(searchLower) ||
                loan.userUsername?.toLowerCase().includes(searchLower) ||
                loan.book?.title?.toLowerCase().includes(searchLower) ||
                loan.book?.author?.toLowerCase().includes(searchLower)
              );
            }).length === 0 && (
              <div 
                className="text-center py-12 rounded-xl"
                style={{ 
                  backgroundColor: theme.colors.secondarySurface,
                  color: theme.colors.mutedText
                }}
              >
                {activeLoans.length === 0 ? 'No active loans.' : 'No loans found matching your search.'}
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-right" style={{ color: theme.colors.mutedText }}>
            Showing {activeLoans.filter(loan => {
              const searchLower = loansSearchQuery.toLowerCase();
              return (
                loan.userName?.toLowerCase().includes(searchLower) ||
                loan.userUsername?.toLowerCase().includes(searchLower) ||
                loan.book?.title?.toLowerCase().includes(searchLower) ||
                loan.book?.author?.toLowerCase().includes(searchLower)
              );
            }).length} of {activeLoans.length} active loans
          </div>
        </div>
      )}

      {/* Extractions Tab - Requirement 7.1 */}
      {activeTab === 'extractions' && (
        <ExtractionPanel />
      )}
    </div>
  );
};

interface BookFormModalProps {
  title: string;
  book: any;
  categories: Category[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (updates: any) => void;
  isEdit?: boolean;
}

const BookFormModal: React.FC<BookFormModalProps> = ({
  title,
  book,
  categories,
  onClose,
  onSubmit,
  onChange,
  isEdit = false
}) => {
  const theme = useAppTheme();
  const [uploadingPdf, setUploadingPdf] = React.useState(false);
  const [pdfUploadError, setPdfUploadError] = React.useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = React.useState<string | null>(null);
  
  // AI Auto-fill states
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = React.useState<string | null>(null);

  // AI Auto-fill function - searches for book metadata and cover
  const handleAiAutoFill = async () => {
    if (!book.title && !pdfFileName) {
      setAiError('Please enter a book title or upload a PDF first');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiSuccess(null);

    try {
      // Step 1: Get book metadata from AI
      const metadataResponse = await fetch(`${API_URL}/ai/book-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: book.title || pdfFileName?.replace(/\.pdf$/i, '').replace(/[_-]/g, ' '),
          author: book.author 
        })
      });

      let metadata: any = {};
      if (metadataResponse.ok) {
        const metadataData = await metadataResponse.json();
        metadata = metadataData.metadata || {};
      }

      // Step 2: Get book cover image
      const coverResponse = await fetch(`${API_URL}/ai/book-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: metadata.title || book.title,
          author: metadata.author || book.author,
          isbn: metadata.isbn || book.isbn
        })
      });

      let coverUrl = book.coverUrl;
      if (coverResponse.ok) {
        const coverData = await coverResponse.json();
        if (coverData.coverUrl) {
          coverUrl = coverData.coverUrl;
        }
      }

      // Step 3: Find matching category
      let categoryId = book.categoryId;
      if (metadata.category && categories.length > 0) {
        const matchingCategory = categories.find(
          c => c.name.toLowerCase().includes(metadata.category.toLowerCase()) ||
               metadata.category.toLowerCase().includes(c.name.toLowerCase())
        );
        if (matchingCategory) {
          categoryId = matchingCategory.id;
        }
      }

      // Update book with AI-found data (only fill empty fields, but always update cover if found)
      const updates: any = { ...book };
      if (metadata.title && !book.title) updates.title = metadata.title;
      if (metadata.author && !book.author) updates.author = metadata.author;
      if (metadata.isbn && !book.isbn) updates.isbn = metadata.isbn;
      if (metadata.publishedYear && !book.publishedYear) updates.publishedYear = metadata.publishedYear;
      if (metadata.publisher && !book.publisher) updates.publisher = metadata.publisher;
      if (metadata.description && !book.description) updates.description = metadata.description;
      // Always update cover if we found a real one (not placeholder)
      if (coverUrl && !coverUrl.includes('placeholder') && !coverUrl.includes('picsum') && !coverUrl.includes('ui-avatars')) {
        updates.coverUrl = coverUrl;
      } else if (!book.coverUrl) {
        updates.coverUrl = coverUrl;
      }
      if (categoryId && !book.categoryId) updates.categoryId = categoryId;

      onChange(updates);
      setAiSuccess('Book information found! Review and edit as needed.');
    } catch (err) {
      console.error('AI auto-fill error:', err);
      setAiError('Failed to fetch book information. Please try again or enter manually.');
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-fill from PDF filename when PDF is uploaded
  const handlePdfUploadWithAi = async (file: File, base64Data: string, fileName: string) => {
    // First upload the PDF
    try {
      const response = await fetch(`${API_URL}/admin/upload-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, fileData: base64Data })
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // Server returned non-JSON response (likely an error page)
        const text = await response.text();
        console.error('Server returned non-JSON response:', text);
        
        // Check for common server errors
        if (text.includes('Request Entity Too Large') || response.status === 413) {
          setPdfUploadError('File is too large. Please use a smaller PDF (max 50MB).');
        } else if (response.status === 404) {
          setPdfUploadError('Upload endpoint not found. Please check server configuration.');
        } else if (response.status >= 500) {
          setPdfUploadError('Server error. Please try again later or contact support.');
        } else {
          setPdfUploadError(`Upload failed: ${text.substring(0, 100) || 'Unknown error'}`);
        }
        return;
      }

      if (response.ok && data.success) {
      onChange({ ...book, softCopyUrl: data.url, hasSoftCopy: true });
      setPdfFileName(file.name);
      setPdfUploadError(null);

      // Then try to extract metadata from filename using AI
      setAiLoading(true);
      try {
        const metadataResponse = await fetch(`${API_URL}/ai/extract-pdf-metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name })
        });

        if (metadataResponse.ok) {
          const metadataData = await metadataResponse.json();
          const metadata = metadataData.metadata || {};

          // Get cover image
          const coverResponse = await fetch(`${API_URL}/ai/book-cover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              title: metadata.title,
              author: metadata.author,
              isbn: metadata.isbn
            })
          });

          let coverUrl = '';
          if (coverResponse.ok) {
            const coverData = await coverResponse.json();
            coverUrl = coverData.coverUrl || '';
          }

          // Find matching category
          let categoryId = '';
          if (metadata.category && categories.length > 0) {
            const matchingCategory = categories.find(
              c => c.name.toLowerCase().includes(metadata.category?.toLowerCase() || '') ||
                   (metadata.category?.toLowerCase() || '').includes(c.name.toLowerCase())
            );
            if (matchingCategory) {
              categoryId = matchingCategory.id;
            }
          }

          // Update with found metadata
          onChange({
            ...book,
            softCopyUrl: data.url,
            hasSoftCopy: true,
            title: metadata.title || book.title,
            author: metadata.author || book.author,
            isbn: metadata.isbn || book.isbn,
            publishedYear: metadata.publishedYear || book.publishedYear,
            publisher: metadata.publisher || book.publisher,
            description: metadata.description || book.description,
            coverUrl: coverUrl || book.coverUrl,
            categoryId: categoryId || book.categoryId
          });

          setAiSuccess('PDF uploaded and book info auto-filled! Review and edit as needed.');
        }
      } catch (err) {
        console.error('AI metadata extraction error:', err);
        // PDF uploaded successfully, just couldn't get metadata
      } finally {
        setAiLoading(false);
      }
    } else {
      setPdfUploadError(data.error || 'Failed to upload PDF');
    }
    } catch (err: any) {
      console.error('PDF upload error:', err);
      setPdfUploadError(err.message || 'Failed to upload PDF. Please try again.');
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - be more lenient for mobile browsers
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setPdfUploadError('Please select a PDF file');
      return;
    }

    // Validate file size - 50MB max (Supabase Storage limit)
    if (file.size > 50 * 1024 * 1024) {
      setPdfUploadError('File size must be less than 50MB');
      return;
    }

    setUploadingPdf(true);
    setPdfUploadError(null);

    try {
      // Try direct Supabase upload first (supports up to 50MB)
      if (isDirectUploadAvailable()) {
        console.log('Using direct Supabase upload for file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2) + 'MB');
        
        const result = await uploadPdfToSupabase(file);
        
        if (result) {
          onChange({ ...book, softCopyUrl: result.url, hasSoftCopy: true });
          setPdfFileName(file.name);
          setPdfUploadError(null);
          
          // Try to extract metadata using AI
          setAiLoading(true);
          try {
            const metadataResponse = await fetch(`${API_URL}/ai/extract-pdf-metadata`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: file.name })
            });

            if (metadataResponse.ok) {
              const metadataData = await metadataResponse.json();
              const metadata = metadataData.metadata || {};

              // Get cover image
              const coverResponse = await fetch(`${API_URL}/ai/book-cover`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  title: metadata.title,
                  author: metadata.author,
                  isbn: metadata.isbn
                })
              });

              let coverUrl = '';
              if (coverResponse.ok) {
                const coverData = await coverResponse.json();
                coverUrl = coverData.coverUrl || '';
              }

              // Find matching category
              let categoryId = '';
              if (metadata.category && categories.length > 0) {
                const matchingCategory = categories.find(
                  c => c.name.toLowerCase().includes(metadata.category?.toLowerCase() || '') ||
                       (metadata.category?.toLowerCase() || '').includes(c.name.toLowerCase())
                );
                if (matchingCategory) {
                  categoryId = matchingCategory.id;
                }
              }

              // Update with found metadata
              onChange({
                ...book,
                softCopyUrl: result.url,
                hasSoftCopy: true,
                title: metadata.title || book.title,
                author: metadata.author || book.author,
                isbn: metadata.isbn || book.isbn,
                publishedYear: metadata.publishedYear || book.publishedYear,
                publisher: metadata.publisher || book.publisher,
                description: metadata.description || book.description,
                coverUrl: coverUrl || book.coverUrl,
                categoryId: categoryId || book.categoryId
              });

              setAiSuccess('PDF uploaded and book info auto-filled! Review and edit as needed.');
            }
          } catch (err) {
            console.error('AI metadata extraction error:', err);
            // PDF uploaded successfully, just couldn't get metadata
            setAiSuccess('PDF uploaded successfully!');
          } finally {
            setAiLoading(false);
          }
          
          setUploadingPdf(false);
          return;
        }
      }

      // Fallback to API upload for smaller files (if direct upload not available)
      if (file.size > 4 * 1024 * 1024) {
        setPdfUploadError(`File too large for API upload (${(file.size / 1024 / 1024).toFixed(1)}MB > 4MB limit). Direct Supabase upload is not configured. Please use a URL link instead, or contact admin to configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`);
        setUploadingPdf(false);
        return;
      }

      // Create a unique filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedName}`;

      // Read file as base64 for API upload
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          if (!result || !result.includes(',')) {
            throw new Error('Failed to read file data');
          }
          const base64Data = result.split(',')[1];
          if (!base64Data) {
            throw new Error('Invalid file data');
          }
          await handlePdfUploadWithAi(file, base64Data, fileName);
        } catch (err: any) {
          console.error('PDF upload error:', err);
          setPdfUploadError(err.message || 'Failed to upload PDF. Please try again.');
        } finally {
          setUploadingPdf(false);
        }
      };
      
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        setPdfUploadError('Failed to read file. Try a smaller file or use a desktop browser.');
        setUploadingPdf(false);
      };

      reader.onabort = () => {
        setPdfUploadError('File reading was cancelled');
        setUploadingPdf(false);
      };
      
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('PDF upload error:', err);
      setPdfUploadError(err.message || 'Failed to upload PDF. Please try again.');
      setUploadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: theme.colors.secondarySurface }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold" style={{ color: theme.colors.accent }}>{title}</h3>
          <button onClick={onClose} style={{ color: theme.colors.mutedText }}>
            <X size={24} />
          </button>
        </div>

        {/* AI Auto-fill Section */}
        <div 
          className="mb-6 p-4 rounded-xl"
          style={{ 
            background: `linear-gradient(to right, rgba(88, 166, 255, 0.1), rgba(88, 166, 255, 0.05))`,
            border: `1px solid ${theme.colors.accent}40`
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: theme.colors.accent }}>
                <TrendingUp size={16} />
                AI Auto-Fill
              </h4>
              <p className="text-xs mt-1" style={{ color: theme.colors.mutedText }}>
                Enter a title or upload a PDF, then click to auto-fill book details and cover image
              </p>
            </div>
            <button
              type="button"
              onClick={handleAiAutoFill}
              disabled={aiLoading || (!book.title && !pdfFileName)}
              className="px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
              style={{ backgroundColor: theme.colors.accent }}
            >
              {aiLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Auto-Fill with AI
                </>
              )}
            </button>
          </div>
          {aiError && (
            <div className="mt-3 p-2 bg-red-900/50 text-red-400 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle size={14} />
              {aiError}
            </div>
          )}
          {aiSuccess && (
            <div className="mt-3 p-2 bg-green-900/50 text-green-400 text-xs rounded-lg flex items-center gap-2">
              <Check size={14} />
              {aiSuccess}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex gap-6">
            <div className="shrink-0">
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.mutedText }}>Cover Preview</label>
              <div 
                className="w-32 h-44 rounded-lg overflow-hidden border-2 border-dashed"
                style={{ backgroundColor: theme.colors.primaryBg, borderColor: theme.colors.logoAccent }}
              >
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ color: theme.colors.mutedText }}>
                    <Image size={32} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Cover Image URL</label>
                <input
                  type="url"
                  value={book.coverUrl || ''}
                  onChange={(e) => onChange({ ...book, coverUrl: e.target.value })}
                  placeholder="https://example.com/cover.jpg"
                  className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Title *</label>
                  <input
                    type="text"
                    required
                    value={book.title || ''}
                    onChange={(e) => onChange({ ...book, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: theme.colors.primaryBg,
                      border: `1px solid ${theme.colors.logoAccent}40`,
                      color: theme.colors.primaryText
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Author *</label>
                  <input
                    type="text"
                    required
                    value={book.author || ''}
                    onChange={(e) => onChange({ ...book, author: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: theme.colors.primaryBg,
                      border: `1px solid ${theme.colors.logoAccent}40`,
                      color: theme.colors.primaryText
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Category *</label>
              <select
                required
                value={book.categoryId || ''}
                onChange={(e) => onChange({ ...book, categoryId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText
                }}
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>ISBN</label>
              <input
                type="text"
                value={book.isbn || ''}
                onChange={(e) => onChange({ ...book, isbn: e.target.value })}
                placeholder="978-3-16-148410-0"
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Published Year</label>
              <input
                type="number"
                min="1800"
                max={new Date().getFullYear()}
                value={book.publishedYear || ''}
                onChange={(e) => onChange({ ...book, publishedYear: parseInt(e.target.value) || '' })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText
                }}
              />
            </div>
          </div>

          <div 
            className="p-4 rounded-lg"
            style={{ 
              backgroundColor: `${theme.colors.accent}10`,
              border: `1px solid ${theme.colors.accent}30`
            }}
          >
            <h4 className="text-sm font-semibold mb-3" style={{ color: theme.colors.accent }}>Library Location Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Call Number</label>
                <input
                  type="text"
                  value={book.callNumber || ''}
                  onChange={(e) => onChange({ ...book, callNumber: e.target.value })}
                  placeholder="e.g., 004 BRO"
                  className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText
                  }}
                />
                <p className="text-xs mt-1" style={{ color: theme.colors.mutedText }}>Dewey Decimal or custom</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Shelf Location</label>
                <input
                  type="text"
                  value={book.shelfLocation || ''}
                  onChange={(e) => onChange({ ...book, shelfLocation: e.target.value })}
                  placeholder="e.g., Technology Section"
                  className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Floor Number</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={book.floorNumber || 1}
                  onChange={(e) => onChange({ ...book, floorNumber: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText
                  }}
                />
              </div>
            </div>
          </div>

          <div 
            className="p-4 rounded-lg"
            style={{ 
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}
          >
            <h4 className="text-sm font-semibold text-green-400 mb-3">Digital Version (Soft Copy)</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasSoftCopy"
                  checked={book.hasSoftCopy || false}
                  onChange={(e) => onChange({ ...book, hasSoftCopy: e.target.checked, softCopyUrl: e.target.checked ? book.softCopyUrl : '' })}
                  className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-600 rounded"
                  style={{ backgroundColor: theme.colors.primaryBg }}
                />
                <label htmlFor="hasSoftCopy" className="text-sm font-medium" style={{ color: theme.colors.primaryText }}>
                  This book has a digital/PDF version available
                </label>
              </div>
              {book.hasSoftCopy && (
                <div className="space-y-3">
                  {/* PDF File Upload */}
                  <div 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: theme.colors.primaryBg, border: `1px solid rgba(34, 197, 94, 0.3)` }}
                  >
                    <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.mutedText }}>
                      Upload PDF from your device
                    </label>
                    <div className="flex items-center gap-3">
                      <label 
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors"
                        style={{ 
                          borderColor: uploadingPdf ? 'rgba(34, 197, 94, 0.5)' : theme.colors.logoAccent,
                          backgroundColor: uploadingPdf ? 'rgba(34, 197, 94, 0.1)' : 'transparent'
                        }}
                      >
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handlePdfUpload}
                          disabled={uploadingPdf}
                          className="hidden"
                        />
                        {uploadingPdf ? (
                          <>
                            <div className="h-5 w-5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                            <span className="text-sm text-green-400">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Package size={20} className="text-green-400" />
                            <span className="text-sm" style={{ color: theme.colors.mutedText }}>
                              {pdfFileName || 'Click to select PDF file'}
                            </span>
                          </>
                        )}
                      </label>
                    </div>
                    {pdfUploadError && (
                      <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {pdfUploadError}
                      </p>
                    )}
                    <p className="text-xs mt-2" style={{ color: theme.colors.mutedText }}>Max file size: 50MB. PDF files only.</p>
                  </div>

                  {/* OR divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ backgroundColor: theme.colors.logoAccent }}></div>
                    <span className="text-xs font-medium" style={{ color: theme.colors.mutedText }}>OR</span>
                    <div className="flex-1 h-px" style={{ backgroundColor: theme.colors.logoAccent }}></div>
                  </div>

                  {/* URL Input */}
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Paste URL directly</label>
                    <input
                      type="url"
                      value={book.softCopyUrl || ''}
                      onChange={(e) => onChange({ ...book, softCopyUrl: e.target.value })}
                      placeholder="https://example.com/book.pdf or Google Drive link"
                      className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: theme.colors.primaryBg,
                        border: `1px solid ${theme.colors.logoAccent}40`,
                        color: theme.colors.primaryText
                      }}
                    />
                    <p className="text-xs mt-1" style={{ color: theme.colors.mutedText }}>Link to PDF, Google Drive, Dropbox, or other digital version</p>
                  </div>

                  {/* Current URL display */}
                  {book.softCopyUrl && (
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}>
                      <p className="text-xs text-green-400 font-medium mb-1">Current soft copy URL:</p>
                      <p className="text-xs text-green-300 break-all">{book.softCopyUrl}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Publisher</label>
              <input
                type="text"
                value={book.publisher || ''}
                onChange={(e) => onChange({ ...book, publisher: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Total Copies *</label>
              <input
                type="number"
                required
                min="1"
                value={book.totalCopies || 1}
                onChange={(e) => {
                  const total = parseInt(e.target.value) || 1;
                  onChange({ 
                    ...book, 
                    totalCopies: total,
                    copiesAvailable: isEdit ? Math.min(book.copiesAvailable, total) : total
                  });
                }}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText
                }}
              />
            </div>
            {isEdit && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Available Copies</label>
                <input
                  type="number"
                  min="0"
                  max={book.totalCopies}
                  value={book.copiesAvailable || 0}
                  onChange={(e) => onChange({ ...book, copiesAvailable: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: theme.colors.primaryBg,
                    border: `1px solid ${theme.colors.logoAccent}40`,
                    color: theme.colors.primaryText
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.mutedText }}>Description</label>
            <textarea
              rows={3}
              value={book.description || ''}
              onChange={(e) => onChange({ ...book, description: e.target.value })}
              placeholder="Brief description of the book..."
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${theme.colors.logoAccent}40`,
                color: theme.colors.primaryText
              }}
            />
          </div>

          <div className="flex gap-3 pt-4" style={{ borderTop: `1px solid ${theme.colors.logoAccent}30` }}>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg transition-colors"
              style={{ 
                border: `1px solid ${theme.colors.logoAccent}40`,
                color: theme.colors.primaryText
              }}
              disabled={uploadingPdf || aiLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadingPdf || aiLoading}
              className="flex-1 px-4 py-2.5 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: theme.colors.accent }}
            >
              <Save size={18} />
              {uploadingPdf ? 'Uploading...' : aiLoading ? 'Processing...' : isEdit ? 'Save Changes' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;

