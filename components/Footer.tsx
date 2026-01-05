import React from 'react';
import { Mail, Heart, Sparkles, BookOpen } from 'lucide-react';

// Drizaikn Logo SVG Component - Small version for footer
const DrizaiknLogoSmall: React.FC<{ className?: string }> = ({ className = "h-6 w-6" }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="footerLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="50%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#e2e8f0" />
      </linearGradient>
    </defs>
    {/* Left D shape */}
    <path 
      d="M15 15 L15 85 L40 85 L40 70 L30 70 L30 30 L40 30 L40 15 Z" 
      fill="url(#footerLogoGradient)"
    />
    <path 
      d="M40 15 L40 30 L45 30 Q55 30 55 50 Q55 70 45 70 L40 70 L40 85 L50 85 Q75 85 75 50 Q75 15 50 15 Z" 
      fill="url(#footerLogoGradient)"
    />
    {/* Right D shape - mirrored */}
    <path 
      d="M85 15 L85 85 L60 85 L60 70 L70 70 L70 30 L60 30 L60 15 Z" 
      fill="url(#footerLogoGradient)"
      opacity="0.6"
    />
    <path 
      d="M60 15 L60 30 L55 30 Q45 30 45 50 Q45 70 55 70 L60 70 L60 85 L50 85 Q25 85 25 50 Q25 15 50 15 Z" 
      fill="url(#footerLogoGradient)"
      opacity="0.6"
    />
  </svg>
);

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-6 mt-auto mb-16 lg:mb-0">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand & Copyright */}
          <div className="text-center md:text-left flex items-center gap-3">
            <DrizaiknLogoSmall className="h-8 w-8" />
            <div>
              <p className="text-sm font-bold text-slate-300 tracking-widest uppercase">
                DRIZAIKN
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                © {currentYear} All rights reserved.
              </p>
            </div>
          </div>

          {/* Built with AI Badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-full border border-indigo-500/30 backdrop-blur-sm">
            <Sparkles size={16} className="text-indigo-400" />
            <span className="text-sm font-medium text-indigo-300">Architect of Knowledge</span>
          </div>

          {/* Developer Contact */}
          <div className="text-center md:text-right">
            <p className="text-xs text-slate-400 flex items-center justify-center md:justify-end gap-1">
              Crafted with <Heart size={12} className="text-pink-400 fill-pink-400 animate-pulse" /> by
            </p>
            <a 
              href="mailto:danotyanga@gmail.com" 
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center md:justify-end gap-1 mt-1"
            >
              <Mail size={14} />
              danotyanga@gmail.com
            </a>
          </div>
        </div>

        {/* Bottom line */}
        <div className="mt-4 pt-4 border-t border-slate-700/50 text-center">
          <p className="text-[10px] text-slate-500 flex items-center justify-center gap-2">
            <BookOpen size={12} className="text-indigo-500/50" />
            Drizaikn Digital Library v2.0 | Empowering Knowledge, Transforming Lives
            <BookOpen size={12} className="text-purple-500/50" />
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
