import React, { useState } from 'react';
import { User as UserIcon, Mail, BookOpen, Lock, Save, X, Eye, EyeOff, AlertCircle, CheckCircle, History, Trash2 } from 'lucide-react';
import { User } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface UserProfileProps {
  user: User;
  onClose: () => void;
  onUserUpdate: (updatedUser: User) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onClose, onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'privacy'>('profile');
  
  // Profile form state
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || '');
  const [course, setCourse] = useState(user.course || '');
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  
  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Privacy/Search history state
  const [clearingHistory, setClearingHistory] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch courses on mount
  React.useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch(`${API_URL}/courses`);
        if (response.ok) {
          const data = await response.json();
          setCourses(data);
        }
      } catch (err) {
        console.error('Failed to fetch courses:', err);
      }
    };
    fetchCourses();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_URL}/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, course: course || null })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update local user state
      onUserUpdate({
        ...user,
        name: data.user.name,
        email: data.user.email,
        course: data.user.course,
        avatarUrl: data.user.avatarUrl
      });

      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/${user.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  // Clear search history handler (Requirement 5.4)
  const handleClearSearchHistory = async () => {
    setClearingHistory(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_URL}/search-history/${user.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear search history');
      }

      setSuccess('Search history cleared successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to clear search history');
    } finally {
      setClearingHistory(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src={user.avatarUrl} 
                alt={user.name}
                className="w-16 h-16 rounded-full border-3 border-white shadow-lg"
              />
              <div>
                <h2 className="text-xl font-bold">{user.name}</h2>
                <p className="text-white/80 text-sm">{user.admissionNo}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => { setActiveTab('profile'); setError(null); setSuccess(null); }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'profile' 
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserIcon size={18} />
            Profile
          </button>
          <button
            onClick={() => { setActiveTab('password'); setError(null); setSuccess(null); }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'password' 
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Lock size={18} />
            Password
          </button>
          <button
            onClick={() => { setActiveTab('privacy'); setError(null); setSuccess(null); }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'privacy' 
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <History size={18} />
            Privacy
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle size={18} />
              {success}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>

              {/* Course (only for students) */}
              {user.role === 'Student' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Course
                  </label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none bg-white"
                    >
                      <option value="">Select your course</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Admission Number (read-only) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Admission Number
                </label>
                <input
                  type="text"
                  value={user.admissionNo || ''}
                  disabled
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">Admission number cannot be changed</p>
              </div>

              {/* Role (read-only) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  value={user.role}
                  disabled
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Minimum 6 characters</p>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock size={18} />
                    Update Password
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === 'privacy' && (
            /* Privacy Tab - Search History Management */
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Search History</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Your search history is used to provide personalized book recommendations. 
                  You can clear your search history at any time.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <History size={20} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-800">Clear Search History</h4>
                    <p className="text-sm text-slate-500 mt-1">
                      This will remove all your search queries and book views from our records. 
                      Your recommendations may become less personalized.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClearSearchHistory}
                  disabled={clearingHistory}
                  className="mt-4 w-full py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {clearingHistory ? (
                    <div className="h-5 w-5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Clear Search History
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Clearing your search history will not affect your current loans, 
                  favorites, or account settings.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
