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
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'paused':
        return 'bg-yellow-100 text-yellow-700';
      case 'stopped':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-slate-100 text-slate-700';
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
        <div className="h-8 w-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`fixed top-20 md:top-24 right-4 left-4 md:left-auto px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 text-sm ${
          message.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
        }`}>
          {message.type === 'error' && <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Header with Create Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-indigo-600">AI Book Extraction</h3>
          <p className="text-sm text-slate-500">Automatically extract PDF books from websites</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-blue-800 transition-colors w-full sm:w-auto justify-center"
        >
          <Plus size={16} />
          New Extraction Job
        </button>
      </div>

      {/* Create Job Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-indigo-600 mb-4">Create Extraction Job</h3>
            
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Source URL *
                </label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://example.com/books"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Enter the URL to crawl for PDF files
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useDefaults"
                  checked={useDefaults}
                  onChange={(e) => setUseDefaults(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600/20"
                />
                <label htmlFor="useDefaults" className="text-sm text-slate-700">
                  Use default limits (60 minutes, 100 books)
                </label>
              </div>

              {!useDefaults && (
                <div className="space-y-3 pl-6 border-l-2 border-slate-200">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Max Time (minutes)
                    </label>
                    <input
                      type="number"
                      value={maxTimeMinutes}
                      onChange={(e) => setMaxTimeMinutes(parseInt(e.target.value) || 60)}
                      min="1"
                      max="1440"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Max Books
                    </label>
                    <input
                      type="number"
                      value={maxBooks}
                      onChange={(e) => setMaxBooks(parseInt(e.target.value) || 100)}
                      min="1"
                      max="1000"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-blue-800 transition-colors"
                >
                  Create Job
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Job List - Card-based layout for mobile (Requirement 8.4) */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h4 className="font-semibold text-slate-700 flex items-center gap-2">
            <FileText size={16} />
            Extraction Jobs
          </h4>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <FileText size={48} className="mx-auto mb-3 text-slate-300" />
            <p>No extraction jobs yet</p>
            <p className="text-sm mt-1">Create your first job to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 hover:bg-slate-50/50 transition-colors"
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
                      <span className="text-xs text-slate-500 font-medium">
                        {progress.booksExtracted} / {progress.maxBooks} books
                      </span>
                    )}
                  </div>
                  
                  {/* URL - Truncated for mobile */}
                  <p className="text-sm font-medium text-slate-700 break-all line-clamp-2">
                    {job.sourceUrl}
                  </p>
                  
                  {/* Stats Grid - Responsive layout */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-slate-600">Books:</span> {job.booksExtracted}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-slate-600">Errors:</span> {job.errorCount}
                    </span>
                    <span className="flex items-center gap-1 col-span-2 sm:col-span-1">
                      <span className="font-medium text-slate-600">Limit:</span> {job.maxTimeMinutes}min / {job.maxBooks} books
                    </span>
                    <span className="flex items-center gap-1 col-span-2 sm:col-span-1">
                      <span className="font-medium text-slate-600">Created:</span> {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Action Buttons - Touch-friendly 44x44px minimum (Requirement 8.3) */}
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
                    {job.status === 'pending' && (
                      <button
                        onClick={() => handleStartJob(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        title="Start Job"
                        aria-label="Start Job"
                      >
                        <Play size={20} />
                      </button>
                    )}
                    
                    {job.status === 'running' && (
                      <button
                        onClick={() => handlePauseJob(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        title="Pause Job"
                        aria-label="Pause Job"
                      >
                        <Pause size={20} />
                      </button>
                    )}
                    
                    {job.status === 'paused' && (
                      <button
                        onClick={() => handleResumeJob(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        title="Resume Job"
                        aria-label="Resume Job"
                      >
                        <Play size={20} />
                      </button>
                    )}
                    
                    {(job.status === 'running' || job.status === 'paused') && (
                      <button
                        onClick={() => handleStopJob(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        title="Stop Job"
                        aria-label="Stop Job"
                      >
                        <Square size={20} />
                      </button>
                    )}
                    
                    {(job.status === 'failed' || job.status === 'stopped' || job.status === 'completed') && (
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                        title="Delete Job"
                        aria-label="Delete Job"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleViewJobDetails(job)}
                      className="min-w-[44px] min-h-[44px] p-2.5 text-indigo-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
                      title="View Details"
                      aria-label="View Details"
                    >
                      <ExternalLink size={20} />
                    </button>
                    
                    {job.status === 'running' && (
                      <button
                        onClick={() => updateJobProgress(job.id)}
                        className="min-w-[44px] min-h-[44px] p-2.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
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
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:justify-between text-xs text-slate-600 mb-2 gap-1">
                      <span className="font-medium">Progress: {Math.round((progress.booksExtracted / progress.maxBooks) * 100)}%</span>
                      <span className="text-slate-500">
                        Elapsed: {formatDuration(progress.elapsedSeconds)}
                        {progress.estimatedRemainingSeconds > 0 && (
                          <> • ETA: {formatDuration(progress.estimatedRemainingSeconds)}</>
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 touch-manipulation">
                      <div
                        className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((progress.booksExtracted / progress.maxBooks) * 100, 100)}%` }}
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
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-semibold text-slate-700">Job Details</h4>
            <button
              onClick={() => setSelectedJob(null)}
              className="min-w-[44px] min-h-[44px] p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center touch-manipulation"
              aria-label="Close details"
            >
              <XCircle size={20} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Job Info Section - Collapsible on mobile (Requirement 8.5) */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('info')}
                className="w-full p-3 bg-slate-50 flex items-center justify-between text-left min-h-[44px] touch-manipulation"
                aria-expanded={expandedSections.info}
              >
                <span className="font-medium text-slate-700 text-sm">Job Information</span>
                {expandedSections.info ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              
              {expandedSections.info && (
                <div className="p-3 space-y-3">
                  {/* Source URL */}
                  <div className="text-sm">
                    <span className="text-slate-500 block mb-1">Source URL:</span>
                    <a 
                      href={selectedJob.sourceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline break-all text-sm"
                    >
                      {selectedJob.sourceUrl}
                    </a>
                  </div>
                  
                  {/* Stats Grid - Responsive for mobile (Requirement 8.1) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span className="text-slate-500">Status:</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${getStatusColor(selectedJob.status)}`}>
                        {getStatusIcon(selectedJob.status)}
                        {selectedJob.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span className="text-slate-500">Books Extracted:</span>
                      <span className="font-medium text-slate-700">{selectedJob.booksExtracted}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span className="text-slate-500">Errors:</span>
                      <span className="font-medium text-red-600">{selectedJob.errorCount}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span className="text-slate-500">Limits:</span>
                      <span className="text-slate-700">{selectedJob.maxTimeMinutes}min / {selectedJob.maxBooks} books</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span className="text-slate-500">Created:</span>
                      <span className="text-slate-700 text-xs sm:text-sm">{new Date(selectedJob.createdAt).toLocaleString()}</span>
                    </div>
                    {selectedJob.startedAt && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                        <span className="text-slate-500">Started:</span>
                        <span className="text-slate-700 text-xs sm:text-sm">{new Date(selectedJob.startedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {selectedJob.completedAt && (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                          <span className="text-slate-500">Completed:</span>
                          <span className="text-slate-700 text-xs sm:text-sm">{new Date(selectedJob.completedAt).toLocaleString()}</span>
                        </div>
                        {selectedJob.startedAt && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="text-slate-500">Duration:</span>
                            <span className="text-slate-700">
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
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('books')}
                  className="w-full p-3 bg-slate-50 flex items-center justify-between text-left min-h-[44px] touch-manipulation"
                  aria-expanded={expandedSections.books}
                >
                  <span className="font-medium text-slate-700 text-sm">
                    Extracted Books ({extractedBooks.length})
                  </span>
                  {expandedSections.books ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                
                {expandedSections.books && (
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {extractedBooks.map((book) => (
                      <div key={book.id} className="flex items-start gap-3 p-2 bg-slate-50 rounded-lg">
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded shadow-sm shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 line-clamp-2">{book.title}</p>
                          <p className="text-xs text-slate-500 truncate">{book.author}</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                            book.status === 'completed' || book.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : book.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
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
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('logs')}
                  className="w-full p-3 bg-slate-50 flex items-center justify-between text-left min-h-[44px] touch-manipulation"
                  aria-expanded={expandedSections.logs}
                >
                  <span className="font-medium text-slate-700 text-sm">
                    Recent Logs ({logs.length})
                  </span>
                  {expandedSections.logs ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                
                {expandedSections.logs && (
                  <div className="p-3 space-y-1 max-h-48 overflow-y-auto bg-slate-900 font-mono text-xs">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`break-all ${
                          log.level === 'error'
                            ? 'text-red-400'
                            : log.level === 'warning'
                            ? 'text-yellow-400'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="text-slate-500">[{new Date(log.createdAt).toLocaleTimeString()}]</span>{' '}
                        <span className="text-slate-400">[{log.level.toUpperCase()}]</span>{' '}
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
