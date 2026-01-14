import React from 'react';
import { Navigate } from 'react-router-dom';
import { User } from '../types';
import { useAppTheme } from '../hooks/useAppTheme';

interface AdminGuardProps {
  children: React.ReactNode;
  user: User | null;
  isLoading: boolean;
}

/**
 * AdminGuard component protects admin routes from unauthorized access.
 * 
 * - Shows loading spinner while auth is being verified
 * - Redirects non-admin users to browse view
 * - Renders children for admin users
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
const AdminGuard: React.FC<AdminGuardProps> = ({ children, user, isLoading }) => {
  const theme = useAppTheme();

  // Show loading state while authentication is being verified
  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center" 
        style={{ backgroundColor: theme.colors.primaryBg }}
        data-testid="admin-guard-loading"
      >
        <div className="flex flex-col items-center gap-4">
          <div 
            className="h-10 w-10 border-4 rounded-full animate-spin" 
            style={{ 
              borderColor: `${theme.colors.logoAccent}40`, 
              borderTopColor: theme.colors.accent 
            }} 
          />
          <p 
            className="text-sm font-medium" 
            style={{ color: theme.colors.mutedText }}
          >
            Verifying access...
          </p>
        </div>
      </div>
    );
  }

  // Redirect non-admin users to browse view
  if (!user || user.role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  // Render protected content for admin users
  return <>{children}</>;
};

export default AdminGuard;
