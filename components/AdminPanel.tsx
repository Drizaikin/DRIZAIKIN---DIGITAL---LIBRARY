import React, { useState, useEffect, useRef } from 'react';
import { Book, BorrowRequest } from '../types';
import { 
  Plus, Trash2, Edit2, Save, X, Package, AlertCircle, Search,
  SortAsc, SortDesc, Filter, Image, Calendar, TrendingUp, Users,
  BookOpen, UserCog, Shield, GraduationCap, ClipboardList, Check, XCircle, Clock,
  Download, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';
import { authService } from '../services/authService';
import LiveTimer from './LiveTimer';
import ExtractionPanel from './ExtractionPanel';

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
  admission_no: string;
  role: 'Student' | 'Lecturer' | 'Faculty' | 'Admin';
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
  userAdmissionNo: string;
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

  const handleUpdateUserRole = async (userId: string, newRole: 'Student' | 'Lecturer' | 'Faculty' | 'Admin') => {
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

      if (response.ok) {
        showMessage('success', 'Book added successfully!');
        setShowAddForm(false);
        resetNewBookForm();
        fetchBooks();
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to add book');
      }
    } catch (err) {
      showMessage('error', 'Failed to add book');
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
          copiesAvailable: editingBook.copiesAvailable
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
      (request.userAdmissionNo?.toLowerCase().includes(searchLower) || false) ||
      (request.bookTitle?.toLowerCase().includes(searchLower) || false) ||
      (request.bookAuthor?.toLowerCase().includes(searchLower) || false)
    );
  });

  const pendingRequestsCount = borrowRequests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-indigo-600 mb-2">Admin Panel</h2>
        <p className="text-sm md:text-base text-slate-500">Manage book inventory, users, and library resources.</p>
      </header>

      {/* Mobile Tab Navigation - Dropdown (Requirement 9.2) */}
      <div className="md:hidden mb-6">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm"
          aria-expanded={showMobileMenu}
          aria-haspopup="true"
        >
          <span className="flex items-center gap-2 font-medium text-indigo-600">
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
                  <span className="bg-green-100 text-green-700 text-xs font-bold rounded-full px-2 py-0.5">
                    {activeLoans.length}
                  </span>
                )}
              </>
            )}
            {activeTab === 'extractions' && <><Download size={18} /> Extractions</>}
          </span>
          <Menu size={20} className={`text-slate-500 transition-transform ${showMobileMenu ? 'rotate-90' : ''}`} />
        </button>

        {/* Mobile Dropdown Menu (Requirement 9.3) */}
        {showMobileMenu && (
          <div className="absolute left-4 right-4 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-40 overflow-hidden">
            <button
              onClick={() => handleTabChange('books')}
              className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
                activeTab === 'books' ? 'bg-indigo-600/10 text-indigo-600 font-medium' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <BookOpen size={18} />
              Books Management
            </button>
            <button
              onClick={() => handleTabChange('users')}
              className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
                activeTab === 'users' ? 'bg-indigo-600/10 text-indigo-600 font-medium' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <UserCog size={18} />
              User Management
            </button>
            <button
              onClick={() => handleTabChange('requests')}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                activeTab === 'requests' ? 'bg-indigo-600/10 text-indigo-600 font-medium' : 'text-slate-700 hover:bg-slate-50'
              }`}
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
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                activeTab === 'loans' ? 'bg-indigo-600/10 text-indigo-600 font-medium' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Clock size={18} />
                Active Loans
              </span>
              {activeLoans.length > 0 && (
                <span className="bg-green-100 text-green-700 text-xs font-bold rounded-full px-2 py-0.5">
                  {activeLoans.length}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('extractions')}
              className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
                activeTab === 'extractions' ? 'bg-indigo-600/10 text-indigo-600 font-medium' : 'text-slate-700 hover:bg-slate-50'
              }`}
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
            className="absolute left-0 top-0 bottom-0 z-10 px-2 bg-gradient-to-r from-white via-white to-transparent flex items-center"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft size={20} className="text-slate-500" />
          </button>
        )}

        {/* Scrollable tabs container */}
        <div
          ref={tabsContainerRef}
          className="flex gap-1 border-b border-slate-200 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            onClick={() => setActiveTab('books')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'books'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BookOpen size={18} />
            Books Management
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserCog size={18} />
            User Management
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap ${
              activeTab === 'requests'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
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
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative whitespace-nowrap ${
              activeTab === 'loans'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock size={18} />
            Active Loans
            {activeLoans.length > 0 && (
              <span className="bg-green-100 text-green-700 text-xs font-bold rounded-full px-2 py-0.5 ml-1">
                {activeLoans.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('extractions')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'extractions'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Download size={18} />
            Extractions
          </button>
        </div>

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={() => scrollTabs('right')}
            className="absolute right-0 top-0 bottom-0 z-10 px-2 bg-gradient-to-l from-white via-white to-transparent flex items-center"
            aria-label="Scroll tabs right"
          >
            <ChevronRight size={20} className="text-slate-500" />
          </button>
        )}
      </div>

      {message && (
        <div className={`fixed top-20 md:top-24 right-4 left-4 md:left-auto px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm ${
          message.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
        }`}>
          {message.type === 'error' && <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {activeTab === 'books' && (
        <>
          <div className="glass-panel p-3 md:p-4 rounded-xl mb-6 space-y-3 md:space-y-4">
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by title, author, or ISBN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap w-full md:w-auto"
              >
                <Plus size={16} />
                Add New Book
              </button>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2 md:gap-3 items-start sm:items-center pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={14} className="text-slate-400 hidden sm:block" />
                <span className="text-xs text-slate-500">Filters:</span>
              </div>
              
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="flex-1 sm:flex-none px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                >
                  <option value="All">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                >
                  <option value="All">All Status</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="BORROWED">Borrowed</option>
                  <option value="WAITLIST">Waitlist</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                <span className="text-xs text-slate-500">Sort:</span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="flex-1 sm:flex-none px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                >
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                  <option value="popularity">Popularity</option>
                  <option value="publishedYear">Year</option>
                  <option value="borrowCount">Borrowed</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
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

          <div className="glass-panel rounded-xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Book</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Category</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Year</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Stock</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Borrowed</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Status</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBooks.map((book) => (
                    <tr key={book.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            className="w-12 h-16 object-cover rounded shadow-sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-indigo-600 truncate max-w-[200px]">{book.title}</p>
                            <p className="text-sm text-slate-500">{book.author}</p>
                            {book.isbn && <p className="text-xs text-slate-400">ISBN: {book.isbn}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {book.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {book.publishedYear || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${book.copiesAvailable > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {book.copiesAvailable} / {book.totalCopies}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-slate-600">{book.borrowCount || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          book.status === 'AVAILABLE' 
                            ? 'bg-green-100 text-green-700' 
                            : book.status === 'WAITLIST'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {book.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingBook(book)}
                            className="p-2 text-indigo-600 hover:bg-blue-50 rounded-lg"
                            title="Edit Book"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteBook(book.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
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
              <div className="text-center py-12 text-slate-500">
                No books found matching your filters.
              </div>
            )}
          </div>

          <div className="md:hidden space-y-3">
            {filteredBooks.map((book) => (
              <div key={book.id} className="glass-panel p-3 rounded-xl">
                <div className="flex gap-3">
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-16 h-20 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-indigo-600 truncate">{book.title}</p>
                    <p className="text-xs text-slate-500 truncate">{book.author}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {book.category}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        book.status === 'AVAILABLE' 
                          ? 'bg-green-100 text-green-700' 
                          : book.status === 'WAITLIST'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {book.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs font-medium ${book.copiesAvailable > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        Stock: {book.copiesAvailable}/{book.totalCopies}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingBook(book)}
                          className="p-1.5 text-indigo-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
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
              <div className="text-center py-12 text-slate-500 glass-panel rounded-xl">
                No books found matching your filters.
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-slate-500 text-right">
            Showing {filteredBooks.length} of {books.length} books
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <div className="glass-panel p-3 md:p-4 rounded-xl">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg">
                  <Users size={16} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-indigo-600">{users.length}</p>
                  <p className="text-[10px] md:text-xs text-slate-500">Total Users</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-3 md:p-4 rounded-xl">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-green-100 rounded-lg">
                  <GraduationCap size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-green-600">
                    {users.filter(u => u.role === 'Student').length}
                  </p>
                  <p className="text-[10px] md:text-xs text-slate-500">Students</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-3 md:p-4 rounded-xl">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-orange-100 rounded-lg">
                  <Shield size={16} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-orange-600">
                    {users.filter(u => u.role === 'Admin').length}
                  </p>
                  <p className="text-[10px] md:text-xs text-slate-500">Admins</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-3 md:p-4 rounded-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search users by name, email, or admission number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          </div>

          <div className="glass-panel rounded-xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">User</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Admission/Employee ID</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Current Role</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Joined</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users
                    .filter(user => 
                      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      user.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-indigo-600">{user.name}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600 font-mono bg-slate-100 px-2 py-1 rounded">
                          {user.admission_no}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingUser?.id === user.id ? (
                          <select
                            value={editingUser.role}
                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                          >
                            <option value="Student">Student</option>
                            <option value="Lecturer">Lecturer</option>
                            <option value="Faculty">Faculty</option>
                            <option value="Admin">Admin</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            user.role === 'Admin' 
                              ? 'bg-orange-100 text-orange-700' 
                              : user.role === 'Faculty'
                              ? 'bg-purple-100 text-purple-700'
                              : user.role === 'Lecturer'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.role === 'Admin' && <Shield size={12} />}
                            {user.role === 'Student' && <GraduationCap size={12} />}
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {editingUser?.id === user.id ? (
                            <>
                              <button
                                onClick={() => handleUpdateUserRole(user.id, editingUser.role)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                title="Save Changes"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={() => setEditingUser(null)}
                                className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setEditingUser(user)}
                              className="p-2 text-indigo-600 hover:bg-blue-50 rounded-lg"
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
              user.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No users found matching your search.
              </div>
            )}
          </div>

          <div className="md:hidden space-y-3">
            {users
              .filter(user => 
                user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((user) => (
              <div key={user.id} className="glass-panel p-4 rounded-xl">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-indigo-600 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    <p className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded inline-block mt-1">
                      {user.admission_no}
                    </p>
                  </div>
                  {editingUser?.id === user.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleUpdateUserRole(user.id, editingUser.role)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Save size={14} />
                      </button>
                      <button
                        onClick={() => setEditingUser(null)}
                        className="p-1.5 text-slate-500 hover:bg-slate-50 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingUser(user)}
                      className="p-1.5 text-indigo-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Role:</p>
                    {editingUser?.id === user.id ? (
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                        className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                      >
                        <option value="Student">Student</option>
                        <option value="Lecturer">Lecturer</option>
                        <option value="Faculty">Faculty</option>
                        <option value="Admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'Admin' 
                          ? 'bg-orange-100 text-orange-700' 
                          : user.role === 'Faculty'
                          ? 'bg-purple-100 text-purple-700'
                          : user.role === 'Lecturer'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.role === 'Admin' && <Shield size={10} />}
                        {user.role === 'Student' && <GraduationCap size={10} />}
                        {user.role}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">Joined:</p>
                    <p className="text-xs text-slate-600">{new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {users.filter(user => 
              user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && (
              <div className="text-center py-12 text-slate-500 glass-panel rounded-xl">
                No users found matching your search.
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-slate-500 text-right">
            Showing {users.filter(user => 
              user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
            ).length} of {users.length} users
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Search and filter */}
          <div className="glass-panel p-3 md:p-4 rounded-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by user name, admission number, book title, or author..."
                value={requestSearchQuery}
                onChange={(e) => setRequestSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          </div>

          {/* Desktop table view */}
          <div className="glass-panel rounded-xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Book</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Requested By</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Available</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Requested</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={request.bookCoverUrl || 'https://via.placeholder.com/48x64'}
                            alt={request.bookTitle}
                            className="w-12 h-16 object-cover rounded shadow-sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-indigo-600 truncate max-w-[200px]">{request.bookTitle}</p>
                            <p className="text-sm text-slate-500">{request.bookAuthor}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-700">{request.userName}</p>
                          <p className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded inline-block">
                            {request.userAdmissionNo}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${(request.copiesAvailable || 0) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {request.copiesAvailable || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {new Date(request.requestedAt).toLocaleDateString()}
                        <br />
                        <span className="text-xs text-slate-400">
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
                              className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleRejectRequest(request.id)}
                                disabled={processingRequestId === request.id}
                                className="flex-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                              >
                                {processingRequestId === request.id ? 'Rejecting...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => { setRejectingRequestId(null); setRejectionReason(''); }}
                                className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
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
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              title={request.copiesAvailable === 0 ? 'No copies available' : 'Approve Request'}
                            >
                              {processingRequestId === request.id ? (
                                <div className="h-4 w-4 border-2 border-green-600/30 border-t-green-600 rounded-full animate-spin" />
                              ) : (
                                <Check size={16} />
                              )}
                            </button>
                            <button
                              onClick={() => setRejectingRequestId(request.id)}
                              disabled={processingRequestId === request.id}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
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
              <div className="text-center py-12 text-slate-500">
                {borrowRequests.length === 0 ? 'No pending borrow requests.' : 'No requests found matching your search.'}
              </div>
            )}
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {filteredRequests.map((request) => (
              <div key={request.id} className="glass-panel p-4 rounded-xl">
                <div className="flex gap-3 mb-3">
                  <img
                    src={request.bookCoverUrl || 'https://via.placeholder.com/48x64'}
                    alt={request.bookTitle}
                    className="w-16 h-20 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-indigo-600 truncate">{request.bookTitle}</p>
                    <p className="text-xs text-slate-500 truncate">{request.bookAuthor}</p>
                    <div className="mt-2">
                      <p className="text-xs text-slate-700 font-medium">{request.userName}</p>
                      <p className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                        {request.userAdmissionNo}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div>
                    <span className="text-slate-500">Available: </span>
                    <span className={`font-medium ${(request.copiesAvailable || 0) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {request.copiesAvailable || 0}
                    </span>
                  </div>
                  <div className="text-slate-500">
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
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        disabled={processingRequestId === request.id}
                        className="flex-1 px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                      >
                        {processingRequestId === request.id ? 'Rejecting...' : 'Confirm Reject'}
                      </button>
                      <button
                        onClick={() => { setRejectingRequestId(null); setRejectionReason(''); }}
                        className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50"
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
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs border border-red-200 text-red-500 rounded hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle size={12} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            {filteredRequests.length === 0 && (
              <div className="text-center py-12 text-slate-500 glass-panel rounded-xl">
                {borrowRequests.length === 0 ? 'No pending borrow requests.' : 'No requests found matching your search.'}
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-slate-500 text-right">
            Showing {filteredRequests.length} of {borrowRequests.length} requests
          </div>
        </div>
      )}

      {activeTab === 'loans' && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="glass-panel p-3 md:p-4 rounded-xl">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-green-100 rounded-lg">
                  <BookOpen size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-green-600">{activeLoans.length}</p>
                  <p className="text-[10px] md:text-xs text-slate-500">Active Loans</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-3 md:p-4 rounded-xl">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-red-100 rounded-lg">
                  <AlertCircle size={16} className="text-red-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-red-600">
                    {activeLoans.filter(l => l.isOverdue).length}
                  </p>
                  <p className="text-[10px] md:text-xs text-slate-500">Overdue</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-3 md:p-4 rounded-xl">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-amber-100 rounded-lg">
                  <Clock size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-amber-600">
                    {activeLoans.filter(l => !l.isOverdue && l.daysRemaining <= 3).length}
                  </p>
                  <p className="text-[10px] md:text-xs text-slate-500">Due Soon</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-3 md:p-4 rounded-xl">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg">
                  <Users size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold text-blue-600">
                    {new Set(activeLoans.map(l => l.userId)).size}
                  </p>
                  <p className="text-[10px] md:text-xs text-slate-500">Borrowers</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="glass-panel p-3 md:p-4 rounded-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by user name, admission number, book title, or author..."
                value={loansSearchQuery}
                onChange={(e) => setLoansSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          </div>

          {/* Desktop table view */}
          <div className="glass-panel rounded-xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Book</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Borrower</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Checkout</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Due Date</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Time Remaining</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeLoans
                    .filter(loan => {
                      const searchLower = loansSearchQuery.toLowerCase();
                      return (
                        loan.userName?.toLowerCase().includes(searchLower) ||
                        loan.userAdmissionNo?.toLowerCase().includes(searchLower) ||
                        loan.book?.title?.toLowerCase().includes(searchLower) ||
                        loan.book?.author?.toLowerCase().includes(searchLower)
                      );
                    })
                    .map((loan) => (
                    <tr key={loan.id} className={`hover:bg-slate-50/50 ${loan.isOverdue ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={loan.book?.coverUrl || 'https://via.placeholder.com/48x64'}
                            alt={loan.book?.title}
                            className="w-12 h-16 object-cover rounded shadow-sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-indigo-600 truncate max-w-[200px]">{loan.book?.title}</p>
                            <p className="text-sm text-slate-500">{loan.book?.author}</p>
                            <p className="text-xs text-slate-400">{loan.book?.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-700">{loan.userName}</p>
                          <p className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded inline-block">
                            {loan.userAdmissionNo}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {new Date(loan.checkoutDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {new Date(loan.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <LiveTimer dueDate={new Date(loan.dueDate)} compact />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {loan.isOverdue ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <AlertCircle size={12} />
                              Overdue
                            </span>
                            {loan.fineAmount > 0 && (
                              <p className="text-xs text-red-600 mt-1">Fine: KES {loan.fineAmount}</p>
                            )}
                          </div>
                        ) : loan.daysRemaining <= 3 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock size={12} />
                            Due Soon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
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
                loan.userAdmissionNo?.toLowerCase().includes(searchLower) ||
                loan.book?.title?.toLowerCase().includes(searchLower) ||
                loan.book?.author?.toLowerCase().includes(searchLower)
              );
            }).length === 0 && (
              <div className="text-center py-12 text-slate-500">
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
                  loan.userAdmissionNo?.toLowerCase().includes(searchLower) ||
                  loan.book?.title?.toLowerCase().includes(searchLower) ||
                  loan.book?.author?.toLowerCase().includes(searchLower)
                );
              })
              .map((loan) => (
              <div key={loan.id} className={`glass-panel p-4 rounded-xl ${loan.isOverdue ? 'border-l-4 border-red-400' : loan.daysRemaining <= 3 ? 'border-l-4 border-amber-400' : 'border-l-4 border-green-400'}`}>
                <div className="flex gap-3 mb-3">
                  <img
                    src={loan.book?.coverUrl || 'https://via.placeholder.com/48x64'}
                    alt={loan.book?.title}
                    className="w-16 h-20 object-cover rounded shadow-sm shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-indigo-600 truncate">{loan.book?.title}</p>
                    <p className="text-xs text-slate-500 truncate">{loan.book?.author}</p>
                    <div className="mt-2">
                      <p className="text-xs text-slate-700 font-medium">{loan.userName}</p>
                      <p className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                        {loan.userAdmissionNo}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="text-slate-500">
                    Due: {new Date(loan.dueDate).toLocaleDateString()}
                  </div>
                  {loan.isOverdue ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                      <AlertCircle size={10} />
                      Overdue {loan.fineAmount > 0 && `- KES ${loan.fineAmount}`}
                    </span>
                  ) : loan.daysRemaining <= 3 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                      <Clock size={10} />
                      Due Soon
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
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
                loan.userAdmissionNo?.toLowerCase().includes(searchLower) ||
                loan.book?.title?.toLowerCase().includes(searchLower) ||
                loan.book?.author?.toLowerCase().includes(searchLower)
              );
            }).length === 0 && (
              <div className="text-center py-12 text-slate-500 glass-panel rounded-xl">
                {activeLoans.length === 0 ? 'No active loans.' : 'No loans found matching your search.'}
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-slate-500 text-right">
            Showing {activeLoans.filter(loan => {
              const searchLower = loansSearchQuery.toLowerCase();
              return (
                loan.userName?.toLowerCase().includes(searchLower) ||
                loan.userAdmissionNo?.toLowerCase().includes(searchLower) ||
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
    const response = await fetch(`${API_URL}/admin/upload-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileData: base64Data })
    });

    const data = await response.json();

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
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      setPdfUploadError('Please select a PDF file');
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      setPdfUploadError('File size must be less than 50MB');
      return;
    }

    setUploadingPdf(true);
    setPdfUploadError(null);

    try {
      // Create a unique filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedName}`;

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          await handlePdfUploadWithAi(file, base64Data, fileName);
        } catch (err) {
          console.error('PDF upload error:', err);
          setPdfUploadError('Failed to upload PDF. Please try again.');
        } finally {
          setUploadingPdf(false);
        }
      };
      
      reader.onerror = () => {
        setPdfUploadError('Failed to read file');
        setUploadingPdf(false);
      };
      
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('PDF upload error:', err);
      setPdfUploadError('Failed to upload PDF. Please try again.');
      setUploadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-indigo-600">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* AI Auto-fill Section */}
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h4 className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                <TrendingUp size={16} />
                AI Auto-Fill
              </h4>
              <p className="text-xs text-purple-600 mt-1">
                Enter a title or upload a PDF, then click to auto-fill book details and cover image
              </p>
            </div>
            <button
              type="button"
              onClick={handleAiAutoFill}
              disabled={aiLoading || (!book.title && !pdfFileName)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
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
            <div className="mt-3 p-2 bg-red-100 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle size={14} />
              {aiError}
            </div>
          )}
          {aiSuccess && (
            <div className="mt-3 p-2 bg-green-100 text-green-700 text-xs rounded-lg flex items-center gap-2">
              <Check size={14} />
              {aiSuccess}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex gap-6">
            <div className="shrink-0">
              <label className="block text-sm font-medium text-slate-600 mb-2">Cover Preview</label>
              <div className="w-32 h-44 bg-slate-100 rounded-lg overflow-hidden border-2 border-dashed border-slate-300">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Image size={32} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Cover Image URL</label>
                <input
                  type="url"
                  value={book.coverUrl || ''}
                  onChange={(e) => onChange({ ...book, coverUrl: e.target.value })}
                  placeholder="https://example.com/cover.jpg"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={book.title || ''}
                    onChange={(e) => onChange({ ...book, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Author *</label>
                  <input
                    type="text"
                    required
                    value={book.author || ''}
                    onChange={(e) => onChange({ ...book, author: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Category *</label>
              <select
                required
                value={book.categoryId || ''}
                onChange={(e) => onChange({ ...book, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">ISBN</label>
              <input
                type="text"
                value={book.isbn || ''}
                onChange={(e) => onChange({ ...book, isbn: e.target.value })}
                placeholder="978-3-16-148410-0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Published Year</label>
              <input
                type="number"
                min="1800"
                max={new Date().getFullYear()}
                value={book.publishedYear || ''}
                onChange={(e) => onChange({ ...book, publishedYear: parseInt(e.target.value) || '' })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-semibold text-indigo-600 mb-3">Library Location Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Call Number</label>
                <input
                  type="text"
                  value={book.callNumber || ''}
                  onChange={(e) => onChange({ ...book, callNumber: e.target.value })}
                  placeholder="e.g., 004 BRO"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
                <p className="text-xs text-slate-500 mt-1">Dewey Decimal or custom</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Shelf Location</label>
                <input
                  type="text"
                  value={book.shelfLocation || ''}
                  onChange={(e) => onChange({ ...book, shelfLocation: e.target.value })}
                  placeholder="e.g., Technology Section"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Floor Number</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={book.floorNumber || 1}
                  onChange={(e) => onChange({ ...book, floorNumber: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="text-sm font-semibold text-green-700 mb-3">Digital Version (Soft Copy)</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasSoftCopy"
                  checked={book.hasSoftCopy || false}
                  onChange={(e) => onChange({ ...book, hasSoftCopy: e.target.checked, softCopyUrl: e.target.checked ? book.softCopyUrl : '' })}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="hasSoftCopy" className="text-sm font-medium text-slate-700">
                  This book has a digital/PDF version available
                </label>
              </div>
              {book.hasSoftCopy && (
                <div className="space-y-3">
                  {/* PDF File Upload */}
                  <div className="p-3 bg-white rounded-lg border border-green-300">
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Upload PDF from your device
                    </label>
                    <div className="flex items-center gap-3">
                      <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                        uploadingPdf ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:border-green-500 hover:bg-green-50'
                      }`}>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handlePdfUpload}
                          disabled={uploadingPdf}
                          className="hidden"
                        />
                        {uploadingPdf ? (
                          <>
                            <div className="h-5 w-5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                            <span className="text-sm text-green-600">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Package size={20} className="text-green-600" />
                            <span className="text-sm text-slate-600">
                              {pdfFileName || 'Click to select PDF file'}
                            </span>
                          </>
                        )}
                      </label>
                    </div>
                    {pdfUploadError && (
                      <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {pdfUploadError}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-2">Max file size: 50MB. PDF files only.</p>
                  </div>

                  {/* OR divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-300"></div>
                    <span className="text-xs text-slate-500 font-medium">OR</span>
                    <div className="flex-1 h-px bg-slate-300"></div>
                  </div>

                  {/* URL Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Paste URL directly</label>
                    <input
                      type="url"
                      value={book.softCopyUrl || ''}
                      onChange={(e) => onChange({ ...book, softCopyUrl: e.target.value })}
                      placeholder="https://example.com/book.pdf or Google Drive link"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    />
                    <p className="text-xs text-slate-500 mt-1">Link to PDF, Google Drive, Dropbox, or other digital version</p>
                  </div>

                  {/* Current URL display */}
                  {book.softCopyUrl && (
                    <div className="p-2 bg-green-100 rounded-lg">
                      <p className="text-xs text-green-700 font-medium mb-1">Current soft copy URL:</p>
                      <p className="text-xs text-green-600 break-all">{book.softCopyUrl}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Publisher</label>
              <input
                type="text"
                value={book.publisher || ''}
                onChange={(e) => onChange({ ...book, publisher: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Total Copies *</label>
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Available Copies</label>
                <input
                  type="number"
                  min="0"
                  max={book.totalCopies}
                  value={book.copiesAvailable || 0}
                  onChange={(e) => onChange({ ...book, copiesAvailable: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Description</label>
            <textarea
              rows={3}
              value={book.description || ''}
              onChange={(e) => onChange({ ...book, description: e.target.value })}
              placeholder="Brief description of the book..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {isEdit ? 'Save Changes' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;
