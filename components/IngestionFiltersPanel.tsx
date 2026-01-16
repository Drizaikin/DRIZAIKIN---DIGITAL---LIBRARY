import React, { useState, useEffect } from 'react';
import { Filter, Save, X, AlertCircle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { useAppTheme } from '../hooks/useAppTheme';
import { PRIMARY_GENRES } from '../services/ingestion/genreTaxonomy';

// Use environment variable or relative path for Vercel deployment
const API_URL = import.meta.env.VITE_API_URL || '/api';

interface FilterConfig {
  allowedGenres: string[];
  allowedAuthors: string[];
  enableGenreFilter: boolean;
  enableAuthorFilter: boolean;
}

interface FilterStats {
  totalEvaluated: number;
  passed: number;
  filtered: number;
  filteredByGenre: number;
  filteredByAuthor: number;
  jobsAnalyzed: number;
  topFilteredGenres: Array<{ genre: string; count: number }>;
  topFilteredAuthors: Array<{ author: string; count: number }>;
  note?: string;
}

const IngestionFiltersPanel: React.FC = () => {
  const theme = useAppTheme();
  const [config, setConfig] = useState<FilterConfig>({
    allowedGenres: [],
    allowedAuthors: [],
    enableGenreFilter: false,
    enableAuthorFilter: false
  });
  const [stats, setStats] = useState<FilterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [authorInput, setAuthorInput] = useState('');

  useEffect(() => {
    loadConfiguration();
    loadStatistics();
  }, []);

  const loadConfiguration = async () => {
    try {
      const adminSecret = localStorage.getItem('adminHealthSecret');
      const response = await fetch(`${API_URL}/admin/ingestion/filters`, {
        headers: {
          'Authorization': `Bearer ${adminSecret}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setAuthorInput(data.config.allowedAuthors.join(', '));
      } else {
        showMessage('error', 'Failed to load filter configuration');
      }
    } catch (err) {
      console.error('Failed to load configuration:', err);
      showMessage('error', 'Failed to load filter configuration');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const adminSecret = localStorage.getItem('adminHealthSecret');
      const response = await fetch(`${API_URL}/admin/ingestion/filter-stats`, {
        headers: {
          'Authorization': `Bearer ${adminSecret}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.statistics);
      } else {
        console.error('Failed to load statistics');
      }
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleGenreToggle = (genre: string) => {
    setConfig(prev => ({
      ...prev,
      allowedGenres: prev.allowedGenres.includes(genre)
        ? prev.allowedGenres.filter(g => g !== genre)
        : [...prev.allowedGenres, genre]
    }));
  };

  const handleSaveConfiguration = async () => {
    setSaving(true);
    try {
      // Parse authors from comma-separated input
      const authors = authorInput
        .split(',')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      const updatedConfig = {
        ...config,
        allowedAuthors: authors
      };

      const adminSecret = localStorage.getItem('adminHealthSecret');
      const response = await fetch(`${API_URL}/admin/ingestion/filters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSecret}`
        },
        body: JSON.stringify(updatedConfig)
      });

      if (response.ok) {
        showMessage('success', 'Filter configuration saved successfully!');
        setConfig(updatedConfig);
      } else {
        const data = await response.json();
        showMessage('error', data.errors?.join(', ') || 'Failed to save configuration');
      }
    } catch (err) {
      console.error('Failed to save configuration:', err);
      showMessage('error', 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleClearFilters = () => {
    if (confirm('Are you sure you want to clear all filters? This will allow all genres and authors.')) {
      setConfig({
        allowedGenres: [],
        allowedAuthors: [],
        enableGenreFilter: false,
        enableAuthorFilter: false
      });
      setAuthorInput('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div 
          className="h-8 w-8 border-4 rounded-full animate-spin"
          style={{ 
            borderColor: `${theme.colors.accent}30`,
            borderTopColor: theme.colors.accent 
          }} 
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-6">
      <header className="mb-6">
        <h2 
          className="text-2xl md:text-3xl font-serif font-bold mb-2"
          style={{ color: theme.colors.accent }}
        >
          Ingestion Filters
        </h2>
        <p 
          className="text-sm md:text-base"
          style={{ color: theme.colors.mutedText }}
        >
          Configure which books to ingest based on genre and author criteria.
        </p>
      </header>

      {message && (
        <div 
          className="fixed top-20 md:top-24 right-4 left-4 md:left-auto px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm"
          style={{
            backgroundColor: message.type === 'success' ? '#0d3320' : '#3d1f1f',
            color: message.type === 'success' ? '#4ade80' : '#f87171',
            border: `1px solid ${message.type === 'success' ? '#166534' : '#991b1b'}`
          }}
        >
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Current Configuration */}
      <div 
        className="p-4 md:p-6 rounded-xl"
        style={{ 
          backgroundColor: theme.colors.secondarySurface,
          border: `1px solid ${theme.colors.logoAccent}40`
        }}
      >
        <h3 
          className="text-lg font-semibold mb-4 flex items-center gap-2"
          style={{ color: theme.colors.accent }}
        >
          <Filter size={20} />
          Filter Configuration
        </h3>

        {/* Genre Filter Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label 
              className="text-sm font-medium"
              style={{ color: theme.colors.primaryText }}
            >
              Genre Filter
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableGenreFilter}
                onChange={(e) => setConfig({ ...config, enableGenreFilter: e.target.checked })}
                className="w-4 h-4 rounded"
                style={{ accentColor: theme.colors.accent }}
              />
              <span className="text-sm" style={{ color: theme.colors.mutedText }}>
                Enable
              </span>
            </label>
          </div>

          <div 
            className="p-3 rounded-lg mb-2"
            style={{ 
              backgroundColor: theme.colors.primaryBg,
              border: `1px solid ${theme.colors.logoAccent}40`
            }}
          >
            <p className="text-xs mb-2" style={{ color: theme.colors.mutedText }}>
              Select genres to allow (empty = allow all):
            </p>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {PRIMARY_GENRES.map(genre => (
                <button
                  key={genre}
                  onClick={() => handleGenreToggle(genre)}
                  className="px-3 py-1.5 text-xs rounded-lg transition-all"
                  style={{
                    backgroundColor: config.allowedGenres.includes(genre)
                      ? theme.colors.accent
                      : theme.colors.secondarySurface,
                    color: config.allowedGenres.includes(genre)
                      ? '#ffffff'
                      : theme.colors.primaryText,
                    border: `1px solid ${config.allowedGenres.includes(genre) 
                      ? theme.colors.accent 
                      : `${theme.colors.logoAccent}40`}`
                  }}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {config.allowedGenres.length > 0 && (
            <p className="text-xs" style={{ color: theme.colors.mutedText }}>
              {config.allowedGenres.length} genre{config.allowedGenres.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Author Filter Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label 
              className="text-sm font-medium"
              style={{ color: theme.colors.primaryText }}
            >
              Author Filter
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableAuthorFilter}
                onChange={(e) => setConfig({ ...config, enableAuthorFilter: e.target.checked })}
                className="w-4 h-4 rounded"
                style={{ accentColor: theme.colors.accent }}
              />
              <span className="text-sm" style={{ color: theme.colors.mutedText }}>
                Enable
              </span>
            </label>
          </div>

          <div>
            <p className="text-xs mb-2" style={{ color: theme.colors.mutedText }}>
              Enter author names (comma-separated, case-insensitive):
            </p>
            <textarea
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              placeholder="e.g., Robin Sharma, Paulo Coelho, Dale Carnegie"
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${theme.colors.logoAccent}40`,
                color: theme.colors.primaryText,
                '--tw-ring-color': `${theme.colors.accent}40`
              } as React.CSSProperties}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSaveConfiguration}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: theme.colors.accent }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            onClick={handleClearFilters}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: theme.colors.primaryBg,
              border: `1px solid ${theme.colors.logoAccent}40`,
              color: theme.colors.primaryText
            }}
          >
            <X size={16} />
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Filter Statistics */}
      {stats && (
        <div 
          className="p-4 md:p-6 rounded-xl"
          style={{ 
            backgroundColor: theme.colors.secondarySurface,
            border: `1px solid ${theme.colors.logoAccent}40`
          }}
        >
          <h3 
            className="text-lg font-semibold mb-4 flex items-center gap-2"
            style={{ color: theme.colors.accent }}
          >
            <TrendingUp size={20} />
            Filter Statistics
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
            <div 
              className="p-3 rounded-lg"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <p className="text-xs mb-1" style={{ color: theme.colors.mutedText }}>
                Total Evaluated
              </p>
              <p className="text-xl md:text-2xl font-bold" style={{ color: theme.colors.accent }}>
                {stats.totalEvaluated}
              </p>
            </div>

            <div 
              className="p-3 rounded-lg"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <p className="text-xs mb-1" style={{ color: theme.colors.mutedText }}>
                Passed
              </p>
              <p className="text-xl md:text-2xl font-bold text-green-400">
                {stats.passed}
              </p>
            </div>

            <div 
              className="p-3 rounded-lg"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <p className="text-xs mb-1" style={{ color: theme.colors.mutedText }}>
                Filtered
              </p>
              <p className="text-xl md:text-2xl font-bold text-red-400">
                {stats.filtered}
              </p>
            </div>

            <div 
              className="p-3 rounded-lg"
              style={{ 
                backgroundColor: theme.colors.primaryBg,
                border: `1px solid ${theme.colors.logoAccent}40`
              }}
            >
              <p className="text-xs mb-1" style={{ color: theme.colors.mutedText }}>
                Jobs Analyzed
              </p>
              <p className="text-xl md:text-2xl font-bold" style={{ color: theme.colors.primaryText }}>
                {stats.jobsAnalyzed}
              </p>
            </div>
          </div>

          {stats.note && (
            <div 
              className="p-3 rounded-lg flex items-start gap-2"
              style={{ 
                backgroundColor: `${theme.colors.accent}10`,
                border: `1px solid ${theme.colors.accent}40`
              }}
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" style={{ color: theme.colors.accent }} />
              <p className="text-xs" style={{ color: theme.colors.mutedText }}>
                {stats.note}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IngestionFiltersPanel;
