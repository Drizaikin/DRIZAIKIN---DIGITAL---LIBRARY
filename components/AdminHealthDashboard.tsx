/**
 * AdminHealthDashboard Component
 * Main dashboard page for monitoring system health
 * 
 * Requirements: 8.3-8.5
 * - 8.3: Display loading state while fetching
 * - 8.4: Display error state on failure
 * - 8.5: Support manual refresh of metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, 
  Activity, 
  Database, 
  HardDrive, 
  Cpu,
  Play,
  Pause,
  PlayCircle,
  Wrench,
  BookOpen,
  SkipForward,
  XCircle,
  Tags,
  AlertTriangle,
  Clock,
  FileText,
  Filter,
  User,
  CheckCircle,
  Settings
} from 'lucide-react';
import { useAppTheme } from '../hooks/useAppTheme';
import { StatusCard, MetricsCard, ErrorList, ActionButton, HealthStatus } from './admin';
import { PRIMARY_GENRES } from '../services/ingestion/genreTaxonomy';

// API URL from environment
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Types matching the API response
interface SystemStatus {
  ingestion: HealthStatus;
  maintenance: HealthStatus;
  aiClassification: HealthStatus;
  overall: HealthStatus;
}

interface DailyMetrics {
  booksIngested: number;
  booksSkipped: number;
  booksFailed: number;
  booksClassified: number;
  classificationFailures: number;
  date: string;
}

interface IngestionProgress {
  source: string;
  lastPage: number;
  lastCursor: string | null;
  totalIngested: number;
  lastRunAt: string | null;
  lastRunStatus: string;
}

interface StorageHealth {
  totalPdfs: number;
  estimatedSizeMb: number;
  orphanedFiles: number | null;
  corruptFiles: number | null;
}

interface ErrorEntry {
  timestamp: string;
  type: string;
  message: string;
  identifier?: string;
}

interface ActionEntry {
  timestamp: string;
  action: string;
  result: string;
}

interface ErrorSummary {
  ingestionErrors: ErrorEntry[];
  maintenanceActions: ActionEntry[];
  lastAiError: ErrorEntry | null;
}

interface FilterConfig {
  allowedGenres: string[];
  allowedAuthors: string[];
  enableGenreFilter: boolean;
  enableAuthorFilter: boolean;
}

interface HealthMetrics {
  systemStatus: SystemStatus;
  dailyMetrics: DailyMetrics;
  ingestionProgress: IngestionProgress;
  storageHealth: StorageHealth;
  errorSummary: ErrorSummary;
  timestamp: string;
  responseTimeMs?: number;
}

const AdminHealthDashboard: React.FC = () => {
  const theme = useAppTheme();
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  // Filter configuration state
  const [filterConfig, setFilterConfig] = useState<FilterConfig | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterSaving, setFilterSaving] = useState(false);
  const [filterMessage, setFilterMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [authorInput, setAuthorInput] = useState('');
  const [showFilterConfig, setShowFilterConfig] = useState(false);

  // Get admin secret from localStorage or prompt
  const getAdminSecret = (): string | null => {
    let secret = localStorage.getItem('ADMIN_HEALTH_SECRET');
    if (!secret) {
      secret = prompt('Enter Admin Health Secret:');
      if (secret) {
        localStorage.setItem('ADMIN_HEALTH_SECRET', secret);
      }
    }
    return secret;
  };

  // Fetch health metrics from API
  const fetchMetrics = useCallback(async (isRefresh = false) => {
    const secret = getAdminSecret();
    if (!secret) {
      setError('Admin secret is required to access the health dashboard');
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secret}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('ADMIN_HEALTH_SECRET');
          throw new Error('Invalid admin secret. Please refresh and try again.');
        }
        throw new Error(`Failed to fetch health metrics: ${response.statusText}`);
      }

      const data: HealthMetrics = await response.json();
      setMetrics(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Execute admin action
  const executeAction = async (action: string): Promise<void> => {
    const secret = getAdminSecret();
    if (!secret) {
      throw new Error('Admin secret is required');
    }

    const response = await fetch(`${API_URL}/admin/health/actions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || `Action failed: ${response.statusText}`);
    }

    // Refresh metrics after action
    await fetchMetrics(true);
  };

  // Fetch filter configuration
  const fetchFilterConfig = useCallback(async () => {
    setFilterLoading(true);
    try {
      const secret = getAdminSecret();
      if (!secret) return;

      const response = await fetch(`${API_URL}/admin/ingestion/filters`, {
        headers: {
          'Authorization': `Bearer ${secret}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFilterConfig(data.config);
        setAuthorInput(data.config.allowedAuthors?.join(', ') || '');
      }
    } catch (err) {
      console.error('Failed to load filter config:', err);
    } finally {
      setFilterLoading(false);
    }
  }, []);

  // Save filter configuration
  const saveFilterConfig = async () => {
    if (!filterConfig) return;
    
    setFilterSaving(true);
    try {
      const secret = getAdminSecret();
      if (!secret) throw new Error('Admin secret required');

      const authors = authorInput
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const updatedConfig = {
        ...filterConfig,
        allowedAuthors: authors
      };

      const response = await fetch(`${API_URL}/admin/ingestion/filters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`
        },
        body: JSON.stringify(updatedConfig)
      });

      if (response.ok) {
        setFilterConfig(updatedConfig);
        setFilterMessage({ type: 'success', text: 'Filter configuration saved!' });
        setTimeout(() => setFilterMessage(null), 3000);
      } else {
        const data = await response.json();
        setFilterMessage({ type: 'error', text: data.errors?.join(', ') || 'Failed to save' });
        setTimeout(() => setFilterMessage(null), 3000);
      }
    } catch (err) {
      setFilterMessage({ type: 'error', text: 'Failed to save configuration' });
      setTimeout(() => setFilterMessage(null), 3000);
    } finally {
      setFilterSaving(false);
    }
  };

  // Toggle genre in filter
  const handleGenreToggle = (genre: string) => {
    if (!filterConfig) return;
    setFilterConfig(prev => prev ? ({
      ...prev,
      allowedGenres: prev.allowedGenres.includes(genre)
        ? prev.allowedGenres.filter(g => g !== genre)
        : [...prev.allowedGenres, genre]
    }) : null);
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchMetrics();
    fetchFilterConfig();
  }, [fetchMetrics, fetchFilterConfig]);

  // Format storage size
  const formatStorageSize = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  // Loading state (Requirement 8.3)
  if (loading) {
    return (
      <div 
        className="min-h-[400px] flex flex-col items-center justify-center"
        style={{ color: theme.colors.mutedText }}
      >
        <RefreshCw size={40} className="animate-spin mb-4" style={{ color: theme.colors.accent }} />
        <p className="text-lg font-medium">Loading health metrics...</p>
        <p className="text-sm mt-2">This may take a few seconds</p>
      </div>
    );
  }

  // Error state (Requirement 8.4)
  if (error) {
    return (
      <div 
        className="min-h-[400px] flex flex-col items-center justify-center p-6"
        style={{ color: theme.colors.mutedText }}
      >
        <div 
          className="p-4 rounded-full mb-4"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
        >
          <AlertTriangle size={40} style={{ color: '#ef4444' }} />
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: theme.colors.primaryText }}>
          Failed to Load Dashboard
        </h2>
        <p className="text-center mb-4 max-w-md">{error}</p>
        <button
          onClick={() => fetchMetrics()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ 
            backgroundColor: theme.colors.accent, 
            color: theme.colors.primaryBg 
          }}
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 
            className="text-2xl md:text-3xl font-bold"
            style={{ color: theme.colors.primaryText }}
          >
            System Health Dashboard
          </h1>
          <p 
            className="text-sm mt-1"
            style={{ color: theme.colors.mutedText }}
          >
            Monitor ingestion, storage, and AI classification services
          </p>
        </div>
        
        {/* Manual Refresh Button (Requirement 8.5) */}
        <div className="flex items-center gap-3 flex-wrap">
          {lastRefresh && (
            <span 
              className="text-xs flex items-center gap-1"
              style={{ color: theme.colors.mutedText }}
            >
              <Clock size={12} />
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              color: theme.colors.primaryText,
              border: `1px solid ${theme.colors.logoAccent}40`,
              opacity: refreshing ? 0.7 : 1
            }}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Response Time Badge */}
      {metrics.responseTimeMs && (
        <div 
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs mb-4"
          style={{ 
            backgroundColor: theme.colors.secondarySurface,
            color: theme.colors.mutedText 
          }}
        >
          <Activity size={12} />
          API Response: {metrics.responseTimeMs}ms
        </div>
      )}

      {/* System Status Cards */}
      <section className="mb-6">
        <h2 
          className="text-lg font-semibold mb-4 flex items-center gap-2"
          style={{ color: theme.colors.primaryText }}
        >
          <Activity size={20} style={{ color: theme.colors.accent }} />
          System Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusCard
            title="Overall Status"
            status={metrics.systemStatus.overall}
            lastUpdated={metrics.timestamp}
          />
          <StatusCard
            title="Ingestion Service"
            status={metrics.systemStatus.ingestion}
            lastUpdated={metrics.ingestionProgress.lastRunAt || undefined}
            details={`Last run: ${metrics.ingestionProgress.lastRunStatus}`}
          />
          <StatusCard
            title="Maintenance Service"
            status={metrics.systemStatus.maintenance}
            lastUpdated={metrics.timestamp}
          />
          <StatusCard
            title="AI Classification"
            status={metrics.systemStatus.aiClassification}
            lastUpdated={metrics.timestamp}
            details={`${metrics.dailyMetrics.booksClassified} classified today`}
          />
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="mb-6">
        <h2 
          className="text-lg font-semibold mb-4 flex items-center gap-2"
          style={{ color: theme.colors.primaryText }}
        >
          <Database size={20} style={{ color: theme.colors.accent }} />
          Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Daily Metrics */}
          <MetricsCard
            title="Today's Activity"
            icon={BookOpen}
            metrics={[
              { label: 'Books Ingested', value: metrics.dailyMetrics.booksIngested, icon: BookOpen, highlight: true },
              { label: 'Books Skipped', value: metrics.dailyMetrics.booksSkipped, icon: SkipForward },
              { label: 'Books Failed', value: metrics.dailyMetrics.booksFailed, icon: XCircle },
              { label: 'Books Classified', value: metrics.dailyMetrics.booksClassified, icon: Tags },
              { label: 'Classification Failures', value: metrics.dailyMetrics.classificationFailures, icon: AlertTriangle }
            ]}
          />

          {/* Ingestion Progress */}
          <MetricsCard
            title="Ingestion Progress"
            icon={Cpu}
            metrics={[
              { label: 'Source', value: metrics.ingestionProgress.source },
              { label: 'Current Page', value: metrics.ingestionProgress.lastPage },
              { label: 'Total Ingested', value: metrics.ingestionProgress.totalIngested, highlight: true },
              { label: 'Last Status', value: metrics.ingestionProgress.lastRunStatus }
            ]}
          />

          {/* Storage Health */}
          <MetricsCard
            title="Storage Health"
            icon={HardDrive}
            metrics={[
              { label: 'Total PDFs', value: metrics.storageHealth.totalPdfs, highlight: true },
              { label: 'Estimated Size', value: formatStorageSize(metrics.storageHealth.estimatedSizeMb) },
              { label: 'Orphaned Files', value: metrics.storageHealth.orphanedFiles ?? 'N/A' },
              { label: 'Corrupt Files', value: metrics.storageHealth.corruptFiles ?? 'N/A' }
            ]}
          />
        </div>
      </section>

      {/* Admin Actions */}
      <section className="mb-6">
        <h2 
          className="text-lg font-semibold mb-4 flex items-center gap-2"
          style={{ color: theme.colors.primaryText }}
        >
          <Wrench size={20} style={{ color: theme.colors.accent }} />
          Admin Actions
        </h2>
        <div 
          className="p-4 rounded-xl"
          style={{ 
            backgroundColor: theme.colors.secondarySurface,
            border: `1px solid ${theme.colors.logoAccent}40`
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ActionButton
              label="Trigger Ingestion"
              action="trigger_ingestion"
              icon={Play}
              variant="primary"
              confirmMessage="This will start a new ingestion job. Continue?"
              onAction={executeAction}
            />
            <ActionButton
              label="Pause Ingestion"
              action="pause_ingestion"
              icon={Pause}
              variant="warning"
              confirmMessage="This will pause all ingestion jobs. Continue?"
              onAction={executeAction}
            />
            <ActionButton
              label="Resume Ingestion"
              action="resume_ingestion"
              icon={PlayCircle}
              variant="primary"
              confirmMessage="This will resume paused ingestion jobs. Continue?"
              onAction={executeAction}
            />
            <ActionButton
              label="Trigger Maintenance"
              action="trigger_maintenance"
              icon={Wrench}
              variant="primary"
              confirmMessage="This will start a maintenance job. Continue?"
              onAction={executeAction}
            />
          </div>
        </div>
      </section>

      {/* Ingestion Filter Configuration */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 
            className="text-lg font-semibold flex items-center gap-2"
            style={{ color: theme.colors.primaryText }}
          >
            <Filter size={20} style={{ color: theme.colors.accent }} />
            Ingestion Filters
          </h2>
          <button
            onClick={() => setShowFilterConfig(!showFilterConfig)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              color: theme.colors.primaryText,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <Settings size={14} />
            {showFilterConfig ? 'Hide' : 'Configure'}
          </button>
        </div>

        {/* Filter Status Summary */}
        <div 
          className="p-4 rounded-xl mb-4"
          style={{ 
            backgroundColor: theme.colors.secondarySurface,
            border: `1px solid ${theme.colors.logoAccent}40`
          }}
        >
          {filterLoading ? (
            <div className="flex items-center gap-2" style={{ color: theme.colors.mutedText }}>
              <RefreshCw size={16} className="animate-spin" />
              Loading filter configuration...
            </div>
          ) : filterConfig ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Genre Filter Status */}
              <div className="flex items-start gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: filterConfig.enableGenreFilter ? `${theme.colors.accent}20` : `${theme.colors.mutedText}20` }}
                >
                  <Tags size={20} style={{ color: filterConfig.enableGenreFilter ? theme.colors.accent : theme.colors.mutedText }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: theme.colors.primaryText }}>
                    Genre Filter: {filterConfig.enableGenreFilter ? (
                      <span className="text-green-400">Enabled</span>
                    ) : (
                      <span style={{ color: theme.colors.mutedText }}>Disabled</span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: theme.colors.mutedText }}>
                    {filterConfig.enableGenreFilter && filterConfig.allowedGenres.length > 0 
                      ? `${filterConfig.allowedGenres.length} genre(s) allowed`
                      : filterConfig.enableGenreFilter 
                        ? 'All genres allowed'
                        : 'No genre filtering'}
                  </p>
                </div>
              </div>

              {/* Author Filter Status */}
              <div className="flex items-start gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: filterConfig.enableAuthorFilter ? `${theme.colors.accent}20` : `${theme.colors.mutedText}20` }}
                >
                  <User size={20} style={{ color: filterConfig.enableAuthorFilter ? theme.colors.accent : theme.colors.mutedText }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: theme.colors.primaryText }}>
                    Author Filter: {filterConfig.enableAuthorFilter ? (
                      <span className="text-green-400">Enabled</span>
                    ) : (
                      <span style={{ color: theme.colors.mutedText }}>Disabled</span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: theme.colors.mutedText }}>
                    {filterConfig.enableAuthorFilter && filterConfig.allowedAuthors.length > 0 
                      ? `${filterConfig.allowedAuthors.length} author(s) allowed`
                      : filterConfig.enableAuthorFilter 
                        ? 'All authors allowed'
                        : 'No author filtering'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: theme.colors.mutedText }}>Unable to load filter configuration</p>
          )}
        </div>

        {/* Expanded Filter Configuration */}
        {showFilterConfig && filterConfig && (
          <div 
            className="p-4 rounded-xl space-y-4"
            style={{ 
              backgroundColor: theme.colors.secondarySurface,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            {filterMessage && (
              <div 
                className="px-3 py-2 rounded-lg flex items-center gap-2 text-sm"
                style={{
                  backgroundColor: filterMessage.type === 'success' ? '#0d3320' : '#3d1f1f',
                  color: filterMessage.type === 'success' ? '#4ade80' : '#f87171',
                  border: `1px solid ${filterMessage.type === 'success' ? '#166534' : '#991b1b'}`
                }}
              >
                {filterMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                {filterMessage.text}
              </div>
            )}

            {/* Genre Filter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: theme.colors.primaryText }}>
                  Genre Filter
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterConfig.enableGenreFilter}
                    onChange={(e) => setFilterConfig({ ...filterConfig, enableGenreFilter: e.target.checked })}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: theme.colors.accent }}
                  />
                  <span className="text-xs" style={{ color: theme.colors.mutedText }}>Enable</span>
                </label>
              </div>
              <div 
                className="p-3 rounded-lg"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`
                }}
              >
                <p className="text-xs mb-2" style={{ color: theme.colors.mutedText }}>
                  Select genres to allow during ingestion:
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {PRIMARY_GENRES.map(genre => (
                    <button
                      key={genre}
                      onClick={() => handleGenreToggle(genre)}
                      className="px-2 py-1 text-xs rounded transition-all"
                      style={{
                        backgroundColor: filterConfig.allowedGenres.includes(genre)
                          ? theme.colors.accent
                          : theme.colors.secondarySurface,
                        color: filterConfig.allowedGenres.includes(genre)
                          ? '#ffffff'
                          : theme.colors.primaryText,
                        border: `1px solid ${filterConfig.allowedGenres.includes(genre) 
                          ? theme.colors.accent 
                          : `${theme.colors.logoAccent}40`}`
                      }}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Author Filter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: theme.colors.primaryText }}>
                  Author Filter
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterConfig.enableAuthorFilter}
                    onChange={(e) => setFilterConfig({ ...filterConfig, enableAuthorFilter: e.target.checked })}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: theme.colors.accent }}
                  />
                  <span className="text-xs" style={{ color: theme.colors.mutedText }}>Enable</span>
                </label>
              </div>
              <textarea
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
                placeholder="Enter author names (comma-separated)"
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: theme.colors.primaryBg,
                  border: `1px solid ${theme.colors.logoAccent}40`,
                  color: theme.colors.primaryText
                }}
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={saveFilterConfig}
                disabled={filterSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: theme.colors.accent }}
              >
                {filterSaving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    Save Filters
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Error Summary */}
      <section className="mb-6">
        <h2 
          className="text-lg font-semibold mb-4 flex items-center gap-2"
          style={{ color: theme.colors.primaryText }}
        >
          <FileText size={20} style={{ color: theme.colors.accent }} />
          Recent Activity
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ErrorList
            title="Recent Errors"
            errors={metrics.errorSummary.ingestionErrors}
            maxItems={10}
            emptyMessage="No recent errors"
          />
          <ErrorList
            title="Maintenance Actions"
            errors={metrics.errorSummary.maintenanceActions.map(action => ({
              timestamp: action.timestamp,
              type: action.action,
              message: action.result
            }))}
            maxItems={10}
            emptyMessage="No recent maintenance actions"
          />
        </div>
      </section>
    </div>
  );
};

export default AdminHealthDashboard;
