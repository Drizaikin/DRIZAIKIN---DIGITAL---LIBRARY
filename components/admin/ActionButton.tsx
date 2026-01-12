/**
 * ActionButton Component
 * A safe action button with confirmation for admin operations
 * 
 * Requirements: 7.1-7.4
 * - Display action button with icon
 * - Show confirmation before action
 * - Handle loading and error states
 */

import React, { useState } from 'react';
import { Loader2, LucideIcon } from 'lucide-react';
import { useAppTheme } from '../../hooks/useAppTheme';

type ButtonVariant = 'primary' | 'warning' | 'danger';

interface ActionButtonProps {
  label: string;
  action: string;
  icon: LucideIcon;
  variant?: ButtonVariant;
  confirmMessage?: string;
  disabled?: boolean;
  onAction: (action: string) => Promise<void>;
}

const VARIANT_STYLES: Record<ButtonVariant, { 
  bg: string; 
  hoverBg: string; 
  text: string;
  border: string;
}> = {
  primary: {
    bg: 'rgba(88, 166, 255, 0.15)',
    hoverBg: 'rgba(88, 166, 255, 0.25)',
    text: '#58A6FF',
    border: 'rgba(88, 166, 255, 0.3)'
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.15)',
    hoverBg: 'rgba(245, 158, 11, 0.25)',
    text: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.3)'
  },
  danger: {
    bg: 'rgba(239, 68, 68, 0.15)',
    hoverBg: 'rgba(239, 68, 68, 0.25)',
    text: '#ef4444',
    border: 'rgba(239, 68, 68, 0.3)'
  }
};

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  action,
  icon: Icon,
  variant = 'primary',
  confirmMessage,
  disabled = false,
  onAction
}) => {
  const theme = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = VARIANT_STYLES[variant];

  const handleClick = () => {
    if (confirmMessage) {
      setShowConfirm(true);
    } else {
      executeAction();
    }
  };

  const executeAction = async () => {
    setLoading(true);
    setError(null);
    setShowConfirm(false);

    try {
      await onAction(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const cancelConfirm = () => {
    setShowConfirm(false);
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={disabled || loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full justify-center"
        style={{
          backgroundColor: styles.bg,
          color: styles.text,
          border: `1px solid ${styles.border}`,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled || loading ? 'not-allowed' : 'pointer'
        }}
        onMouseEnter={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.backgroundColor = styles.hoverBg;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = styles.bg;
        }}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Icon size={16} />
        )}
        <span>{loading ? 'Processing...' : label}</span>
      </button>

      {error && (
        <p 
          className="text-xs mt-1 text-center"
          style={{ color: '#ef4444' }}
        >
          {error}
        </p>
      )}

      {showConfirm && (
        <div 
          className="absolute top-full left-0 right-0 mt-2 p-3 rounded-lg shadow-lg z-10"
          style={{
            backgroundColor: theme.colors.secondarySurface,
            border: `1px solid ${theme.colors.logoAccent}40`
          }}
        >
          <p 
            className="text-sm mb-3"
            style={{ color: theme.colors.primaryText }}
          >
            {confirmMessage || `Are you sure you want to ${label.toLowerCase()}?`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={executeAction}
              className="flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: styles.bg,
                color: styles.text,
                border: `1px solid ${styles.border}`
              }}
            >
              Confirm
            </button>
            <button
              onClick={cancelConfirm}
              className="flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: theme.colors.primaryBg,
                color: theme.colors.mutedText,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionButton;
