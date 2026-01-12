/**
 * ErrorList Component
 * Displays a scrollable list of recent errors
 * 
 * Requirements: 6.1-6.4
 * - Display scrollable list of errors
 * - Show timestamp, type, and message for each
 * - Limit to 10 items
 */

import React from 'react';
import { AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ErrorEntry {
  timestamp: string;
  type: string;
  message: string;
  identifier?: string;
}

interface ErrorListProps {
  title: string;
  errors: ErrorEntry[];
  maxItems?: number;
  emptyMessage?: string;
}

const ErrorList: React.FC<ErrorListProps> = ({ 
  title, 
  errors, 
  maxItems = 10,
  emptyMessage = 'No errors to display'
}) => {
  const theme = useAppTheme();
  
  const displayErrors = errors.slice(0, maxItems);

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTypeColor = (type: string): string => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('fail') || lowerType.includes('error')) {
      return '#ef4444';
    }
    if (lowerType.includes('warn')) {
      return '#f59e0b';
    }
    return theme.colors.mutedText;
  };

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        backgroundColor: theme.colors.secondarySurface,
        border: `1px solid ${theme.colors.logoAccent}40`
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
        <h3 
          className="text-sm font-medium"
          style={{ color: theme.colors.mutedText }}
        >
          {title}
        </h3>
        {errors.length > 0 && (
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444'
            }}
          >
            {errors.length}
          </span>
        )}
      </div>

      {displayErrors.length === 0 ? (
        <div 
          className="text-center py-6"
          style={{ color: theme.colors.mutedText }}
        >
          <AlertCircle 
            size={24} 
            className="mx-auto mb-2 opacity-50" 
          />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div 
          className="space-y-2 max-h-64 overflow-y-auto pr-1"
          style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: `${theme.colors.logoAccent}40 transparent`
          }}
        >
          {displayErrors.map((error, index) => (
            <div
              key={index}
              className="p-3 rounded-lg"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${theme.colors.logoAccent}20`
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ 
                    backgroundColor: `${getTypeColor(error.type)}20`,
                    color: getTypeColor(error.type)
                  }}
                >
                  {error.type}
                </span>
                <div 
                  className="flex items-center gap-1 text-xs shrink-0"
                  style={{ color: theme.colors.mutedText }}
                >
                  <Clock size={10} />
                  <span>{formatTimestamp(error.timestamp)}</span>
                </div>
              </div>
              <p 
                className="text-sm mt-1 break-words"
                style={{ color: theme.colors.primaryText }}
              >
                {error.message}
              </p>
              {error.identifier && (
                <p 
                  className="text-xs mt-1"
                  style={{ color: theme.colors.mutedText }}
                >
                  ID: {error.identifier}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {errors.length > maxItems && (
        <p 
          className="text-xs text-center mt-3"
          style={{ color: theme.colors.mutedText }}
        >
          Showing {maxItems} of {errors.length} errors
        </p>
      )}
    </div>
  );
};

export default ErrorList;
