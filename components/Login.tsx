import React, { useState } from 'react';
import { User, Lock, ArrowRight, GraduationCap, Briefcase, BookOpen, ArrowLeft, CheckCircle, Shield, HelpCircle, Eye, EyeOff } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface LoginProps {
  onLogin: (admissionNo: string, password?: string, loginAs?: 'student' | 'lecturer' | 'admin') => Promise<void>;
  onSwitchToRegister: () => void;
}

type LoginRole = 'student' | 'lecturer' | 'admin';
type RecoveryStep = 'enter-id' | 'answer-questions' | 'reset-password';

const Login: React.FC<LoginProps> = ({ onLogin, onSwitchToRegister }) => {
  const [admissionNo, setAdmissionNo] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<LoginRole>('student');
  const [validationError, setValidationError] = useState('');
  
  // Security question login states
  const [showSecurityLogin, setShowSecurityLogin] = useState(false);
  const [securityAdmissionNo, setSecurityAdmissionNo] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState<{ q1: string; q2: string } | null>(null);
  const [securityAnswer1, setSecurityAnswer1] = useState('');
  const [securityAnswer2, setSecurityAnswer2] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [securityStep, setSecurityStep] = useState<'fetch' | 'answer'>('fetch');
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('enter-id');
  const [resetAdmissionNo, setResetAdmissionNo] = useState('');
  const [resetQuestions, setResetQuestions] = useState<{ q1: string; q2: string } | null>(null);
  const [resetAnswer1, setResetAnswer1] = useState('');
  const [resetAnswer2, setResetAnswer2] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAdmissionNoChange = (value: string) => {
    setAdmissionNo(value);
    setValidationError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionNo || !password) return;
    
    setIsLoading(true);
    setValidationError('');
    try {
      await onLogin(admissionNo, password, selectedRole);
    } catch (error: any) {
      if (error.message && error.message.includes('library staff account')) {
        setValidationError('⚠️ Access Denied: This is a library staff account. Please select "Library Staff" to login.');
      } else if (error.message && error.message.includes('lecturer account')) {
        setValidationError('⚠️ Access Denied: This is a lecturer account. Please select "Lecturer" to login.');
      } else if (error.message && error.message.includes('student account')) {
        setValidationError('⚠️ Access Denied: This is a student account. Please select "Student" to login.');
      } else {
        setValidationError(error.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch security questions for login
  const fetchSecurityQuestionsForLogin = async () => {
    if (!securityAdmissionNo) {
      setSecurityMessage({ type: 'error', text: 'Please enter your admission number.' });
      return;
    }
    setSecurityLoading(true);
    setSecurityMessage(null);
    try {
      const response = await fetch(`${API_URL}/auth/security-questions/${encodeURIComponent(securityAdmissionNo)}`);
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
          admissionNo: securityAdmissionNo,
          answer1: securityAnswer1,
          answer2: securityAnswer2,
          loginAs: selectedRole
        })
      });
      const data = await response.json();
      if (response.ok) {
        sessionStorage.setItem('drizaikn_user', JSON.stringify(data.user));
        localStorage.removeItem('drizaikn_user'); // Clear old localStorage data
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
    if (!resetAdmissionNo) {
      setResetMessage({ type: 'error', text: 'Please enter your admission number.' });
      return;
    }
    setResetLoading(true);
    setResetMessage(null);
    try {
      const response = await fetch(`${API_URL}/auth/security-questions/${encodeURIComponent(resetAdmissionNo)}`);
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
          admissionNo: resetAdmissionNo,
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
          admissionNo: resetAdmissionNo,
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
    setResetAdmissionNo('');
    setResetQuestions(null);
    setResetAnswer1('');
    setResetAnswer2('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetMessage(null);
  };

  const resetSecurityLoginState = () => {
    setSecurityStep('fetch');
    setSecurityAdmissionNo('');
    setSecurityQuestions(null);
    setSecurityAnswer1('');
    setSecurityAnswer2('');
    setSecurityMessage(null);
  };


  // Security Question Login Modal
  if (showSecurityLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 animate-fade-in-up relative">
        <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl border-white/40 relative">
          <button 
            onClick={() => { setShowSecurityLogin(false); resetSecurityLoginState(); }}
            className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Login
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex justify-center items-center w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full mb-4 shadow-inner">
              <Shield size={28} className="text-green-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-indigo-600">Login with Security Questions</h1>
            <p className="text-slate-500 text-sm mt-1">Answer your security questions to login</p>
          </div>

          {securityMessage && (
            <div className={`p-3 rounded-lg flex items-start gap-2 mb-4 ${
              securityMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {securityMessage.type === 'success' && <CheckCircle size={18} className="text-green-600 mt-0.5" />}
              <p className={`text-sm ${securityMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {securityMessage.text}
              </p>
            </div>
          )}

          {securityStep === 'fetch' ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Admission Number / Staff ID</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={securityAdmissionNo}
                    onChange={(e) => setSecurityAdmissionNo(e.target.value)}
                    placeholder="Enter your ID"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white/50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all uppercase"
                  />
                </div>
              </div>
              <button
                onClick={fetchSecurityQuestionsForLogin}
                disabled={securityLoading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {securityLoading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Continue <ArrowRight size={18} /></>}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSecurityLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <HelpCircle size={14} /> {securityQuestions?.q1}
                </label>
                <input
                  type="text"
                  value={securityAnswer1}
                  onChange={(e) => setSecurityAnswer1(e.target.value)}
                  placeholder="Your answer"
                  className="block w-full px-3 py-2.5 bg-white/50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <HelpCircle size={14} /> {securityQuestions?.q2}
                </label>
                <input
                  type="text"
                  value={securityAnswer2}
                  onChange={(e) => setSecurityAnswer2(e.target.value)}
                  placeholder="Your answer"
                  className="block w-full px-3 py-2.5 bg-white/50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={securityLoading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {securityLoading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Login <ArrowRight size={18} /></>}
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
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 animate-fade-in-up relative">
        <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl border-white/40 relative">
          <button 
            onClick={() => { setShowForgotPassword(false); resetForgotPasswordState(); }}
            className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Login
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex justify-center items-center w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full mb-4 shadow-inner">
              <Lock size={28} className="text-amber-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-indigo-600">Reset Password</h1>
            <p className="text-slate-500 text-sm mt-1">
              {recoveryStep === 'enter-id' && 'Enter your admission number to continue'}
              {recoveryStep === 'answer-questions' && 'Answer your security questions'}
              {recoveryStep === 'reset-password' && 'Create a new password'}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {['enter-id', 'answer-questions', 'reset-password'].map((step, i) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  recoveryStep === step ? 'bg-indigo-600 text-white' : 
                  ['enter-id', 'answer-questions', 'reset-password'].indexOf(recoveryStep) > i ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}>{i + 1}</div>
                {i < 2 && <div className={`w-8 h-1 ${['enter-id', 'answer-questions', 'reset-password'].indexOf(recoveryStep) > i ? 'bg-green-500' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>

          {resetMessage && (
            <div className={`p-3 rounded-lg flex items-start gap-2 mb-4 ${
              resetMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {resetMessage.type === 'success' && <CheckCircle size={18} className="text-green-600 mt-0.5" />}
              <p className={`text-sm ${resetMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {resetMessage.text}
              </p>
            </div>
          )}

          {recoveryStep === 'enter-id' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Admission Number / Staff ID</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={resetAdmissionNo}
                    onChange={(e) => setResetAdmissionNo(e.target.value)}
                    placeholder="Enter your ID"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white/50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all uppercase"
                  />
                </div>
              </div>
              <button
                onClick={fetchSecurityQuestionsForReset}
                disabled={resetLoading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {resetLoading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Continue <ArrowRight size={18} /></>}
              </button>
            </div>
          )}

          {recoveryStep === 'answer-questions' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <HelpCircle size={14} /> {resetQuestions?.q1}
                </label>
                <input
                  type="text"
                  value={resetAnswer1}
                  onChange={(e) => setResetAnswer1(e.target.value)}
                  placeholder="Your answer"
                  className="block w-full px-3 py-2.5 bg-white/50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <HelpCircle size={14} /> {resetQuestions?.q2}
                </label>
                <input
                  type="text"
                  value={resetAnswer2}
                  onChange={(e) => setResetAnswer2(e.target.value)}
                  placeholder="Your answer"
                  className="block w-full px-3 py-2.5 bg-white/50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                />
              </div>
              <button
                onClick={verifySecurityAnswers}
                disabled={resetLoading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {resetLoading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Verify Answers <ArrowRight size={18} /></>}
              </button>
            </div>
          )}

          {recoveryStep === 'reset-password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">New Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400" />
                  </div>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="block w-full pl-10 pr-10 py-2.5 bg-white/50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                    required
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Confirm New Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white/50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {resetLoading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Reset Password <CheckCircle size={18} /></>}
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
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#475569" />
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
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 animate-fade-in-up relative overflow-hidden"
         style={{
           background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4c1d95 50%, #6d28d9 75%, #7c3aed 100%)'
         }}>
      {/* Modern geometric background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-violet-500/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
      </div>
      
      {/* Floating geometric shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-20 h-20 border border-white/10 rounded-2xl rotate-12 animate-pulse" />
        <div className="absolute top-40 right-20 w-16 h-16 border border-white/10 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-1/4 w-24 h-24 border border-white/10 rounded-3xl -rotate-12 animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 right-10 w-12 h-12 border border-white/10 rounded-xl rotate-45 animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
      
      <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/20 relative backdrop-blur-xl bg-white/95">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex justify-center items-center w-28 h-28 sm:w-36 sm:h-36 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 rounded-3xl mb-4 shadow-lg shadow-slate-200/50 relative">
            <DrizaiknLogo className="h-16 w-16 sm:h-20 sm:w-20" />
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-600/5 rounded-3xl" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-700 tracking-widest uppercase">DRIZAIKN</h1>
          <p className="text-slate-400 text-xs mt-1 tracking-wider uppercase">Architect of Knowledge</p>
        </div>

        {/* Role Selection */}
        <div className="mb-5 sm:mb-6">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 block">I am a:</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedRole('student')}
              className={`p-2 sm:p-3 rounded-2xl border-2 transition-all ${
                selectedRole === 'student' ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-100' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <div className={`p-1.5 sm:p-2 rounded-xl ${selectedRole === 'student' ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <GraduationCap size={18} />
                </div>
                <span className={`font-semibold text-[10px] sm:text-xs ${selectedRole === 'student' ? 'text-indigo-600' : 'text-slate-600'}`}>Student</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('lecturer')}
              className={`p-2 sm:p-3 rounded-2xl border-2 transition-all ${
                selectedRole === 'lecturer' ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <div className={`p-1.5 sm:p-2 rounded-xl ${selectedRole === 'lecturer' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <BookOpen size={18} />
                </div>
                <span className={`font-semibold text-[10px] sm:text-xs ${selectedRole === 'lecturer' ? 'text-emerald-600' : 'text-slate-600'}`}>Lecturer</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('admin')}
              className={`p-2 sm:p-3 rounded-2xl border-2 transition-all ${
                selectedRole === 'admin' ? 'border-amber-500 bg-amber-50 shadow-lg shadow-amber-100' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-2">
                <div className={`p-1.5 sm:p-2 rounded-xl ${selectedRole === 'admin' ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <Briefcase size={18} />
                </div>
                <span className={`font-semibold text-[10px] sm:text-xs ${selectedRole === 'admin' ? 'text-amber-600' : 'text-slate-600'}`}>Staff</span>
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700">{validationError}</p>
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {selectedRole === 'student' ? 'Admission Number' : selectedRole === 'lecturer' ? 'Staff ID' : 'Employee ID'}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <input
                type="text"
                value={admissionNo}
                onChange={(e) => handleAdmissionNoChange(e.target.value)}
                placeholder={selectedRole === 'student' ? 'Enter admission number' : selectedRole === 'lecturer' ? 'LEC-001' : 'LIB-STAFF-001'}
                className="block w-full pl-10 pr-3 py-2.5 bg-white/50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all uppercase"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Password</label>
              <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-indigo-600 hover:text-purple-600 hover:underline transition-colors">
                Forgot Password?
              </button>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full pl-10 pr-3 py-2.5 bg-white/50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed ${
              selectedRole === 'admin' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-200' :
              selectedRole === 'lecturer' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200' :
              'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-indigo-200'
            }`}
          >
            {isLoading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
              <>{selectedRole === 'admin' ? 'Access Admin Panel' : selectedRole === 'lecturer' ? 'Access Portal' : 'Log In'} <ArrowRight size={18} /></>
            )}
          </button>
        </form>

        {/* Alternative login option */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowSecurityLogin(true)}
            className="text-xs text-slate-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            <Shield size={14} /> Login with Security Questions
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-200/60 text-center">
          {selectedRole === 'student' ? (
            <p className="text-slate-500 text-sm">
              New student?{' '}
              <button onClick={onSwitchToRegister} className="text-indigo-600 font-semibold hover:underline hover:text-purple-600 transition-colors">
                Create Account
              </button>
            </p>
          ) : (
            <p className="text-slate-500 text-sm">
              {selectedRole === 'lecturer' ? 'Lecturer' : 'Library staff'} accounts are created by the system administrator.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
