import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import BookCard from './components/BookCard';
import BookList from './components/BookList';
import BookCompact from './components/BookCompact';
import BookTable from './components/BookTable';
import BookDetailsModal from './components/BookDetailsModal';
import AILibrarian from './components/AILibrarian';
import MyLoans from './components/MyLoans';
import Login from './components/Login';
import Register from './components/Register';
import AdminPanel from './components/AdminPanel';
import UserProfile from './components/UserProfile';
import PreferencesToolbar from './components/PreferencesToolbar';
import Footer from './components/Footer';
// import ChristmasDecorations from './components/ChristmasDecorations'; // Removed Christmas theme
import { Book, Loan, User } from './types';
import { authService } from './services/authService';
import { IconSize, ViewLayout, preferencesService } from './services/preferencesService';
import { useTheme } from './contexts/ThemeContext';
import { Search, Filter, SortAsc, SortDesc, Sparkles, TrendingUp, Calendar } from 'lucide-react';

// Use environment variable or relative path for Vercel deployment
const API_URL = import.meta.env.VITE_API_URL || '/api';

type View = 'browse' | 'loans' | 'ai' | 'admin';
type AuthView = 'login' | 'register';
type SortField = 'title' | 'author' | 'popularity' | 'publishedYear' | 'newest';
type SortOrder = 'asc' | 'desc';

// Helper function to record search history
const recordSearchHistory = async (userId: string, query: string) => {
  if (!query.trim()) return;
  try {
    await fetch(`${API_URL}/search-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type: 'search', query: query.trim() })
    });
  } catch (err) {
    console.error('Failed to record search history:', err);
  }
};

// Helper function to record book view history
const recordBookView = async (userId: string, bookId: string) => {
  try {
    await fetch(`${API_URL}/search-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type: 'view', bookId })
    });
  } catch (err) {
    console.error('Failed to record book view:', err);
  }
};

// Helper function to auto-update book covers
const autoUpdateBookCovers = async () => {
  try {
    const response = await fetch(`${API_URL}/admin/auto-update-covers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
      const data = await response.json();
      if (data.updated > 0) {
        console.log(`Auto-updated ${data.updated} book covers`);
      }
    }
  } catch (err) {
    console.error('Failed to auto-update book covers:', err);
  }
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [currentView, setCurrentView] = useState<View>('browse');
  const [user, setUser] = useState<User | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [recommendedBooks, setRecommendedBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  
  // Advanced filters
  const [sortField, setSortField] = useState<SortField>('popularity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);

  // Display preferences
  const [iconSize, setIconSize] = useState<IconSize>(() => preferencesService.getPreferences().iconSize);
  const [viewLayout, setViewLayout] = useState<ViewLayout>(() => preferencesService.getPreferences().viewLayout);
  const { themeMode, themeColor, setThemeMode, setThemeColor } = useTheme();

  // Track last recorded search to avoid duplicates
  const lastRecordedSearch = React.useRef<string>('');

  // Record search history when user performs a search (debounced)
  useEffect(() => {
    if (!user || !searchQuery.trim()) return;
    
    // Don't record if it's the same as the last recorded search
    if (searchQuery.trim() === lastRecordedSearch.current) return;
    
    const timeoutId = setTimeout(() => {
      recordSearchHistory(user.id, searchQuery);
      lastRecordedSearch.current = searchQuery.trim();
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [searchQuery, user]);

  // Check for existing session on mount
  useEffect(() => {
    const existingUser = authService.getCurrentUser();
    if (existingUser) {
      const appUser: User = {
        id: existingUser.id,
        name: existingUser.name,
        avatarUrl: existingUser.avatarUrl,
        role: existingUser.role,
        course: existingUser.course
      };
      setUser(appUser);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // Fetch books when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchBooks();
      fetchCategories();
      // Auto-update book covers in the background
      autoUpdateBookCovers().then(() => {
        // Refresh books after cover update
        setTimeout(fetchBooks, 2000);
      });
    }
  }, [isAuthenticated]);

  // Fetch recommendations when user is set
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchRecommendations();
    }
  }, [isAuthenticated, user]);

  // Fetch user loans when viewing loans
  useEffect(() => {
    if (isAuthenticated && user && currentView === 'loans') {
      fetchLoans();
    }
  }, [isAuthenticated, user, currentView]);

  const fetchBooks = async () => {
    try {
      const response = await fetch(`${API_URL}/books`);
      if (response.ok) {
        const data = await response.json();
        setBooks(data);
      }
    } catch (err) {
      console.error('Failed to fetch books:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(['All', ...data.map((c: { name: string }) => c.name)]);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchRecommendations = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/books/recommendations/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setRecommendedBooks(data);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    }
  };

  const fetchLoans = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/loans/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        const transformedLoans: Loan[] = data.map((l: any) => ({
          id: l.id,
          book: l.book,
          checkoutDate: new Date(l.checkoutDate),
          dueDate: new Date(l.dueDate),
          isOverdue: l.isOverdue,
          fineAmount: l.fineAmount
        }));
        setLoans(transformedLoans);
      }
    } catch (err) {
      console.error('Failed to fetch loans:', err);
    }
  };

  // Filter and sort books
  const filteredBooks = books
    .filter((book: Book) => {
      const matchesSearch = 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
      const matchesStatus = statusFilter === 'All' || book.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a: Book, b: Book) => {
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
          comparison = ((a as any).publishedYear || 0) - ((b as any).publishedYear || 0);
          break;
        case 'newest':
          comparison = new Date((a as any).addedDate || 0).getTime() - new Date((b as any).addedDate || 0).getTime();
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleLogin = async (admissionNo: string, password?: string, loginAs?: 'student' | 'lecturer' | 'admin') => {
    try {
      setError(null);
      const authUser = await authService.login({ 
        admissionNo, 
        password: password || '',
        loginAs
      });
      
      const appUser: User = {
        id: authUser.id,
        name: authUser.name,
        avatarUrl: authUser.avatarUrl,
        role: authUser.role,
        course: authUser.course,
        email: authUser.email,
        admissionNo: authUser.admissionNo
      };
      
      setUser(appUser);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const handleRegister = async (userData: { 
    name: string; 
    admissionNo: string; 
    password?: string; 
    email?: string; 
    course?: string;
    securityQuestion1?: string;
    securityAnswer1?: string;
    securityQuestion2?: string;
    securityAnswer2?: string;
  }) => {
    try {
      setError(null);
      const authUser = await authService.register({
        name: userData.name,
        email: userData.email || '',
        admissionNo: userData.admissionNo,
        password: userData.password || '',
        course: userData.course,
        securityQuestion1: userData.securityQuestion1,
        securityAnswer1: userData.securityAnswer1,
        securityQuestion2: userData.securityQuestion2,
        securityAnswer2: userData.securityAnswer2
      });
      
      const appUser: User = {
        id: authUser.id,
        name: authUser.name,
        avatarUrl: authUser.avatarUrl,
        role: authUser.role,
        course: authUser.course,
        email: authUser.email,
        admissionNo: authUser.admissionNo
      };
      
      setUser(appUser);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setBooks([]);
    setLoans([]);
    setRecommendedBooks([]);
    setCurrentView('browse');
    setShowProfile(false);
  };

  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
    // Update the stored user in authService
    authService.updateStoredUser(updatedUser);
  };

  // Preferences handlers
  const handleIconSizeChange = (size: IconSize) => {
    setIconSize(size);
    preferencesService.setIconSize(size);
  };

  const handleViewLayoutChange = (layout: ViewLayout) => {
    setViewLayout(layout);
    preferencesService.setViewLayout(layout);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-indigo-600 font-medium animate-pulse">Loading Drizaikn...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
        {/* <ChristmasDecorations /> Removed Christmas theme */}
        {error && (
          <div className="fixed top-4 right-4 left-4 md:left-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl shadow-lg z-50 animate-fade-in-up backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm">{error}</span>
              <button 
                onClick={() => setError(null)} 
                className="text-red-400 hover:text-red-600 p-1"
              >
                ×
              </button>
            </div>
          </div>
        )}
        {authView === 'login' ? (
          <Login onLogin={handleLogin} onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <Register onRegister={handleRegister} onSwitchToLogin={() => setAuthView('login')} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30">
      {/* <ChristmasDecorations /> Removed Christmas theme */}
      <Navbar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        user={user!}
        onLogout={handleLogout}
        onOpenProfile={() => setShowProfile(true)}
      />
      
      {/* Book Details Modal */}
      {selectedBook && (
        <BookDetailsModal 
          book={selectedBook} 
          onClose={() => setSelectedBook(null)}
          userId={user?.id}
          onBorrowRequest={async (bookId: string) => {
            if (!user) return { success: false, error: 'Please log in to borrow books.' };
            try {
              const response = await fetch(`${API_URL}/borrow-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, bookId })
              });
              const data = await response.json();
              if (response.ok && data.success) {
                fetchBooks();
                return { success: true };
              }
              return { success: false, error: data.error || 'Failed to submit borrow request.' };
            } catch (err) {
              return { success: false, error: 'Network error. Please try again.' };
            }
          }}
        />
      )}
      
      {/* User Profile Modal */}
      {showProfile && user && (
        <UserProfile 
          user={user}
          onClose={() => setShowProfile(false)}
          onUserUpdate={handleUserUpdate}
        />
      )}
      
      <main className="flex-grow pt-20 md:pt-28 pb-20 lg:pb-12 px-4 md:px-6">
        {currentView === 'browse' && (
          <div className="max-w-7xl mx-auto animate-fade-in-up">
            {/* User Info Card - Mobile optimized */}
            <div className="glass-panel p-4 rounded-2xl mb-6 border border-white/50 shadow-lg shadow-indigo-100/20">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="relative">
                  <img 
                    src={user!.avatarUrl} 
                    alt={user!.name}
                    className="w-14 h-14 md:w-16 md:h-16 rounded-2xl border-2 border-white shadow-md object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 truncate">{user!.name}</h3>
                  <p className="text-xs md:text-sm text-slate-500 truncate">{user!.email || 'No email provided'}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] md:text-xs text-slate-600 font-mono bg-slate-100/80 px-2 py-0.5 rounded-lg truncate max-w-[150px] md:max-w-none">
                      {user!.role === 'Student' ? user!.admissionNo : `Staff ID: ${user!.admissionNo}`}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      user!.role === 'Admin' ? 'bg-orange-100 text-orange-700' :
                      user!.role === 'Lecturer' ? 'bg-green-100 text-green-700' :
                      user!.role === 'Faculty' ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {user!.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Header */}
            <header className="mb-6 md:mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 mb-2">Discover Knowledge</h2>
              <p className="text-slate-500 text-sm md:text-lg">Explore our curated collection of academic resources.</p>
            </header>

            {/* Recommended Books Section */}
            {recommendedBooks.length > 0 && (
              <div className="mb-6 md:mb-10">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Sparkles className="text-amber-500" size={20} />
                  <h3 className="text-lg md:text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Recommended for You</h3>
                  <span className="text-xs md:text-sm text-slate-500">Based on your course</span>
                </div>
                <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
                  {recommendedBooks.slice(0, 6).map((book: Book, index: number) => (
                    <div key={book.id} className="flex-shrink-0 w-36 md:w-48 snap-start">
                      <BookCard book={book} index={index} onViewDetails={setSelectedBook} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search and Filter Bar - Mobile optimized */}
            <div className="glass-panel p-3 md:p-4 rounded-2xl mb-6 md:mb-8 space-y-3 md:space-y-4 border border-white/50 shadow-lg shadow-indigo-100/10">
              <div className="flex flex-col gap-3 md:gap-4">
                <div className="relative w-full">
                  <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by title or author..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-sm md:text-base bg-white/80 border border-slate-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all placeholder:text-slate-400"
                  />
                </div>
                
                <div className="flex items-center gap-2 w-full">
                  <Filter size={16} className="text-slate-400 hidden sm:block" />
                  <select
                    value={selectedCategory}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value)}
                    className="flex-1 px-3 md:px-4 py-3 md:py-3.5 text-sm bg-white/80 border border-slate-200/50 rounded-xl text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all appearance-none cursor-pointer"
                  >
                    {categories.map((cat: string) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl border transition-all text-sm whitespace-nowrap ${
                      showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/70 border-slate-200 text-slate-600 hover:border-indigo-500'
                    }`}
                  >
                    <span className="hidden sm:inline">More </span>Filters
                  </button>
                </div>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center pt-3 md:pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-sm text-slate-500">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                      className="flex-1 sm:flex-none px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="All">All</option>
                      <option value="AVAILABLE">Available</option>
                      <option value="BORROWED">Borrowed</option>
                      <option value="WAITLIST">Waitlist</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                    <span className="text-sm text-slate-500">Sort:</span>
                    <select
                      value={sortField}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortField(e.target.value as SortField)}
                      className="flex-1 sm:flex-none px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="popularity">Popularity</option>
                      <option value="title">Title</option>
                      <option value="author">Author</option>
                      <option value="publishedYear">Published Year</option>
                      <option value="newest">Recently Added</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                      title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {sortOrder === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Filter Chips */}
            <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
              <button
                onClick={() => { setSortField('popularity'); setSortOrder('desc'); }}
                className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm transition-all ${
                  sortField === 'popularity' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-500'
                }`}
              >
                <TrendingUp size={12} />
                Popular
              </button>
              <button
                onClick={() => { setSortField('newest'); setSortOrder('desc'); }}
                className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm transition-all ${
                  sortField === 'newest' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-500'
                }`}
              >
                <Calendar size={12} />
                New
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === 'AVAILABLE' ? 'All' : 'AVAILABLE')}
                className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm transition-all ${
                  statusFilter === 'AVAILABLE' ? 'bg-green-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-green-500'
                }`}
              >
                Available
              </button>
            </div>

            {/* Preferences Toolbar */}
            <PreferencesToolbar
              iconSize={iconSize}
              viewLayout={viewLayout}
              themeMode={themeMode}
              themeColor={themeColor}
              onIconSizeChange={handleIconSizeChange}
              onViewLayoutChange={handleViewLayoutChange}
              onThemeModeChange={setThemeMode}
              onThemeColorChange={setThemeColor}
            />

            {/* Results Count */}
            <div className="mb-4 text-xs md:text-sm text-slate-500">
              Showing {filteredBooks.length} of {books.length} books
            </div>

            {/* Book Display - Conditional based on viewLayout */}
            {viewLayout === 'grid' && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                {filteredBooks.map((book: Book, index: number) => (
                  <BookCard key={book.id} book={book} index={index} onViewDetails={setSelectedBook} iconSize={iconSize} />
                ))}
              </div>
            )}

            {viewLayout === 'list' && (
              <BookList books={filteredBooks} onViewDetails={setSelectedBook} />
            )}

            {viewLayout === 'compact' && (
              <BookCompact books={filteredBooks} onViewDetails={setSelectedBook} />
            )}

            {viewLayout === 'table' && (
              <BookTable books={filteredBooks} onViewDetails={setSelectedBook} />
            )}

            {filteredBooks.length === 0 && (
              <div className="text-center py-12 md:py-16">
                <p className="text-slate-500 text-base md:text-lg">
                  {books.length === 0 ? 'Loading books...' : 'No books found matching your criteria.'}
                </p>
              </div>
            )}
          </div>
        )}

        {currentView === 'loans' && <MyLoans loans={loans} />}
        {currentView === 'ai' && <AILibrarian currentUser={user} />}
        {currentView === 'admin' && user?.role === 'Admin' && <AdminPanel />}
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
