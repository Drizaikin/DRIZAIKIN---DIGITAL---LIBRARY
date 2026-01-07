import React from 'react';
import { Mail, Heart, Sparkles, BookOpen } from 'lucide-react';
import { useAppTheme } from '../hooks/useAppTheme';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const theme = useAppTheme();

  return (
    <footer 
      className="py-6 mt-auto mb-16 lg:mb-0"
      style={{ 
        backgroundColor: theme.colors.secondarySurface,
        borderTop: `1px solid ${theme.colors.logoAccent}30`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand & Copyright */}
          <div className="text-center md:text-left flex items-center gap-3">
            <img 
              src="/assets/logo-icon.png" 
              alt="DRIZAIKN" 
              className="h-8 w-8 object-contain"
            />
            <div>
              <p 
                className="text-sm font-bold tracking-widest uppercase"
                style={{ color: theme.colors.primaryText }}
              >
                DRIZAIKN
              </p>
              <p 
                className="text-xs mt-0.5"
                style={{ color: theme.colors.mutedText }}
              >
                © {currentYear} All rights reserved.
              </p>
            </div>
          </div>

          {/* Built with AI Badge */}
          <div 
            className="flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm"
            style={{ 
              background: `linear-gradient(to right, ${theme.colors.accent}20, ${theme.colors.accent}10)`,
              border: `1px solid ${theme.colors.accent}30`,
            }}
          >
            <Sparkles size={16} style={{ color: theme.colors.accent }} />
            <span 
              className="text-sm font-medium"
              style={{ color: theme.colors.accent }}
            >
              Architect of Knowledge
            </span>
          </div>

          {/* Developer Contact */}
          <div className="text-center md:text-right">
            <p 
              className="text-xs flex items-center justify-center md:justify-end gap-1"
              style={{ color: theme.colors.mutedText }}
            >
              Crafted with <Heart size={12} className="text-pink-400 fill-pink-400 animate-pulse" /> by
            </p>
            <a 
              href="mailto:danotyanga@gmail.com" 
              className="text-sm transition-colors flex items-center justify-center md:justify-end gap-1 mt-1 hover:opacity-80"
              style={{ color: theme.colors.accent }}
            >
              <Mail size={14} />
              danotyanga@gmail.com
            </a>
          </div>
        </div>

        {/* Bottom line */}
        <div 
          className="mt-4 pt-4 text-center"
          style={{ borderTop: `1px solid ${theme.colors.logoAccent}30` }}
        >
          <p 
            className="text-[10px] flex items-center justify-center gap-2"
            style={{ color: theme.colors.mutedText }}
          >
            <BookOpen size={12} style={{ color: `${theme.colors.accent}50` }} />
            Drizaikn Digital Library v2.0 | Empowering Knowledge, Transforming Lives
            <BookOpen size={12} style={{ color: `${theme.colors.accent}50` }} />
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
