import React, { useState, useEffect } from 'react';
import {
  Play, Pause, Square, Trash2, Plus, AlertCircle, Clock,
  FileText, CheckCircle, XCircle, Loader, ExternalLink, RefreshCw,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { authService } from '../services/authService';
import {
  ExtractionJob,
  ExtractedBook,
  ExtractionLog,
  ExtractionProgress,
  extractionService
} from '../services/extractionService';
import { darkTheme } from '../constants/darkTheme';

const ExtractionPanel: React.FC = () => {
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ExtractionJob | null>(null);
  const [extractedBooks, setExtractedBooks] = useState<ExtractedBook[]>([]);
  const [logs, setLogs] = useState<ExtractionLog[]>([]);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Collapsible sections state for mobile (Requirement 8.5)
  const [expandedSections, setExpandedSections] = useState<{
    books: boolean;
    logs: boolean;
    info: boolean;
  }>({ books: true, logs: false, info: true });
  
  // Form state
  const [sourceUrl, setSourceUrl] = useState('');
  const [maxTimeMinutes, setMaxTimeMinutes] = useState<number>(60);
  const [maxBooks, setMaxBooks] = useState<number>(100);
  const [useDefaults, setUseDefaults] = useState(true);

  // Toggle collapsible section
  const toggleSection = (section: 'books' | 'logs' | 'info') => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    fetchJobs();
    
    // Poll for progress updates every 5 seconds for running jobs
    const interval = setInterval(() => {
      jobs.forEach(job => {
        if (job.status === 'running') {
          updateJobProgress(job.id);
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [jobs.length]);

  const fetchJobs = async () => {
    try {
      const jobList = await extractionService.getJobHistory();
      // Sort by date descending (most recent first) - Requirement 6.1
      const sortedJobs = jobList.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setJobs(sortedJobs);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateJobProgress = async (jobId: string) => {
    try {
      const progressData = await extractionService.getJobProgress(jobId);
      setProgress(prev => prev?.jobId === jobId ? progressData : prev);
      
      // Refresh job list to update counts
      fetchJobs();
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sourceUrl.trim()) {
      showMessage('error', 'Please enter a valid URL');
      return;
    }

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        showMessage('error', 'You must be logged in');
        return;
      }

      const options = useDefaults ? {} : { maxTimeMinutes, maxBooks };
      await extractionService.createJob(sourceUrl, currentUser.id, options);
      
      showMessage('success', 'Extraction job created successfully!');
      setShowCreateForm(false);
      resetForm();
      fetchJobs();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to create job');
    }
  };

  const handleStartJob = async (jobId: string) => {
    try {
      await extractionService.startJob(jobId);
      showMessage('success', 'Job started successfully!');
      fetchJobs();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to start job');
    }
  };

  const handlePauseJob = async (jobId: string) => {
    try {
      await extractionService.pauseJob(jobId);
      showMessage('success', 'Job paused successfully!');
      fetchJobs();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to pause job');
    }
  };

  const handleResumeJob = async (jobId: string) => {
    try {
      await extractionService.resumeJob(jobId);
      showMessage('success', 'Job resumed successfully!');
      fetchJobs();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to resume job');
    }
  };

  const handleStopJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to stop this job? This action cannot be undone.')) return;
    
    try {
      await extractionService.stopJob(jobId);
      showMessage('success', 'Job stopped successfully!');
      fetchJobs();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to stop job');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This will remove all associated data.')) return;
    
    try {
      await extractionService.deleteJob(jobId);
      showMessage('success', 'Job deleted successfully!');
      if (selectedJob?.id === jobId) {
        setSelectedJob(null);
      }
      fetchJobs();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to delete job');
    }
  };

  const handleViewJobDetails = async (job: ExtractionJob) => {
    setSelectedJob(job);
    
    try {
      const [books, jobLogs] = await Promise.all([
        extractionService.getExtractedBooks(job.id),
        extractionService.getJobLogs(job.id, 50)
      ]);
      
      setExtractedBooks(books);
      setLogs(jobLogs);
      
      if (job.status === 'running') {
        const progressData = await extractionService.getJobProgress(job.id);
        setProgress(progressData);
      }
    } catch (err) {
      console.error('Failed to fetch job details:', err);
    }
  };

  const resetForm = () => {
    setSourceUrl('');
    setMaxTimeMinutes(60);
    setMaxBooks(100);
    setUseDefaults(true);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const getStatusColor = (status: ExtractionJob['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-900/50 text-blue-400';
      case 'completed':
        return 'bg-green-900/50 text-green-400';
      case 'failed':
        return 'bg-red-900/50 text-red-400';
      case 'paused':
        return 'bg-yellow-900/50 text-yellow-400';
      case 'stopped':
        return 'bg-gray-700/50 text-gray-400';
      default:
        return 'bg-slate-700/50 text-slate-400';
    }
  };

  const getStatusIcon = (status: ExtractionJob['status']) => {
    switch (status) {
      case 'running':
        return <Loader className="animate-spin" size={14} />;
      case 'completed':
        return <CheckCircle size={14} />;
      case 'failed':
        return <XCircle size={14} />;
      case 'paused':
        return <Pause size={14} />;
      case 'stopped':
        return <Square size={14} />;
      default:
        return <Clock size={14} />;
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div 
          className="h-8 w-8 border-4 rounded-full animate-spin"
          style={{ 
            borderColor: `${darkTheme.colors.accent}30`,
            borderTopColor: darkTheme.colors.accent 
          }} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div 
          className="fixed top-20 md:top-24 right-4 left-4 md:left-auto px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm"
          style={{
            backgroundColor: message.type === 'success' ? '#0d3320' : '#3d1f1f',
            color: message.type === 'success' ? '#4ade80' : '#f87171',
            border: `1px solid ${message.type === 'success' ? '#166534' : '#991b1b'}`
          }}
        >
          {message.type === 'error' && <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Header with Create Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold" style={{ color: darkTheme.colors.accent }}>AI Book Extraction</h3>
          <p className="text-sm" style={{ color: darkTheme.colors.mutedText }}>Automatically extract PDF books from websites</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-white text-sm rounded-lg transition-colors w-full sm:w-auto justify-center"
          style={{ backgroundColor: darkTheme.colors.accent }}
        >
          <Plus size={16} />
          New Extraction Job
        </button>
      </div>

      {/* Create Job Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: darkTheme.colors.secondarySurface }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: darkTheme.colors.accent }}>Create Extraction Job</h3>
            
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: darkTheme.colors.mutedText }}>
                  Source URL *
                </label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://example.com/books"
                  className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: darkTheme.colors.primaryBg,
                    border: `1px solid ${darkTheme.colors.logoAccent}40`,
                    color: darkTheme.colors.primaryText
                  }}
                  required
                />
                <p className="text-xs mt-1" style={{ color: darkTheme.colors.mutedText }}>
                  Enter the URL to crawl for PDF files
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useDefaults"
                  checked={useDefaults}
                  onChange={(e) => setUseDefaults(e.target.checked)}
                  className="rounded border-gray-600"
                  style={{ accentColor: darkTheme.colors.accent }}
                />
                <label htmlFor="useDefaults" className="text-sm" style={{ color: darkTheme.colors.primaryText }}>
                  Use default limits (60 minutes, 100 books)
                </label>
              </div>

              {!useDefaults && (
                <div className="space-y-3 pl-6 border-l-2" style={{ borderColor: `${darkTheme.colors.logoAccent}40` }}>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: darkTheme.colors.mutedText }}>
                      Max Time (minutes)
                    </label>
                    <input
                      type="number"
                      value={maxTimeMinutes}
                      onChange={(e) => setMaxTimeMinutes(parseInt(e.target.value) || 60)}
                      min="1"
                      max="1440"
                      className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: darkTheme.colors.primaryBg,
                        border: `1px solid ${darkTheme.colors.logoAccent}40`,
                        color: darkTheme.colors.primaryText
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: darkTheme.colors.mutedText }}>
                      Max Books
                    </label>
                    <input
                      type="number"
                      value={maxBooks}
                      onChange={(e) => setMaxBooks(parseInt(e.target.value) || 100)}
                      min="1"
                      max="1000"
                      className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: darkTheme.colors.primaryBg,
                        border: `1px solid ${darkTheme.colors.logoAccent}40`,
                        color: darkTheme.colors.primaryText
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-white text-sm rounded-lg transition-colors"
                  style={{ backgroundColor: darkTheme.colors.accent }}
                >
                  Create Job
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm rounded-lg transition-colors"
                  style={{ 
                    border: `1px solid ${darkTheme.colors.logoAccent}40`,
                    color: darkTheme.colors.primaryText
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Job List - Card-based layout for mobile (Requirement 8.4) */}
      <div 
        className="rounded-xl overflow-hidden"
        style={{ 
          backgroundColor: darkTheme.colors.secondarySurface,
          border: `1px solid ${darkTheme.colors.logoAccent}40`
        }}
      >
        <div 
          className="p-4"
          style={{ 
            backgroundColor: darkTheme.colors.primaryBg,
            borderBottom: `1px solid ${darkTheme.colors.logoAccent}40`
          }}
        >
          <h4 className="font-semibold flex items-center gap-2" style={{ color: darkTheme.colors.primaryText }}>
            <FileText size={16} style={{ color: darkTheme.colors.accent }} />
            Extraction Jobs
          </h4>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8 text-center" style={{ color: darkTheme.colors.mutedText }}>
            <FileText size={48} className="mx-auto mb-3" style={{ color: `${darkTheme.colors.mutedText}50` }} />
            <p>No extraction jobs yet</p>
            <p className="text-sm mt-1">Create your first job to get started</p>
          </div>
        ) : (
          <div style={{ borderColor: `${darkTheme.colors.logoAccent}20` }}>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 transition-colors"
                style={{ borderBottom: `1px solid ${darkTheme.colors.logoAccent}20` }}
              >
                {/* Mobile Card Layout (Requirement 8.1, 8.4) */}
                <div className="flex flex-col gap-3">
                  {/* Status and Progress Row */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      {getStatusIcon(job.status)}
                      {job.status.toUpperCase()}
                    </span>
                    {job.status === 'running' && progress?.jobId === job.id && (
                      <span className="text-xs font-medium" style={{ color: darkTheme.colors.mutedText }}>
                        {progress.booksExtracted} / {progress.maxBooks} books
                      </span>
                    )}
                  </div>
                  
                  {/* URL - Truncated for mobile */}
                  <p className="text-sm font-medium break-all line-clamp-2" style={{ color: darkTheme.colors.primaryText }}>
                    {job.sourceUrl}
                  </p>
                  
                  {/* Stats Grid - Responsive layout */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: darkTheme.colors.mutedText }}>
                    <span className="flex items-center gap-1">
                      <span className="font-medium" style={{ color: darkTheme.colors.primaryText }}>Books:</span> {job.booksExtracted}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium" style={{ color: darkTheme.colors.primaryText }}>Errors:</span> {job.errorCount}
                    </span>
                    <span className="flex items-center gap-1 col-span-2 sm:col-span-1">
                      <span className="font-medium" style={{ color: darkTheme.colors.primaryText }}>Limit:</span> {job.maxTimeMinutes}min / {job.maxBooks} books
                    </span>
                    <span className="flex items-center gap-1 col-span-2 sm:col-span-1">
                      <span className="font-medium" style={{ color: darkTheme.colors.primaryText }}>Created:</span> {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Action Buttons - Touch-friendly 44x44px minimum (Requirement 8.3) */}
                  <div className="flex items-center gap-2 flex-wrap pt-2" style={{ borderTop: `1px solid ${darkTheme.colors.logoAccent}20` }}>
                    {job.status === 'pending' && (
                      <button
                        onClick={() => handleStartJob(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-green-400 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
                        title="Start Job"
                        aria-label="Start Job"
                      >
                        <Play size={20} />
                      </button>
                    )}
                    
                    {job.status === 'running' && (
                      <button
                        onClick={() => handlePauseJob(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-yellow-400 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)' }}
                        title="Pause Job"
                        aria-label="Pause Job"
                      >
                        <Pause size={20} />
                      </button>
                    )}
                    
                    {job.status === 'paused' && (
                      <button
                        onClick={() => handleResumeJob(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-blue-400 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                        title="Resume Job"
                        aria-label="Resume Job"
                      >
                        <Play size={20} />
                      </button>
                    )}
                    
                    {(job.status === 'running' || job.status === 'paused') && (
                      <button
                        onClick={() => handleStopJob(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-red-400 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                        title="Stop Job"
                        aria-label="Stop Job"
                      >
                        <Square size={20} />
                      </button>
                    )}
                    
                    {(job.status === 'failed' || job.status === 'stopped' || job.status === 'completed') && (
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-red-400 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                        title="Delete Job"
                        aria-label="Delete Job"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleViewJobDetails(job)}
                      className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                      style={{ color: darkTheme.colors.accent, backgroundColor: `${darkTheme.colors.accent}15` }}
                      title="View Details"
                      aria-label="View Details"
                    >
                      <ExternalLink size={20} />
                    </button>
                    
                    {job.status === 'running' && (
                      <button
                        onClick={() => updateJobProgress(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        style={{ color: darkTheme.colors.mutedText, backgroundColor: `${darkTheme.colors.logoAccent}15` }}
                        title="Refresh Progress"
                        aria-label="Refresh Progress"
                      >
                        <RefreshCw size={20} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar for Running Jobs - Touch-friendly (Requirement 8.2) */}
                {job.status === 'running' && progress?.jobId === job.id && (
                  <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${darkTheme.colors.logoAccent}20` }}>
                    <div className="flex flex-col sm:flex-row sm:justify-between text-xs mb-2 gap-1" style={{ color: darkTheme.colors.primaryText }}>
                      <span className="font-medium">Progress: {Math.round((progress.booksExtracted / progress.maxBooks) * 100)}%</span>
                      <span style={{ color: darkTheme.colors.mutedText }}>
                        Elapsed: {formatDuration(progress.elapsedSeconds)}
                        {progress.estimatedRemainingSeconds > 0 && (
                          <> • ETA: {formatDuration(progress.estimatedRemainingSeconds)}</>
                        )}
                      </span>
                    </div>
                    <div className="w-full rounded-full h-3 touch-manipulation" style={{ backgroundColor: `${darkTheme.colors.logoAccent}30` }}>
                      <div
                        className="h-3 rounded-full transition-all duration-300"
                        style={{ backgroundColor: darkTheme.colors.accent, width: `${Math.min((progress.booksExtracted / progress.maxBooks) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job Details Panel - Collapsible sections for mobile (Requirement 8.5) */}
      {selectedJob && (
        <div 
          className="rounded-xl overflow-hidden"
          style={{ 
            backgroundColor: darkTheme.colors.secondarySurface,
            border: `1px solid ${darkTheme.colors.logoAccent}40`
          }}
        >
          <div 
            className="p-4 flex items-center justify-between"
            style={{ 
              backgroundColor: darkTheme.colors.primaryBg,
              borderBottom: `1px solid ${darkTheme.colors.logoAccent}40`
            }}
          >
            <h4 className="font-semibold" style={{ color: darkTheme.colors.primaryText }}>Job Details</h4>
            <button
              onClick={() => setSelectedJob(null)}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
              style={{ color: darkTheme.colors.mutedText }}
              aria-label="Close details"
            >
              <XCircle size={20} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Job Info Section - Collapsible on mobile (Requirement 8.5) */}
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${darkTheme.colors.logoAccent}40` }}>
              <button
                onClick={() => toggleSection('info')}
                className="w-full p-3 flex items-center justify-between text-left min-h-[44px] touch-manipulation"
                style={{ backgroundColor: darkTheme.colors.primaryBg }}
                aria-expanded={expandedSections.info}
              >
                <span className="font-medium text-sm" style={{ color: darkTheme.colors.primaryText }}>Job Information</span>
                {expandedSections.info ? <ChevronUp size={18} style={{ color: darkTheme.colors.mutedText }} /> : <ChevronDown size={18} style={{ color: darkTheme.colors.mutedText }} />}
              </button>
              
              {expandedSections.info && (
                <div className="p-3 space-y-3">
                  {/* Source URL */}
                  <div className="text-sm">
                    <span className="block mb-1" style={{ color: darkTheme.colors.mutedText }}>Source URL:</span>
                    <a 
                      href={selectedJob.sourceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline break-all text-sm"
                      style={{ color: darkTheme.colors.accent }}
                    >
                      {selectedJob.sourceUrl}
                    </a>
                  </div>
                  
                  {/* Stats Grid - Responsive for mobile (Requirement 8.1) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span style={{ color: darkTheme.colors.mutedText }}>Status:</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${getStatusColor(selectedJob.status)}`}>
                        {getStatusIcon(selectedJob.status)}
                        {selectedJob.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span style={{ color: darkTheme.colors.mutedText }}>Books Extracted:</span>
                      <span className="font-medium" style={{ color: darkTheme.colors.primaryText }}>{selectedJob.booksExtracted}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span style={{ color: darkTheme.colors.mutedText }}>Errors:</span>
                      <span className="font-medium text-red-400">{selectedJob.errorCount}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span style={{ color: darkTheme.colors.mutedText }}>Limits:</span>
                      <span style={{ color: darkTheme.colors.primaryText }}>{selectedJob.maxTimeMinutes}min / {selectedJob.maxBooks} books</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span style={{ color: darkTheme.colors.mutedText }}>Created:</span>
                      <span className="text-xs sm:text-sm" style={{ color: darkTheme.colors.primaryText }}>{new Date(selectedJob.createdAt).toLocaleString()}</span>
                    </div>
                    {selectedJob.startedAt && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                        <span style={{ color: darkTheme.colors.mutedText }}>Started:</span>
                        <span className="text-xs sm:text-sm" style={{ color: darkTheme.colors.primaryText }}>{new Date(selectedJob.startedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {selectedJob.completedAt && (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                          <span style={{ color: darkTheme.colors.mutedText }}>Completed:</span>
                          <span className="text-xs sm:text-sm" style={{ color: darkTheme.colors.primaryText }}>{new Date(selectedJob.completedAt).toLocaleString()}</span>
                        </div>
                        {selectedJob.startedAt && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span style={{ color: darkTheme.colors.mutedText }}>Duration:</span>
                            <span style={{ color: darkTheme.colors.primaryText }}>
                              {formatDuration(
                                Math.floor((new Date(selectedJob.completedAt).getTime() - new Date(selectedJob.startedAt).getTime()) / 1000)
                              )}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Extracted Books Section - Collapsible (Requirement 8.5) */}
            {extractedBooks.length > 0 && (
              <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${darkTheme.colors.logoAccent}40` }}>
                <button
                  onClick={() => toggleSection('books')}
                  className="w-full p-3 flex items-center justify-between text-left min-h-[44px] touch-manipulation"
                  style={{ backgroundColor: darkTheme.colors.primaryBg }}
                  aria-expanded={expandedSections.books}
                >
                  <span className="font-medium text-sm" style={{ color: darkTheme.colors.primaryText }}>
                    Extracted Books ({extractedBooks.length})
                  </span>
                  {expandedSections.books ? <ChevronUp size={18} style={{ color: darkTheme.colors.mutedText }} /> : <ChevronDown size={18} style={{ color: darkTheme.colors.mutedText }} />}
                </button>
                
                {expandedSections.books && (
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {extractedBooks.map((book) => (
                      <div 
                        key={book.id} 
                        className="flex items-start gap-3 p-2 rounded-lg"
                        style={{ backgroundColor: darkTheme.colors.primaryBg }}
                      >
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded shadow-sm shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2" style={{ color: darkTheme.colors.primaryText }}>{book.title}</p>
                          <p className="text-xs truncate" style={{ color: darkTheme.colors.mutedText }}>{book.author}</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                            book.status === 'completed' || book.status === 'published'
                              ? 'bg-green-900/50 text-green-400'
                              : book.status === 'failed'
                              ? 'bg-red-900/50 text-red-400'
                              : 'bg-blue-900/50 text-blue-400'
                          }`}>
                            {book.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Logs Section - Collapsible (Requirement 8.5) */}
            {logs.length > 0 && (
              <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${darkTheme.colors.logoAccent}40` }}>
                <button
                  onClick={() => toggleSection('logs')}
                  className="w-full p-3 flex items-center justify-between text-left min-h-[44px] touch-manipulation"
                  style={{ backgroundColor: darkTheme.colors.primaryBg }}
                  aria-expanded={expandedSections.logs}
                >
                  <span className="font-medium text-sm" style={{ color: darkTheme.colors.primaryText }}>
                    Recent Logs ({logs.length})
                  </span>
                  {expandedSections.logs ? <ChevronUp size={18} style={{ color: darkTheme.colors.mutedText }} /> : <ChevronDown size={18} style={{ color: darkTheme.colors.mutedText }} />}
                </button>
                
                {expandedSections.logs && (
                  <div 
                    className="p-3 space-y-1 max-h-48 overflow-y-auto font-mono text-xs"
                    style={{ backgroundColor: darkTheme.colors.primaryBg }}
                  >
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`break-all ${
                          log.level === 'error'
                            ? 'text-red-400'
                            : log.level === 'warning'
                            ? 'text-yellow-400'
                            : ''
                        }`}
                        style={{ color: log.level !== 'error' && log.level !== 'warning' ? darkTheme.colors.primaryText : undefined }}
                      >
                        <span style={{ color: darkTheme.colors.mutedText }}>[{new Date(log.createdAt).toLocaleTimeString()}]</span>{' '}
                        <span style={{ color: darkTheme.colors.logoAccent }}>[{log.level.toUpperCase()}]</span>{' '}
                        {log.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractionPanel;
