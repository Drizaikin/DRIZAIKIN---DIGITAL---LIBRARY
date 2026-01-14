import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Activity } from 'lucide-react';
import AdminPanel from './AdminPanel';
import AdminHealthDashboard from './AdminHealthDashboard';
import { useAppTheme } from '../hooks/useAppTheme';

/**
 * AdminRoutes component defines nested routes for the admin section with sidebar navigation.
 * 
 * Routes:
 * - /admin (index) → AdminPanel component
 * - /admin/health → AdminHealthDashboard component
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
const AdminRoutes: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useAppTheme();

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Health Status', path: '/admin/health', icon: Activity },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname === path;
  };

  return (
    <div className="w-full px-4 sm:px-6">
      <div className="flex gap-6 max-w-7xl mx-auto">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div 
            className="sticky top-24 rounded-xl p-4"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <h3 
              className="text-sm font-semibold mb-3 px-2"
              style={{ color: theme.colors.mutedText }}
            >
              Admin Navigation
            </h3>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: active ? `${theme.colors.accent}15` : 'transparent',
                      color: active ? theme.colors.accent : theme.colors.primaryText,
                    }}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile Navigation Dropdown */}
        <div className="lg:hidden w-full mb-4">
          <select
            value={location.pathname}
            onChange={(e) => navigate(e.target.value)}
            className="w-full px-4 py-3 rounded-lg text-sm font-medium focus:outline-none focus:ring-2"
            style={{
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`,
              color: theme.colors.primaryText,
            }}
          >
            {navItems.map((item) => (
              <option key={item.path} value={item.path}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 overflow-x-hidden">
          <Routes>
            {/* /admin → AdminPanel (Requirement 2.1, 2.3) */}
            <Route index element={<AdminPanel />} />
            
            {/* /admin/health → AdminHealthDashboard (Requirement 2.2, 2.4) */}
            <Route path="health" element={<AdminHealthDashboard />} />
            
            {/* Redirect any unknown admin sub-routes to /admin */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default AdminRoutes;
