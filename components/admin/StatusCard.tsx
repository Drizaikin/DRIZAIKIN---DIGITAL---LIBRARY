/**
 * StatusCard Component
 * Displays a status indicator with icon and label for the Admin Health Dashboard
 * 
 * Requirements: 2.1-2.3
 * - Display status indicator (healthy/warning/failed)
 * - Show title, status icon, and last updated time
 * - Use theme colors for status indicators
 */

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { useAppTheme } from '../../hooks/useAppTheme';

export type HealthStatus = 'healthy' | 'warning' | 'failed';

interface StatusCardProps {
  title: string;
  status: HealthStatus;
  lastUpdated?: string;
  details?: string;
}

const STATUS_CONFIG: Record<HealthStatus, { 
  icon: typeof CheckCircle; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  healthy: {
    icon: CheckCircle,
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    label: 'Healthy'
  },
  warning: {
    icon: AlertTriangle,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    label: 'Warning'
  },
  failed: {
    icon: XCircle,
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    label: 'Failed'
  }
};

const StatusCard: React.FC<StatusCardProps> = ({ 
  title, 
  status, 
  lastUpdated, 
  details 
}) => {
  const theme = useAppTheme();
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  const formatLastUpdated = (timestamp?: string): string => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div
      className="p-4 rounded-xl transition-all duration-200 hover:shadow-lg"
      style={{
        backgroundColor: theme.colors.secondarySurface,
        border: `1px solid ${theme.colors.logoAccent}40`
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 
          className="text-sm font-medium"
          style={{ color: theme.colors.mutedText }}
        >
          {title}
        </h3>
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: config.bgColor }}
        >
          <StatusIcon size={20} style={{ color: config.color }} />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-lg font-semibold"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      </div>

      {details && (
        <p 
          className="text-sm mb-2"
          style={{ color: theme.colors.mutedText }}
        >
          {details}
        </p>
      )}

      <div 
        className="flex items-center gap-1 text-xs"
        style={{ color: theme.colors.mutedText }}
      >
        <Clock size={12} />
        <span>Updated {formatLastUpdated(lastUpdated)}</span>
      </div>
    </div>
  );
};

export default StatusCard;
