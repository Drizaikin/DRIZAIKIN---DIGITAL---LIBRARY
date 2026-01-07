import React, { useState } from 'react';
import { User, Lock, ArrowRight, GraduationCap, Briefcase, BookOpen, ArrowLeft, CheckCircle, Shield, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { useAppTheme } from '../hooks/useAppTheme';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface LoginProps {
  onLogin: (username: string, password?: string, loginAs?: 'reader' | 'premium' | 'admin') => Promise<void>;
  onSwitchToRegister: () => void;
}

type LoginRole = 'reader' | 'premium' | 'admin';
type RecoveryStep = 'enter-id' | 'answer-questions' | 'reset-password';

const Login: React.FC<LoginProps> = ({ onLogin, onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<LoginRole>('reader');
  const [validationError, setValidationError] = useState('');
  
  // Security question login states
  const [showSecurityLogin, setShowSecurityLogin] = useState(false);
  const [securityUsername, setSecurityUsername] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState<{ q1: string; q2: string } | null>(null);
  const [securityAnswer1, setSecurityAnswer1] = useState('');
  const [securityAnswer2, setSecurityAnswer2] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [securityStep, setSecurityStep] = useState<'fetch' | 'answer'>('fetch');
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('enter-id');
  const [resetUsername, setResetUsername] = useState('');
  const [resetQuestions, setResetQuestions] = useState<{ q1: string; q2: string } | null>(null);
  const [resetAnswer1, setResetAnswer1] = useState('');
  const [resetAnswer2, setResetAnswer2] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dark theme colors
  const theme = useAppTheme();
  const colors = theme.colors;

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setValidationError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setIsLoading(true);
    setValidationError('');
    try {
      await onLogin(username, password, selectedRole);
    } catch (error: any) {
      if (error.message && error.message.includes('admin account')) {
        setValidationError('⚠️ Access Denied: This is an admin account. Please select "Admin" to login.');
      } else if (error.message && error.message.includes('premium account')) {
        setValidationError('⚠️ Access Denied: This is a premium account. Please select "Premium" to login.');
      } else if (error.message && error.message.includes('reader account')) {
        setValidationError('⚠️ Access Denied: This is a reader account. Please select "Reader" to login.');
      } else {
        setValidationError(error.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch security questions for login
  const fetchSecurityQuestionsForLogin = async () => {
    if (!securityUsername) {
      setSecurityMessage({ type: 'error', text: 'Please enter your username.' });
      return;
    }
    setSecurityLoading(true);
    setSecurityMessage(null);
    try {
      const response = await fetch(`${API_URL}/auth/security-questions/${encodeURIComponent(securityUsername)}`);
      const data = await response.json();
      if (response.ok && data.questions) {
        setSecurityQuestions({ q1: data.questions.question1, q2: data.questions.question2 });
        setSecurityStep('answer');
      } else {
        setSecurityMessage({ type: 'error', text: data.error || 'Could not fetch security questions.' });
      }
    } catch (err) {
      setSecurityMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSecurityLoading(false);
    }
  };

  // Login with security questions
  const handleSecurityLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityAnswer1 || !securityAnswer2) {
      setSecurityMessage({ type: 'error', text: 'Please answer both security questions.' });
      return;
    }
    setSecurityLoading(true);
    setSecurityMessage(null);
    try {
      const response = await fetch(`${API_URL}/auth/login-security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: securityUsername,
          answer1: securityAnswer1,
          answer2: securityAnswer2,
          loginAs: selectedRole
        })
      });
      const data = await response.json();
      if (response.ok) {
        sessionStorage.setItem('drizaikn_user', JSON.stringify(data.user));
        localStorage.removeItem('drizaikn_user');
        window.location.reload();
      } else {
        setSecurityMessage({ type: 'error', text: data.error || 'Login failed.' });
      }
    } catch (err) {
      setSecurityMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSecurityLoading(false);
    }
  };

  // Fetch security questions for password reset
  const fetchSecurityQuestionsForReset = async () => {
    if (!resetUsername) {
      setResetMessage({ type: 'error', text: 'Please enter your username.' });
      return;
    }
    setResetLoading(true);
    setResetMessage(null);
    try {
      const response = await fetch(`${API_URL}/auth/security-questions/${encodeURIComponent(resetUsername)}`);
      const data = await response.json();
      if (response.ok && data.questions) {
        setResetQuestions({ q1: data.questions.question1, q2: data.questions.question2 });
        setRecoveryStep('answer-questions');
      } else {
        setResetMessage({ type: 'error', text: data.error || 'Could not fetch security questions.' });
      }
    } catch (err) {
      setResetMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setResetLoading(false);
    }
  };

  // Verify security answers for password reset
  const verifySecurityAnswers = async () => {
    if (!resetAnswer1 || !resetAnswer2) {
      setResetMessage({ type: 'error', text: 'Please answer both security questions.' });
      return;
    }
    setResetLoading(true);
    setResetMessage(null);
    try {
      const response = await fetch(`${API_URL}/auth/verify-security-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: resetUsername,
          answer1: resetAnswer1,
          answer2: resetAnswer2
        })
      });
      const data = await response.json();
      if (response.ok && data.verified) {
        setRecoveryStep('reset-password');
      } else {
        setResetMessage({ type: 'error', text: data.error || 'Security answers do not match.' });
      }
    } catch (err) {
      setResetMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setResetLoading(false);
    }
  };

  // Reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setResetMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setResetMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setResetLoading(true);
    setResetMessage(null);
    try {
      const response = await fetch(`${API_URL}/auth/reset-password-security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: resetUsername,
          answer1: resetAnswer1,
          answer2: resetAnswer2,
          newPassword
        })
      });
      const data = await response.json();
      if (response.ok) {
        setResetMessage({ type: 'success', text: 'Password reset successfully! You can now login.' });
        setTimeout(() => {
          setShowForgotPassword(false);
          resetForgotPasswordState();
        }, 2000);
      } else {
        setResetMessage({ type: 'error', text: data.error || 'Failed to reset password.' });
      }
    } catch (err) {
      setResetMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setResetLoading(false);
    }
  };

  const resetForgotPasswordState = () => {
    setRecoveryStep('enter-id');
    setResetUsername('');
    setResetQuestions(null);
    setResetAnswer1('');
    setResetAnswer2('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetMessage(null);
  };

  const resetSecurityLoginState = () => {
    setSecurityStep('fetch');
    setSecurityUsername('');
    setSecurityQuestions(null);
    setSecurityAnswer1('');
    setSecurityAnswer2('');
    setSecurityMessage(null);
  };

  // Dark theme input styles
  const inputStyle: React.CSSProperties = {
    backgroundColor: colors.secondarySurface,
    border: `1px solid ${colors.logoAccent}`,
    borderRadius: theme.borderRadius.input,
    color: colors.primaryText,
  };

  const inputClassName = `block w-full pl-10 pr-3 py-2.5 rounded-lg placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-[${colors.accent}]/30 focus:border-[${colors.accent}] transition-all uppercase`;

  // Security Question Login Modal
  if (showSecurityLogin) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 sm:p-6 animate-fade-in-up relative"
        style={{ backgroundColor: colors.primaryBg }}
      >
        <div 
          className="w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative"
          style={{ 
            backgroundColor: colors.secondarySurface,
            border: `1px solid ${colors.logoAccent}`,
          }}
        >
          <button 
            onClick={() => { setShowSecurityLogin(false); resetSecurityLoginState(); }}
            className="flex items-center gap-1 text-sm mb-6 transition-colors hover:opacity-80"
            style={{ color: colors.mutedText }}
          >
            <ArrowLeft size={16} /> Back to Login
          </button>

          <div className="text-center mb-6">
            <div 
              className="inline-flex justify-center items-center w-16 h-16 rounded-full mb-4"
              style={{ backgroundColor: colors.hoverBg }}
            >
              <Shield size={28} style={{ color: colors.accent }} />
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold" style={{ color: colors.accent }}>
              Login with Security Questions
            </h1>
            <p className="text-sm mt-1" style={{ color: colors.mutedText }}>
              Answer your security questions to login
            </p>
          </div>

          {securityMessage && (
            <div 
              className="p-3 rounded-lg flex items-start gap-2 mb-4"
              style={{ 
                backgroundColor: securityMessage.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${securityMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
              }}
            >
              {securityMessage.type === 'success' && <CheckCircle size={18} className="text-green-500 mt-0.5" />}
              <p className={`text-sm ${securityMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {securityMessage.text}
              </p>
            </div>
          )}

          {securityStep === 'fetch' ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.mutedText }}>
                  Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} style={{ color: colors.mutedText }} />
                  </div>
                  <input
                    type="text"
                    value={securityUsername}
                    onChange={(e) => setSecurityUsername(e.target.value)}
                    placeholder="Enter your username"
                    className={inputClassName}
                    style={{ ...inputStyle, paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>
              <button
                onClick={fetchSecurityQuestionsForLogin}
                disabled={securityLoading}
                className="w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-70"
                style={{ backgroundColor: colors.accent, color: colors.primaryBg }}
              >
                {securityLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Continue <ArrowRight size={18} /></>
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSecurityLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1" style={{ color: colors.mutedText }}>
                  <HelpCircle size={14} /> {securityQuestions?.q1}
                </label>
                <input
                  type="text"
                  value={securityAnswer1}
                  onChange={(e) => setSecurityAnswer1(e.target.value)}
                  placeholder="Your answer"
                  className="block w-full px-3 py-2.5 rounded-lg placeholder:opacity-60 focus:outline-none focus:ring-2 transition-all"
                  style={inputStyle}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1" style={{ color: colors.mutedText }}>
                  <HelpCircle size={14} /> {securityQuestions?.q2}
                </label>
                <input
                  type="text"
                  value={securityAnswer2}
                  onChange={(e) => setSecurityAnswer2(e.target.value)}
                  placeholder="Your answer"
                  className="block w-full px-3 py-2.5 rounded-lg placeholder:opacity-60 focus:outline-none focus:ring-2 transition-all"
                  style={inputStyle}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={securityLoading}
                className="w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-70"
                style={{ backgroundColor: colors.accent, color: colors.primaryBg }}
              >
                {securityLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Login <ArrowRight size={18} /></>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Forgot Password Modal with Security Questions
  if (showForgotPassword) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 sm:p-6 animate-fade-in-up relative"
        style={{ backgroundColor: colors.primaryBg }}
      >
        <div 
          className="w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl relative"
          style={{ 
            backgroundColor: colors.secondarySurface,
            border: `1px solid ${colors.logoAccent}`,
          }}
        >
          <button 
            onClick={() => { setShowForgotPassword(false); resetForgotPasswordState(); }}
            className="flex items-center gap-1 text-sm mb-6 transition-colors hover:opacity-80"
            style={{ color: colors.mutedText }}
          >
            <ArrowLeft size={16} /> Back to Login
          </button>

          <div className="text-center mb-6">
            <div 
              className="inline-flex justify-center items-center w-16 h-16 rounded-full mb-4"
              style={{ backgroundColor: colors.hoverBg }}
            >
              <Lock size={28} style={{ color: colors.accent }} />
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold" style={{ color: colors.accent }}>
              Reset Password
            </h1>
            <p className="text-sm mt-1" style={{ color: colors.mutedText }}>
              {recoveryStep === 'enter-id' && 'Enter your username to continue'}
              {recoveryStep === 'answer-questions' && 'Answer your security questions'}
              {recoveryStep === 'reset-password' && 'Create a new password'}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {['enter-id', 'answer-questions', 'reset-password'].map((step, i) => (
              <div key={step} className="flex items-center">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{
                    backgroundColor: recoveryStep === step ? colors.accent : 
                      ['enter-id', 'answer-questions', 'reset-password'].indexOf(recoveryStep) > i ? '#22c55e' : colors.hoverBg,
                    color: recoveryStep === step || ['enter-id', 'answer-questions', 'reset-password'].indexOf(recoveryStep) > i 
                      ? colors.primaryBg : colors.mutedText,
                  }}
                >
                  {i + 1}
                </div>
                {i < 2 && (
                  <div 
                    className="w-8 h-1"
                    style={{
                      backgroundColor: ['enter-id', 'answer-questions', 'reset-password'].indexOf(recoveryStep) > i 
                        ? '#22c55e' : colors.hoverBg,
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {resetMessage && (
            <div 
              className="p-3 rounded-lg flex items-start gap-2 mb-4"
              style={{ 
                backgroundColor: resetMessage.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${resetMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
              }}
            >
              {resetMessage.type === 'success' && <CheckCircle size={18} className="text-green-500 mt-0.5" />}
              <p className={`text-sm ${resetMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {resetMessage.text}
              </p>
            </div>
          )}

          {recoveryStep === 'enter-id' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.mutedText }}>
                  Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} style={{ color: colors.mutedText }} />
                  </div>
                  <input
                    type="text"
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    placeholder="Enter your username"
                    className={inputClassName}
                    style={{ ...inputStyle, paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>
              <button
                onClick={fetchSecurityQuestionsForReset}
                disabled={resetLoading}
                className="w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-70"
                style={{ backgroundColor: colors.accent, color: colors.primaryBg }}
              >
                {resetLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Continue <ArrowRight size={18} /></>
                )}
              </button>
            </div>
          )}

          {recoveryStep === 'answer-questions' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1" style={{ color: colors.mutedText }}>
                  <HelpCircle size={14} /> {resetQuestions?.q1}
                </label>
                <input
                  type="text"
                  value={resetAnswer1}
                  onChange={(e) => setResetAnswer1(e.target.value)}
                  placeholder="Your answer"
                  className="block w-full px-3 py-2.5 rounded-lg placeholder:opacity-60 focus:outline-none focus:ring-2 transition-all"
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1" style={{ color: colors.mutedText }}>
                  <HelpCircle size={14} /> {resetQuestions?.q2}
                </label>
                <input
                  type="text"
                  value={resetAnswer2}
                  onChange={(e) => setResetAnswer2(e.target.value)}
                  placeholder="Your answer"
                  className="block w-full px-3 py-2.5 rounded-lg placeholder:opacity-60 focus:outline-none focus:ring-2 transition-all"
                  style={inputStyle}
                />
              </div>
              <button
                onClick={verifySecurityAnswers}
                disabled={resetLoading}
                className="w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-70"
                style={{ backgroundColor: colors.accent, color: colors.primaryBg }}
              >
                {resetLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Verify Answers <ArrowRight size={18} /></>
                )}
              </button>
            </div>
          )}

          {recoveryStep === 'reset-password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.mutedText }}>
                  New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} style={{ color: colors.mutedText }} />
                  </div>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="block w-full pl-10 pr-10 py-2.5 rounded-lg placeholder:opacity-60 focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPassword(!showNewPassword)} 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:opacity-80"
                    style={{ color: colors.mutedText }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.mutedText }}>
                  Confirm New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} style={{ color: colors.mutedText }} />
                  </div>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="block w-full pl-10 pr-3 py-2.5 rounded-lg placeholder:opacity-60 focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-70"
                style={{ backgroundColor: colors.accent, color: colors.primaryBg }}
              >
                {resetLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Reset Password <CheckCircle size={18} /></>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Drizaikn Logo SVG Component - Geometric interlocking D design matching brand identity
  const DrizaiknLogo: React.FC<{ className?: string }> = ({ className = "h-20 w-20" }) => (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="loginLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.mutedText} />
          <stop offset="50%" stopColor={colors.logoAccent} />
          <stop offset="100%" stopColor={colors.accent} />
        </linearGradient>
      </defs>
      {/* Left D shape - outer */}
      <path 
        d="M15 15 L15 85 L40 85 L40 70 L30 70 L30 30 L40 30 L40 15 Z" 
        fill="url(#loginLogoGradient)"
      />
      {/* Left D curve */}
      <path 
        d="M40 15 L40 30 L45 30 Q55 30 55 50 Q55 70 45 70 L40 70 L40 85 L50 85 Q75 85 75 50 Q75 15 50 15 Z" 
        fill="url(#loginLogoGradient)"
      />
      {/* Right D shape - mirrored and offset */}
      <path 
        d="M85 15 L85 85 L60 85 L60 70 L70 70 L70 30 L60 30 L60 15 Z" 
        fill="url(#loginLogoGradient)"
        opacity="0.7"
      />
      {/* Right D curve - mirrored */}
      <path 
        d="M60 15 L60 30 L55 30 Q45 30 45 50 Q45 70 55 70 L60 70 L60 85 L50 85 Q25 85 25 50 Q25 15 50 15 Z" 
        fill="url(#loginLogoGradient)"
        opacity="0.7"
      />
    </svg>
  );

  // Main Login Form
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 animate-fade-in-up relative overflow-hidden"
      style={{ backgroundColor: colors.primaryBg }}
    >
      {/* Modern geometric background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-0 w-96 h-96 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"
          style={{ backgroundColor: `${colors.accent}20` }}
        />
        <div 
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"
          style={{ backgroundColor: `${colors.accent}15` }}
        />
        <div 
          className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2"
          style={{ backgroundColor: `${colors.logoAccent}10` }}
        />
      </div>
      
      {/* Floating geometric shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-20 left-10 w-20 h-20 rounded-2xl rotate-12 animate-pulse"
          style={{ border: `1px solid ${colors.logoAccent}20` }}
        />
        <div 
          className="absolute top-40 right-20 w-16 h-16 rounded-full animate-pulse"
          style={{ border: `1px solid ${colors.logoAccent}20`, animationDelay: '1s' }}
        />
        <div 
          className="absolute bottom-32 left-1/4 w-24 h-24 rounded-3xl -rotate-12 animate-pulse"
          style={{ border: `1px solid ${colors.logoAccent}20`, animationDelay: '2s' }}
        />
        <div 
          className="absolute bottom-20 right-10 w-12 h-12 rounded-xl rotate-45 animate-pulse"
          style={{ border: `1px solid ${colors.logoAccent}20`, animationDelay: '0.5s' }}
        />
      </div>
      
      <div 
        className="w-full max-w-md p-6 sm:p-8 rounded-3xl shadow-2xl relative backdrop-blur-xl"
        style={{ 
          backgroundColor: colors.secondarySurface,
          border: `1px solid ${colors.logoAccent}40`,
        }}
      >
        <div className="text-center mb-6 sm:mb-8">
          <div 
            className="inline-flex justify-center items-center w-28 h-28 sm:w-36 sm:h-36 rounded-3xl mb-4 shadow-lg relative"
            style={{ backgroundColor: colors.hoverBg }}
          >
            <DrizaiknLogo className="h-16 w-16 sm:h-20 sm:w-20" />
          </div>
          <h1 
            className="text-xl sm:text-2xl font-bold tracking-widest uppercase"
            style={{ color: colors.primaryText }}
          >
            DRIZAIKN
          </h1>
          <p 
            className="text-xs mt-1 tracking-wider uppercase"
            style={{ color: colors.mutedText }}
          >
            Architect of Knowledge
          </p>
        </div>

        {/* Role Selection */}
        <div className="mb-5 sm:mb-6">
          <label 
            className="text-xs font-semibold uppercase tracking-wider mb-3 block"
            style={{ color: colors.mutedText }}
          >
            I am a:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedRole('reader')}
              className="p-2 sm:p-3 rounded-2xl transition-all"
              style={{
                backgroundColor: selectedRole === 'reader' ? `${colors.accent}20` : colors.hoverBg,
                border: `2px solid ${selectedRole === 'reader' ? colors.accent : colors.logoAccent}40`,
              }}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <div 
                  className="p-1.5 sm:p-2 rounded-xl"
                  style={{ 
                    backgroundColor: selectedRole === 'reader' ? colors.accent : colors.secondarySurface,
                    color: selectedRole === 'reader' ? colors.primaryBg : colors.mutedText,
                  }}
                >
                  <BookOpen size={18} />
                </div>
                <span 
                  className="font-semibold text-[10px] sm:text-xs"
                  style={{ color: selectedRole === 'reader' ? colors.accent : colors.mutedText }}
                >
                  Reader
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('premium')}
              className="p-2 sm:p-3 rounded-2xl transition-all"
              style={{
                backgroundColor: selectedRole === 'premium' ? `${colors.accent}20` : colors.hoverBg,
                border: `2px solid ${selectedRole === 'premium' ? colors.accent : colors.logoAccent}40`,
              }}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <div 
                  className="p-1.5 sm:p-2 rounded-xl"
                  style={{ 
                    backgroundColor: selectedRole === 'premium' ? colors.accent : colors.secondarySurface,
                    color: selectedRole === 'premium' ? colors.primaryBg : colors.mutedText,
                  }}
                >
                  <GraduationCap size={18} />
                </div>
                <span 
                  className="font-semibold text-[10px] sm:text-xs"
                  style={{ color: selectedRole === 'premium' ? colors.accent : colors.mutedText }}
                >
                  Premium
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('admin')}
              className="p-2 sm:p-3 rounded-2xl transition-all"
              style={{
                backgroundColor: selectedRole === 'admin' ? `${colors.accent}20` : colors.hoverBg,
                border: `2px solid ${selectedRole === 'admin' ? colors.accent : colors.logoAccent}40`,
              }}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <div 
                  className="p-1.5 sm:p-2 rounded-xl"
                  style={{ 
                    backgroundColor: selectedRole === 'admin' ? colors.accent : colors.secondarySurface,
                    color: selectedRole === 'admin' ? colors.primaryBg : colors.mutedText,
                  }}
                >
                  <Briefcase size={18} />
                </div>
                <span 
                  className="font-semibold text-[10px] sm:text-xs"
                  style={{ color: selectedRole === 'admin' ? colors.accent : colors.mutedText }}
                >
                  Admin
                </span>
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {validationError && (
            <div 
              className="p-3 rounded-lg"
              style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
              }}
            >
              <p className="text-xs text-red-400">{validationError}</p>
            </div>
          )}
          
          <div className="space-y-1.5">
            <label 
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: colors.mutedText }}
            >
              Username
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} style={{ color: colors.mutedText }} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="Enter your username"
                className="block w-full pl-10 pr-3 py-2.5 rounded-lg placeholder:opacity-50 focus:outline-none focus:ring-2 transition-all"
                style={{ 
                  ...inputStyle,
                  color: colors.primaryText,
                }}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label 
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: colors.mutedText }}
              >
                Password
              </label>
              <button 
                type="button" 
                onClick={() => setShowForgotPassword(true)} 
                className="text-xs hover:underline transition-colors"
                style={{ color: colors.accent }}
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} style={{ color: colors.mutedText }} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full pl-10 pr-3 py-2.5 rounded-lg placeholder:opacity-50 focus:outline-none focus:ring-2 transition-all"
                style={{ 
                  ...inputStyle,
                  color: colors.primaryText,
                }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-xl shadow-lg hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: colors.accent, 
              color: colors.primaryBg,
              boxShadow: `0 4px 14px ${colors.accent}40`,
            }}
          >
            {isLoading ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {selectedRole === 'admin' ? 'Access Admin Panel' : 'Log In'} 
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Alternative login option */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowSecurityLogin(true)}
            className="text-xs transition-colors flex items-center justify-center gap-1 mx-auto hover:opacity-80"
            style={{ color: colors.mutedText }}
          >
            <Shield size={14} /> Login with Security Questions
          </button>
        </div>

        <div 
          className="mt-6 pt-5 text-center"
          style={{ borderTop: `1px solid ${colors.logoAccent}30` }}
        >
          {selectedRole === 'reader' ? (
            <p className="text-sm" style={{ color: colors.mutedText }}>
              New here?{' '}
              <button 
                onClick={onSwitchToRegister} 
                className="font-semibold hover:underline transition-colors"
                style={{ color: colors.accent }}
              >
                Create Account
              </button>
            </p>
          ) : (
            <p className="text-sm" style={{ color: colors.mutedText }}>
              {selectedRole === 'premium' ? 'Premium' : 'Admin'} accounts are created by the system administrator.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
