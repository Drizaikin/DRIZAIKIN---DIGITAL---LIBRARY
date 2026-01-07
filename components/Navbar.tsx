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

const DrizaiknLogo = ({ className = "h-10 w-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="50%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>
    </defs>
    <path d="M15 15 L15 85 L40 85 L40 70 L30 70 L30 30 L40 30 L40 15 Z" fill="url(#logoGradient)" />
    <path d="M40 15 L40 30 L45 30 Q55 30 55 50 Q55 70 45 70 L40 70 L40 85 L50 85 Q75 85 75 50 Q75 15 50 15 Z" fill="url(#logoGradient)" />
    <path d="M85 15 L85 85 L60 85 L60 70 L70 70 L70 30 L60 30 L60 15 Z" fill="url(#logoGradient)" opacity="0.7" />
    <path d="M60 15 L60 30 L55 30 Q45 30 45 50 Q45 70 55 70 L60 70 L60 85 L50 85 Q25 85 25 50 Q25 15 50 15 Z" fill="url(#logoGradient)" opacity="0.7" />
  </svg>
);

export default function Navbar({ currentView, setCurrentView, user, onLogout, onOpenProfile }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const handleNavClick = (view: 'browse' | 'loans' | 'ai' | 'admin') => { setCurrentView(view); setMobileMenuOpen(false); };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav h-16 md:h-20 px-4 md:px-6 flex items-center justify-between transition-all duration-300 border-b border-slate-200/50 backdrop-blur-xl bg-white/80">
        <div className="flex items-center gap-2 md:gap-4 cursor-pointer group" onClick={() => handleNavClick('browse')}>
          <DrizaiknLogo className="h-8 md:h-12 w-auto" />
          <div className="hidden sm:block">
            <h1 className="text-slate-700 font-bold text-sm md:text-lg leading-tight tracking-widest uppercase">DRIZAIKN</h1>
            <p className="text-slate-400 text-[8px] md:text-[10px] font-medium tracking-wider uppercase">Architect of Knowledge</p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2 bg-slate-100/60 p-1.5 rounded-full border border-slate-200/50">
          <button onClick={() => setCurrentView('browse')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${currentView === 'browse' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>
            <BookOpen size={16} />Browse
          </button>
          {user.role !== 'Admin' && (
            <button onClick={() => setCurrentView('loans')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${currentView === 'loans' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>
              <Library size={16} />My Loans
            </button>
          )}
          <button onClick={() => setCurrentView('ai')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${currentView === 'ai' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}>
            <Bot size={16} />AI Librarian
          </button>
          {user.role === 'Admin' && (
            <button onClick={() => setCurrentView('admin')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${currentView === 'admin' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md' : 'text-slate-500 hover:text-orange-500'}`}>
              <Settings size={16} />Admin
            </button>
          )}
        </div>
        <div className="hidden md:flex items-center gap-3 pl-4 border-l border-slate-200/50">
          <div className="flex items-center gap-3">
            <div className="text-right hidden lg:block">
              <p className="text-sm font-semibold text-slate-700">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
            <div className="relative">
              <button onClick={onOpenProfile} className="h-10 w-10 rounded-full overflow-hidden border-2 border-white ring-2 ring-slate-100 shadow-md hover:ring-indigo-200 transition-all">
                <img src={user.avatarUrl} alt="User" className="h-full w-full object-cover" />
              </button>
              <div className="absolute top-0 right-0 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white"></div>
            </div>
          </div>
          <button onClick={onOpenProfile} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"><UserCog size={20} /></button>
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><LogOut size={20} /></button>
        </div>
        <div className="flex lg:hidden items-center gap-2">
          <div className="h-8 w-8 rounded-full overflow-hidden border-2 border-white ring-1 ring-slate-100 shadow-sm">
            <img src={user.avatarUrl} alt="User" className="h-full w-full object-cover" />
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-16 left-0 right-0 bg-white/95 backdrop-blur-xl shadow-2xl border-t border-slate-100 max-h-[calc(100vh-4rem)] overflow-y-auto rounded-b-3xl mx-2">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl overflow-hidden border-2 border-white ring-2 ring-indigo-100 shadow-lg">
                  <img src={user.avatarUrl} alt="User" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.role}</p>
                </div>
              </div>
            </div>
            <div className="p-3 space-y-1">
              <button onClick={() => handleNavClick('browse')} className={`w-full px-4 py-3.5 rounded-2xl text-left font-medium transition-all flex items-center gap-3 ${currentView === 'browse' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}>
                <div className={`p-2 rounded-xl ${currentView === 'browse' ? 'bg-white/20' : 'bg-indigo-100'}`}><BookOpen size={20} className={currentView === 'browse' ? 'text-white' : 'text-indigo-600'} /></div>
                <span>Browse Books</span>
              </button>
              {user.role !== 'Admin' && (
                <button onClick={() => handleNavClick('loans')} className={`w-full px-4 py-3.5 rounded-2xl text-left font-medium transition-all flex items-center gap-3 ${currentView === 'loans' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <div className={`p-2 rounded-xl ${currentView === 'loans' ? 'bg-white/20' : 'bg-indigo-100'}`}><Library size={20} className={currentView === 'loans' ? 'text-white' : 'text-indigo-600'} /></div>
                  <span>My Loans</span>
                </button>
              )}
              <button onClick={() => handleNavClick('ai')} className={`w-full px-4 py-3.5 rounded-2xl text-left font-medium transition-all flex items-center gap-3 ${currentView === 'ai' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}>
                <div className={`p-2 rounded-xl ${currentView === 'ai' ? 'bg-white/20' : 'bg-purple-100'}`}><Bot size={20} className={currentView === 'ai' ? 'text-white' : 'text-purple-600'} /></div>
                <span>AI Librarian</span>
              </button>
              {user.role === 'Admin' && (
                <button onClick={() => handleNavClick('admin')} className={`w-full px-4 py-3.5 rounded-2xl text-left font-medium transition-all flex items-center gap-3 ${currentView === 'admin' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <div className={`p-2 rounded-xl ${currentView === 'admin' ? 'bg-white/20' : 'bg-orange-100'}`}><Settings size={20} className={currentView === 'admin' ? 'text-white' : 'text-orange-600'} /></div>
                  <span>Admin Panel</span>
                </button>
              )}
            </div>
            <div className="p-3 border-t border-slate-100 space-y-1">
              <button onClick={() => { if (onOpenProfile) onOpenProfile(); setMobileMenuOpen(false); }} className="w-full px-4 py-3.5 rounded-2xl text-left font-medium text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-100"><UserCog size={20} className="text-indigo-600" /></div>
                <span>Edit Profile</span>
              </button>
              <button onClick={() => { onLogout(); setMobileMenuOpen(false); }} className="w-full px-4 py-3.5 rounded-2xl text-left font-medium text-red-500 hover:bg-red-50 transition-all flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-100"><LogOut size={20} className="text-red-500" /></div>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200/50 safe-area-bottom">
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          <button onClick={() => setCurrentView('browse')} className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${currentView === 'browse' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}>
            <BookOpen size={22} /><span className="text-[10px] font-medium mt-1">Browse</span>
          </button>
          {user.role !== 'Admin' ? (
            <button onClick={() => setCurrentView('loans')} className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${currentView === 'loans' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}>
              <Library size={22} /><span className="text-[10px] font-medium mt-1">Loans</span>
            </button>
          ) : (
            <button onClick={() => setCurrentView('admin')} className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${currentView === 'admin' ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-slate-600'}`}>
              <Settings size={22} /><span className="text-[10px] font-medium mt-1">Admin</span>
            </button>
          )}
          <button onClick={() => setCurrentView('ai')} className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${currentView === 'ai' ? 'text-purple-600 bg-purple-50' : 'text-slate-400 hover:text-slate-600'}`}>
            <Bot size={22} /><span className="text-[10px] font-medium mt-1">AI</span>
          </button>
          <button onClick={() => setMobileMenuOpen(true)} className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
            <Menu size={22} /><span className="text-[10px] font-medium mt-1">More</span>
          </button>
        </div>
      </div>
    </>
  );
}


