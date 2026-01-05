import React, { useState } from 'react';
import { Library, BookOpen, Bot, LogOut, Settings, Menu, X, UserCog } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  currentView: 'browse' | 'loans' | 'ai' | 'admin';
  setCurrentView: (view: 'browse' | 'loans' | 'ai' | 'admin') => void;
  user: User;
  onLogout: () => void;
  onOpenProfile?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView, user, onLogout, onOpenProfile }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (view: 'browse' | 'loans' | 'ai' | 'admin') => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav h-16 md:h-20 px-4 md:px-6 flex items-center justify-between transition-all duration-300 border-b border-slate-200">
        {/* Brand */}
        <div className="flex items-center gap-2 md:gap-4 cursor-pointer" onClick={() => handleNavClick('browse')}>
          <img 
            src="https://puea.ac.ke/wp-content/uploads/2022/01/website-logo-1.png" 
            alt="PUEA Logo" 
            className="h-8 md:h-12 w-auto object-contain"
          />
          <div className="hidden sm:block">
            <h1 className="text-puea-blue font-serif font-bold text-sm md:text-lg leading-tight">Presbyterian University</h1>
            <p className="text-puea-blue/70 text-[10px] md:text-xs font-sans tracking-widest uppercase">of East Africa</p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-full border border-slate-200">
          <button
            onClick={() => setCurrentView('browse')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
              currentView === 'browse' 
                ? 'bg-white shadow-sm text-puea-blue' 
                : 'text-slate-500 hover:text-puea-blue'
            }`}
          >
            <BookOpen size={16} />
            Browse
          </button>
          {user.role !== 'Admin' && (
            <button
              onClick={() => setCurrentView('loans')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                currentView === 'loans' 
                  ? 'bg-white shadow-sm text-puea-blue' 
                  : 'text-slate-500 hover:text-puea-blue'
              }`}
            >
              <Library size={16} />
              My Loans
            </button>
          )}
          <button
            onClick={() => setCurrentView('ai')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
              currentView === 'ai' 
                ? 'bg-gradient-to-r from-puea-blue to-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:text-puea-blue'
            }`}
          >
            <Bot size={16} />
            AI Librarian
          </button>
          {user.role === 'Admin' && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                currentView === 'admin' 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md' 
                  : 'text-slate-500 hover:text-orange-500'
              }`}
            >
              <Settings size={16} />
              Admin
            </button>
          )}
        </div>

        {/* User Profile - Desktop */}
        <div className="hidden md:flex items-center gap-4 pl-4 border-l border-slate-200">
          <div className="flex items-center gap-3">
            <div className="text-right hidden lg:block">
              <p className="text-sm font-semibold text-puea-blue">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
            <div className="relative group">
              <button 
                onClick={onOpenProfile}
                className="h-10 w-10 rounded-full overflow-hidden border-2 border-white ring-2 ring-slate-100 shadow-md hover:ring-puea-blue/50 transition-all"
                title="Edit Profile"
              >
                <img src={user.avatarUrl} alt="User" className="h-full w-full object-cover" />
              </button>
              <div className="absolute top-0 right-0 h-3 w-3 bg-puea-green rounded-full border-2 border-white"></div>
            </div>
          </div>
          
          <button 
            onClick={onOpenProfile}
            className="p-2 text-slate-400 hover:text-puea-blue hover:bg-blue-50 rounded-full transition-all"
            title="Edit Profile"
          >
            <UserCog size={20} />
          </button>
          
          <button 
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-puea-red hover:bg-red-50 rounded-full transition-all"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
        
        {/* Mobile Menu Button */}
        <div className="flex lg:hidden items-center gap-2">
          <div className="h-8 w-8 rounded-full overflow-hidden border-2 border-white ring-1 ring-slate-100 shadow-sm">
            <img src={user.avatarUrl} alt="User" className="h-full w-full object-cover" />
          </div>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-puea-blue hover:bg-slate-100 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-16 left-0 right-0 bg-white shadow-xl border-t border-slate-100 animate-fade-in-up max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-white ring-2 ring-slate-100 shadow-md">
                  <img src={user.avatarUrl} alt="User" className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="font-semibold text-puea-blue">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.role}</p>
                </div>
              </div>
            </div>
            
            <div className="p-2">
              <button
                onClick={() => handleNavClick('browse')}
                className={`w-full px-4 py-3 rounded-xl text-left font-medium transition-all flex items-center gap-3 ${
                  currentView === 'browse' 
                    ? 'bg-puea-blue/10 text-puea-blue' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <BookOpen size={20} />
                Browse Books
              </button>
              {user.role !== 'Admin' && (
                <button
                  onClick={() => handleNavClick('loans')}
                  className={`w-full px-4 py-3 rounded-xl text-left font-medium transition-all flex items-center gap-3 ${
                    currentView === 'loans' 
                      ? 'bg-puea-blue/10 text-puea-blue' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Library size={20} />
                  My Loans
                </button>
              )}
              <button
                onClick={() => handleNavClick('ai')}
                className={`w-full px-4 py-3 rounded-xl text-left font-medium transition-all flex items-center gap-3 ${
                  currentView === 'ai' 
                    ? 'bg-gradient-to-r from-puea-blue to-indigo-600 text-white' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Bot size={20} />
                AI Librarian
              </button>
              {user.role === 'Admin' && (
                <>
                  <button
                    onClick={() => handleNavClick('admin')}
                    className={`w-full px-4 py-3 rounded-xl text-left font-medium transition-all flex items-center gap-3 ${
                      currentView === 'admin' 
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Settings size={20} />
                    Admin Panel
                  </button>
                </>
              )}
            </div>
            
            <div className="p-2 border-t border-slate-100">
              <button 
                onClick={() => { if (onOpenProfile) onOpenProfile(); setMobileMenuOpen(false); }}
                className="w-full px-4 py-3 rounded-xl text-left font-medium text-puea-blue hover:bg-blue-50 transition-all flex items-center gap-3"
              >
                <UserCog size={20} />
                Edit Profile
              </button>
              <button 
                onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                className="w-full px-4 py-3 rounded-xl text-left font-medium text-red-500 hover:bg-red-50 transition-all flex items-center gap-3"
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
