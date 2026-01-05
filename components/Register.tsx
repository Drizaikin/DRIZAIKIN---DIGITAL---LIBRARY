import React, { useState, useEffect } from 'react';
import { User, Lock, Mail, CreditCard, ArrowRight, ArrowLeft, GraduationCap, Eye, EyeOff, Shield, HelpCircle } from 'lucide-react';

// Use environment variable or relative path for Vercel deployment
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Security questions options
const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your favorite book?",
  "What was the name of your primary school?",
  "What is your favorite food?",
  "What was your childhood nickname?",
  "What is the name of your best friend?"
];

interface RegisterProps {
  onRegister: (userData: { 
    name: string; 
    admissionNo: string; 
    password?: string; 
    email?: string; 
    course?: string;
    securityQuestion1?: string;
    securityAnswer1?: string;
    securityQuestion2?: string;
    securityAnswer2?: string;
  }) => Promise<void>;
  onSwitchToLogin: () => void;
}

interface Course {
  id: string;
  name: string;
  department: string;
}

const Register: React.FC<RegisterProps> = ({ onRegister, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    admissionNo: '',
    password: '',
    confirmPassword: '',
    course: '',
    securityQuestion1: '',
    securityAnswer1: '',
    securityQuestion2: '',
    securityAnswer2: ''
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Get available questions for second dropdown (exclude first selected)
  const availableQuestionsForQ2 = SECURITY_QUESTIONS.filter(q => q !== formData.securityQuestion1);

  useEffect(() => {
    fetchCourses();
  }, []);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setValidationError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.admissionNo || !formData.password || !formData.confirmPassword) return;

    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match. Please make sure both passwords are identical.');
      return;
    }

    // Validate security questions
    if (!formData.securityQuestion1 || !formData.securityAnswer1 || !formData.securityQuestion2 || !formData.securityAnswer2) {
      setValidationError('Please complete both security questions. They are required for password recovery.');
      return;
    }

    if (formData.securityQuestion1 === formData.securityQuestion2) {
      setValidationError('Please select two different security questions.');
      return;
    }

    setIsLoading(true);
    try {
      await onRegister({
        name: formData.name,
        email: formData.email,
        admissionNo: formData.admissionNo,
        password: formData.password,
        course: formData.course,
        securityQuestion1: formData.securityQuestion1,
        securityAnswer1: formData.securityAnswer1,
        securityQuestion2: formData.securityQuestion2,
        securityAnswer2: formData.securityAnswer2
      });
    } catch (error) {
      // Error handled in parent
    } finally {
      setIsLoading(false);
    }
  };

  // Group courses by department
  const coursesByDepartment = courses.reduce((acc: { [key: string]: Course[] }, course: Course) => {
    const dept = course.department || 'Other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(course);
    return acc;
  }, {} as { [key: string]: Course[] });

  // Drizaikn Logo SVG Component
  const DrizaiknLogo: React.FC<{ className?: string }> = ({ className = "h-16 w-16" }) => (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="regLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="regLogoGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path 
        d="M25 20 L25 80 L55 80 Q80 80 80 50 Q80 20 55 20 Z" 
        stroke="url(#regLogoGradient)" 
        strokeWidth="6" 
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path 
        d="M35 35 L35 65 L50 65 Q65 65 65 50 Q65 35 50 35 Z" 
        stroke="url(#regLogoGradient2)" 
        strokeWidth="4" 
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="20" r="4" fill="url(#regLogoGradient)" />
      <circle cx="25" cy="80" r="4" fill="url(#regLogoGradient)" />
    </svg>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-6 animate-fade-in-up relative overflow-hidden"
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
        <div className="absolute top-20 left-10 w-16 h-16 border border-white/10 rounded-2xl rotate-12 animate-pulse" />
        <div className="absolute top-40 right-20 w-12 h-12 border border-white/10 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-1/4 w-20 h-20 border border-white/10 rounded-3xl -rotate-12 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      
      <div className="glass-panel w-full max-w-md p-4 sm:p-8 rounded-3xl shadow-2xl border border-white/20 backdrop-blur-xl bg-white/95 relative z-10">
        <button 
          onClick={onSwitchToLogin}
          className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 text-sm mb-4 sm:mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Login
        </button>

        <div className="mb-6 sm:mb-8 text-center">
          <div className="inline-flex justify-center items-center w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-indigo-50 via-purple-50 to-violet-50 rounded-2xl mb-4 shadow-lg shadow-indigo-100/50">
            <DrizaiknLogo className="h-12 w-12 sm:h-14 sm:w-14" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600">Student Registration</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Create your account for Drizaikn Digital Library.</p>
          <div className="mt-3 p-2 sm:p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
            <p className="text-[10px] sm:text-xs text-indigo-700">
              <strong>Note:</strong> This registration is for students only. Library staff should contact the system administrator for access.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* Validation Error */}
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700">{validationError}</p>
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase">Full Name</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                <User size={16} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <input
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                className="block w-full pl-8 sm:pl-10 pr-3 py-2 sm:py-2.5 text-sm bg-white/50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase">Personal Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                <Mail size={16} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="student@example.com"
                className="block w-full pl-8 sm:pl-10 pr-3 py-2 sm:py-2.5 text-sm bg-white/50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase">Admission Number</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                <CreditCard size={16} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <input
                name="admissionNo"
                type="text"
                value={formData.admissionNo}
                onChange={handleChange}
                placeholder="Enter admission number"
                className="block w-full pl-8 sm:pl-10 pr-3 py-2 sm:py-2.5 text-sm bg-white/50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase">Course / Major</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none z-10">
                <GraduationCap size={16} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <select
                name="course"
                value={formData.course}
                onChange={handleChange}
                className="block w-full pl-8 sm:pl-10 pr-10 py-2 sm:py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                <option value="">Select course (optional)</option>
                {Object.entries(coursesByDepartment).map(([dept, deptCourses]: [string, Course[]]) => (
                  <optgroup key={dept} label={dept}>
                    {deptCourses.map((course: Course) => (
                      <option key={course.id} value={course.name}>{course.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Helps us recommend relevant books</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                <Lock size={16} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a strong password"
                className="block w-full pl-8 sm:pl-10 pr-10 py-2 sm:py-2.5 text-sm bg-white/50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase">Confirm Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                <Lock size={16} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              </div>
              <input
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                className="block w-full pl-8 sm:pl-10 pr-10 py-2 sm:py-2.5 text-sm bg-white/50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Security Questions Section */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-amber-500" />
              <span className="text-xs font-semibold text-slate-600 uppercase">Security Questions</span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 mb-3">
              These questions will be used to recover your account or login without password.
            </p>

            {/* Security Question 1 */}
            <div className="space-y-1 mb-3">
              <label className="text-xs font-semibold text-slate-600">Question 1</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none z-10">
                  <HelpCircle size={16} className="text-slate-400" />
                </div>
                <select
                  name="securityQuestion1"
                  value={formData.securityQuestion1}
                  onChange={handleChange}
                  className="block w-full pl-8 sm:pl-10 pr-10 py-2 sm:py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                >
                  <option value="">Select a security question</option>
                  {SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <input
                name="securityAnswer1"
                type="text"
                value={formData.securityAnswer1}
                onChange={handleChange}
                placeholder="Your answer"
                className="block w-full px-3 py-2 sm:py-2.5 text-sm bg-white/50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all mt-2"
                required
              />
            </div>

            {/* Security Question 2 */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Question 2</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none z-10">
                  <HelpCircle size={16} className="text-slate-400" />
                </div>
                <select
                  name="securityQuestion2"
                  value={formData.securityQuestion2}
                  onChange={handleChange}
                  className="block w-full pl-8 sm:pl-10 pr-10 py-2 sm:py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                >
                  <option value="">Select a security question</option>
                  {availableQuestionsForQ2.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <input
                name="securityAnswer2"
                type="text"
                value={formData.securityAnswer2}
                onChange={handleChange}
                placeholder="Your answer"
                className="block w-full px-3 py-2 sm:py-2.5 text-sm bg-white/50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all mt-2"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 sm:mt-4 flex items-center justify-center gap-2 py-2.5 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Create Account <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
