import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import BookCard from './components/BookCard';
import BookList from './components/BookList';
import BookCompact from './components/BookCompact';
import BookTable from './components/BookTable';
import BookDetailsModal from './components/BookDetailsModal';
import AILibrarian from './components/AILibrarian';
import AdminGuard from './components/AdminGuard';
import AdminRoutes from './components/AdminRoutes';

import Login from './components/Login';
import Register from './components/Register';
import UserProfile from './components/UserProfile';
import PreferencesToolbar from './components/PreferencesToolbar';
import Footer from './components/Footer';
import { Book, User } from './types';
import { authService } from './services/authService';
import { IconSize, ViewLayout, preferencesService } from './services/preferencesService';
import { useTheme } from './contexts/ThemeContext';
import { useAppTheme } from './hooks/useAppTheme';
import { Search, Filter, SortAsc, SortDesc, Sparkles, TrendingUp, Calendar } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type View = 'browse' | 'ai';
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
  const theme = useAppTheme();

  // Track last recorded search to avoid duplicates
  const lastRecordedSearch = React.useRef<string>('');

  // Record search history when user performs a search (debounced)
  useEffect(() => {
    if (!user || !searchQuery.trim()) return;
    if (searchQuery.trim() === lastRecordedSearch.current) return;
    const timeoutId = setTimeout(() => {
      recordSearchHistory(user.id, searchQuery);
      lastRecordedSearch.current = searchQuery.trim();
    }, 1000);
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
        username: existingUser.username,
        email: existingUser.email
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
      autoUpdateBookCovers().then(() => {
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
        case 'title': comparison = a.title.localeCompare(b.title); break;
        case 'author': comparison = a.author.localeCompare(b.author); break;
        case 'popularity': comparison = (a.popularity || 0) - (b.popularity || 0); break;
        case 'publishedYear': comparison = ((a as any).publishedYear || 0) - ((b as any).publishedYear || 0); break;
        case 'newest': comparison = new Date((a as any).addedDate || 0).getTime() - new Date((b as any).addedDate || 0).getTime(); break;
        default: comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleLogin = async (username: string, password?: string, loginAs?: 'reader' | 'premium' | 'admin') => {
    try {
      setError(null);
      const authUser = await authService.login({ username, password: password || '', loginAs });
      const appUser: User = {
        id: authUser.id,
        name: authUser.name,
        avatarUrl: authUser.avatarUrl,
        role: authUser.role,
        email: authUser.email,
        username: authUser.username
      };
      setUser(appUser);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const handleRegister = async (userData: { 
    name: string; username: string; password?: string; email?: string;
    securityQuestion1?: string; securityAnswer1?: string; securityQuestion2?: string; securityAnswer2?: string;
  }) => {
    try {
      setError(null);
      const authUser = await authService.register({
        name: userData.name, email: userData.email || '', username: userData.username,
        password: userData.password || '',
        securityQuestion1: userData.securityQuestion1, securityAnswer1: userData.securityAnswer1,
        securityQuestion2: userData.securityQuestion2, securityAnswer2: userData.securityAnswer2
      });
      const appUser: User = {
        id: authUser.id, name: authUser.name, avatarUrl: authUser.avatarUrl,
        role: authUser.role, email: authUser.email, username: authUser.username
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

    setRecommendedBooks([]);
    setCurrentView('browse');
    setShowProfile(false);
  };

  // Wrapper component to handle logout with navigation (must be inside BrowserRouter)
  const AuthenticatedAppContent: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogoutWithRedirect = () => {
      // Check if current route is an admin route
      const isAdminRoute = location.pathname.startsWith('/admin');
      
      // Perform logout
      handleLogout();
      
      // Navigate to root/browse if on admin route
      if (isAdminRoute) {
        navigate('/');
      }
    };

    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: theme.colors.primaryBg }}>
        <Navbar 
          currentView={currentView} 
          setCurrentView={setCurrentView} 
          user={user!}
          onLogout={handleLogoutWithRedirect}
          onOpenProfile={() => setShowProfile(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
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
                if (response.ok && data.success) { fetchBooks(); return { success: true }; }
                return { success: false, error: data.error || 'Failed to submit borrow request.' };
              } catch (err) { return { success: false, error: 'Network error. Please try again.' }; }
            }}
          />
        )}
        
        {/* User Profile Modal */}
        {showProfile && user && (
          <UserProfile user={user} onClose={() => setShowProfile(false)} onUserUpdate={handleUserUpdate} />
        )}

        {/* Hero Section - only show on non-admin routes */}
        {!location.pathname.startsWith('/admin') && (
          <section className="flex flex-col items-center justify-center pt-20 pb-6 px-4" style={{ minHeight: '260px' }}>
            <img src="/assets/logo-full.png" alt="DRIZAIKN - Architect of Knowledge" className="h-28 md:h-36 lg:h-44 w-auto object-contain" />
          </section>
        )}

        <main className={`flex-grow pb-20 lg:pb-12 px-4 md:px-6 ${location.pathname.startsWith('/admin') ? 'pt-20' : ''}`}>
          {/* Admin Routes - protected by AdminGuard */}
          <Routes>
            <Route 
              path="/admin/*" 
              element={
                <AdminGuard user={user} isLoading={loading}>
                  <AdminRoutes />
                </AdminGuard>
              } 
            />
            <Route 
              path="*" 
              element={
                <>
                  {currentView === 'browse' && (
          <div className="max-w-7xl mx-auto animate-fade-in-up">
            {/* User Info Card */}
            <div className="p-4 rounded-2xl mb-6" style={{ backgroundColor: theme.colors.secondarySurface, border: `1px solid ${theme.colors.logoAccent}30` }}>
              <div className="flex items-center gap-3 md:gap-4">
                <div className="relative">
                  <img src={user!.avatarUrl} alt={user!.name} className="w-14 h-14 md:w-16 md:h-16 rounded-2xl object-cover" style={{ border: `2px solid ${theme.colors.logoAccent}` }} />
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full" style={{ border: `2px solid ${theme.colors.primaryBg}` }}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-bold truncate" style={{ color: theme.colors.primaryText }}>{user!.name}</h3>
                  <p className="text-xs md:text-sm truncate" style={{ color: theme.colors.mutedText }}>{user!.email || 'No email provided'}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] md:text-xs font-mono px-2 py-0.5 rounded-lg truncate max-w-[150px] md:max-w-none" style={{ backgroundColor: theme.colors.primaryBg, color: theme.colors.mutedText }}>
                      @{user!.username}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${theme.colors.accent}20`, color: theme.colors.accent }}>{user!.role}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Header */}
            <header className="mb-6 md:mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: theme.colors.primaryText }}>Discover Knowledge</h2>
              <p className="text-sm md:text-base" style={{ color: theme.colors.mutedText }}>Explore our curated collection of academic resources.</p>
            </header>

            {/* Recommended Books Section */}
            {recommendedBooks.length > 0 && (
              <div className="mb-6 md:mb-8">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Sparkles size={20} style={{ color: '#fbbf24' }} />
                  <h3 className="text-lg md:text-xl font-semibold" style={{ color: theme.colors.primaryText }}>Recommended for You</h3>
                  <span className="text-xs md:text-sm" style={{ color: theme.colors.mutedText }}>Based on your course</span>
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

            {/* Search and Filter Bar */}
            <div className="p-3 md:p-4 rounded-2xl mb-6 space-y-3 md:space-y-4" style={{ backgroundColor: theme.colors.secondarySurface, border: `1px solid ${theme.colors.logoAccent}30` }}>
              <div className="flex flex-col gap-3 md:gap-4">
                <div className="relative w-full">
                  <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: theme.colors.mutedText }} />
                  <input
                    type="text" placeholder="Search by title or author..." value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 text-sm md:text-base rounded-xl focus:outline-none focus:ring-2 transition-all"
                    style={{ backgroundColor: theme.colors.primaryBg, border: `1px solid ${theme.colors.logoAccent}50`, color: theme.colors.primaryText }}
                  />
                </div>
                <div className="flex items-center gap-2 w-full">
                  <Filter size={16} className="hidden sm:block" style={{ color: theme.colors.mutedText }} />
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                    className="flex-1 px-3 md:px-4 py-3 md:py-3.5 text-sm rounded-xl focus:outline-none transition-all appearance-none cursor-pointer"
                    style={{ backgroundColor: theme.colors.primaryBg, border: `1px solid ${theme.colors.logoAccent}50`, color: theme.colors.primaryText }}>
                    {categories.map((cat: string) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                  <button onClick={() => setShowFilters(!showFilters)}
                    className="px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl transition-all text-sm whitespace-nowrap"
                    style={{ backgroundColor: showFilters ? theme.colors.accent : theme.colors.primaryBg, color: showFilters ? theme.colors.primaryBg : theme.colors.mutedText, border: `1px solid ${theme.colors.logoAccent}50` }}>
                    <span className="hidden sm:inline">More </span>Filters
                  </button>
                </div>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center pt-3 md:pt-4" style={{ borderTop: `1px solid ${theme.colors.logoAccent}30` }}>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-sm" style={{ color: theme.colors.mutedText }}>Status:</span>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                      className="flex-1 sm:flex-none px-3 py-1.5 text-sm rounded-lg focus:outline-none"
                      style={{ backgroundColor: theme.colors.primaryBg, border: `1px solid ${theme.colors.logoAccent}50`, color: theme.colors.primaryText }}>
                      <option value="All">All</option>
                      <option value="AVAILABLE">Available</option>
                      <option value="BORROWED">Borrowed</option>
                      <option value="WAITLIST">Waitlist</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                    <span className="text-sm" style={{ color: theme.colors.mutedText }}>Sort:</span>
                    <select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)}
                      className="flex-1 sm:flex-none px-3 py-1.5 text-sm rounded-lg focus:outline-none"
                      style={{ backgroundColor: theme.colors.primaryBg, border: `1px solid ${theme.colors.logoAccent}50`, color: theme.colors.primaryText }}>
                      <option value="popularity">Popularity</option>
                      <option value="title">Title</option>
                      <option value="author">Author</option>
                      <option value="publishedYear">Published Year</option>
                      <option value="newest">Recently Added</option>
                    </select>
                    <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="p-1.5 rounded-lg" style={{ backgroundColor: theme.colors.primaryBg, border: `1px solid ${theme.colors.logoAccent}50`, color: theme.colors.mutedText }}>
                      {sortOrder === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Filter Chips */}
            <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
              <button onClick={() => { setSortField('popularity'); setSortOrder('desc'); }}
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm transition-all"
                style={{ backgroundColor: sortField === 'popularity' ? theme.colors.accent : theme.colors.secondarySurface, color: sortField === 'popularity' ? theme.colors.primaryBg : theme.colors.mutedText, border: `1px solid ${theme.colors.logoAccent}30` }}>
                <TrendingUp size={12} />Popular
              </button>
              <button onClick={() => { setSortField('newest'); setSortOrder('desc'); }}
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm transition-all"
                style={{ backgroundColor: sortField === 'newest' ? theme.colors.accent : theme.colors.secondarySurface, color: sortField === 'newest' ? theme.colors.primaryBg : theme.colors.mutedText, border: `1px solid ${theme.colors.logoAccent}30` }}>
                <Calendar size={12} />New
              </button>
              <button onClick={() => setStatusFilter(statusFilter === 'AVAILABLE' ? 'All' : 'AVAILABLE')}
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm transition-all"
                style={{ backgroundColor: statusFilter === 'AVAILABLE' ? '#22c55e' : theme.colors.secondarySurface, color: statusFilter === 'AVAILABLE' ? '#fff' : theme.colors.mutedText, border: `1px solid ${theme.colors.logoAccent}30` }}>
                Available
              </button>
            </div>

            {/* Preferences Toolbar */}
            <PreferencesToolbar iconSize={iconSize} viewLayout={viewLayout} themeMode={themeMode} themeColor={themeColor}
              onIconSizeChange={handleIconSizeChange} onViewLayoutChange={handleViewLayoutChange}
              onThemeModeChange={setThemeMode} onThemeColorChange={setThemeColor} />

            {/* Results Count */}
            <div className="mb-4 text-xs md:text-sm" style={{ color: theme.colors.mutedText }}>
              Showing {filteredBooks.length} of {books.length} books
            </div>

            {/* Book Display */}
            {viewLayout === 'grid' && (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                {filteredBooks.map((book: Book, index: number) => (
                  <BookCard key={book.id} book={book} index={index} onViewDetails={setSelectedBook} iconSize={iconSize} />
                ))}
              </div>
            )}
            {viewLayout === 'list' && <BookList books={filteredBooks} onViewDetails={setSelectedBook} />}
            {viewLayout === 'compact' && <BookCompact books={filteredBooks} onViewDetails={setSelectedBook} />}
            {viewLayout === 'table' && <BookTable books={filteredBooks} onViewDetails={setSelectedBook} />}

            {filteredBooks.length === 0 && (
              <div className="text-center py-12 md:py-16">
                <p className="text-base md:text-lg" style={{ color: theme.colors.mutedText }}>
                  {books.length === 0 ? 'Loading books...' : 'No books found matching your criteria.'}
                </p>
              </div>
            )}
          </div>
        )}


        {currentView === 'ai' && <AILibrarian currentUser={user} />}
                </>
              } 
            />
          </Routes>
        </main>
        
        <Footer />
      </div>
    );
  };

  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
    authService.updateStoredUser(updatedUser);
  };

  const handleIconSizeChange = (size: IconSize) => { setIconSize(size); preferencesService.setIconSize(size); };
  const handleViewLayoutChange = (layout: ViewLayout) => { setViewLayout(layout); preferencesService.setViewLayout(layout); };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.colors.primaryBg }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/assets/logo-icon.png" alt="DRIZAIKN" className="h-16 w-16 animate-pulse" />
          <div className="h-10 w-10 border-4 rounded-full animate-spin" style={{ borderColor: `${theme.colors.logoAccent}40`, borderTopColor: theme.colors.accent }} />
          <p className="text-sm font-medium animate-pulse" style={{ color: theme.colors.accent }}>Loading Drizaikn...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login/register
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: theme.colors.primaryBg }}>
        {error && (
          <div className="fixed top-4 right-4 left-4 md:left-auto px-4 py-3 rounded-xl shadow-lg z-50 animate-fade-in-up backdrop-blur-sm"
            style={{ backgroundColor: '#ef4444', color: '#fff' }}>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm">{error}</span>
              <button onClick={() => setError(null)} className="p-1 hover:opacity-80">×</button>
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

  // Main authenticated view
  return (
    <BrowserRouter>
      <AuthenticatedAppContent />
    </BrowserRouter>
  );
};

export default App;

