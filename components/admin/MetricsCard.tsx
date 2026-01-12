/**
 * MetricsCard Component
 * Displays a group of related metrics with labels and values
 * 
 * Requirements: 3.1-3.5, 4.1-4.5, 5.1-5.4
 * - Display grouped metrics with labels and values
 * - Support number and string values
 */

import React from 'react';
import { useAppTheme } from '../../hooks/useAppTheme';
import { LucideIcon } from 'lucide-react';

interface MetricItem {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  highlight?: boolean;
}

interface MetricsCardProps {
  title: string;
  icon?: LucideIcon;
  metrics: MetricItem[];
}

const MetricsCard: React.FC<MetricsCardProps> = ({ title, icon: TitleIcon, metrics }) => {
  const theme = useAppTheme();

  const formatValue = (value: number | string): string => {
    if (typeof value === 'number') {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toLocaleString();
    }
    return value;
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
        {TitleIcon && (
          <TitleIcon size={18} style={{ color: theme.colors.accent }} />
        )}
        <h3 
          className="text-sm font-medium"
          style={{ color: theme.colors.mutedText }}
        >
          {title}
        </h3>
      </div>

      <div className="space-y-3">
        {metrics.map((metric, index) => {
          const MetricIcon = metric.icon;
          return (
            <div 
              key={index}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {MetricIcon && (
                  <MetricIcon 
                    size={14} 
                    style={{ color: theme.colors.mutedText }} 
                  />
                )}
                <span 
                  className="text-sm"
                  style={{ color: theme.colors.mutedText }}
                >
                  {metric.label}
                </span>
              </div>
              <span 
                className="text-sm font-semibold"
                style={{ 
                  color: metric.highlight 
                    ? theme.colors.accent 
                    : theme.colors.primaryText 
                }}
              >
                {formatValue(metric.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MetricsCard;
