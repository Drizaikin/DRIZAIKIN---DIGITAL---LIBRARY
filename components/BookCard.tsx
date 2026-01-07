import React from 'react';
import { Book, BookStatus } from '../types';
import { Heart, Clock, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { IconSize } from '../services/preferencesService';
import { ICON_SIZES } from '../constants/themes';
import { useAppTheme } from '../hooks/useAppTheme';

interface BookCardProps {
  book: Book;
  index: number;
  onViewDetails: (book: Book) => void;
  iconSize?: IconSize;
}

// Size-specific configurations for different icon sizes
const SIZE_CONFIG = {
  xs: {
    padding: 'p-2',
    titleSize: 'text-xs',
    textSize: 'text-[9px]',
    badgeSize: 'text-[8px] px-1.5 py-0.5',
    iconSize: 8,
    heartSize: 10,
    showDetails: false,
    showStats: false,
    showCallNumber: false,
  },
  sm: {
    padding: 'p-2 md:p-3',
    titleSize: 'text-xs md:text-sm',
    textSize: 'text-[9px] md:text-xs',
    badgeSize: 'text-[9px] px-1.5 py-0.5',
    iconSize: 9,
    heartSize: 12,
    showDetails: false,
    showStats: false,
    showCallNumber: true,
  },
  md: {
    padding: 'p-3 md:p-4',
    titleSize: 'text-sm md:text-base',
    textSize: 'text-xs md:text-sm',
    badgeSize: 'text-[10px] md:text-xs px-2 py-0.5 md:px-2.5 md:py-1',
    iconSize: 10,
    heartSize: 14,
    showDetails: true,
    showStats: true,
    showCallNumber: true,
  },
  lg: {
    padding: 'p-4 md:p-5',
    titleSize: 'text-base md:text-lg',
    textSize: 'text-sm md:text-base',
    badgeSize: 'text-xs px-2.5 py-1',
    iconSize: 12,
    heartSize: 16,
    showDetails: true,
    showStats: true,
    showCallNumber: true,
  },
  xl: {
    padding: 'p-5 md:p-6',
    titleSize: 'text-lg md:text-xl',
    textSize: 'text-base md:text-lg',
    badgeSize: 'text-sm px-3 py-1.5',
    iconSize: 14,
    heartSize: 18,
    showDetails: true,
    showStats: true,
    showCallNumber: true,
  },
};

const BookCard: React.FC<BookCardProps> = ({ book, index, onViewDetails, iconSize = 'md' }) => {
  const theme = useAppTheme();
  const sizeClasses = ICON_SIZES[iconSize];
  const config = SIZE_CONFIG[iconSize];

  const getStatusColor = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' };
      case BookStatus.WAITLIST: return { bg: 'rgba(251, 191, 36, 0.2)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' };
      case BookStatus.BORROWED: return { bg: 'rgba(139, 148, 158, 0.2)', text: theme.colors.mutedText, border: 'rgba(139, 148, 158, 0.3)' };
    }
  };

  const getStatusIcon = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return <CheckCircle size={config.iconSize} />;
      case BookStatus.WAITLIST: return <Clock size={config.iconSize} />;
      case BookStatus.BORROWED: return <AlertCircle size={config.iconSize} />;
    }
  };

  const statusColors = getStatusColor(book.status);

  return (
    <div 
      onClick={() => onViewDetails(book)}
      className={`group relative rounded-xl overflow-hidden transition-all duration-300 ease-out flex flex-col h-full cursor-pointer ${sizeClasses.card}`}
      style={{ 
        backgroundColor: theme.colors.secondarySurface,
        border: `1px solid ${theme.colors.logoAccent}40`,
        animationDelay: `${index * 50}ms`,
        boxShadow: theme.shadows.card,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = theme.shadows.cardHover;
        e.currentTarget.style.borderColor = `${theme.colors.accent}60`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = theme.shadows.card;
        e.currentTarget.style.borderColor = `${theme.colors.logoAccent}40`;
      }}
    >
      {/* Image Container */}
      <div className={`relative aspect-[2/3] overflow-hidden ${sizeClasses.image}`} style={{ backgroundColor: theme.colors.primaryBg }}>
        <img 
          src={book.coverUrl} 
          alt={book.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div 
          className="absolute inset-0 opacity-40 group-hover:opacity-20 transition-opacity duration-300"
          style={{ background: `linear-gradient(to top, ${theme.colors.primaryBg}, transparent)` }}
        />
        
        {/* Hover Overlay Buttons - Hidden on mobile and small sizes */}
        {(iconSize === 'md' || iconSize === 'lg' || iconSize === 'xl') && (
          <div 
            className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out backdrop-blur-md hidden md:block"
            style={{ backgroundColor: `${theme.colors.secondarySurface}ee` }}
          >
             {book.status === BookStatus.AVAILABLE ? (
               <button 
                 className={`w-full py-2.5 ${config.textSize} font-semibold rounded-lg transition-all flex items-center justify-center gap-2`}
                 style={{ 
                   backgroundColor: theme.colors.accent,
                   color: theme.colors.primaryBg,
                 }}
               >
                 Borrow Now
               </button>
             ) : (
               <button 
                 className={`w-full py-2.5 border ${config.textSize} font-semibold rounded-lg transition-all flex items-center justify-center gap-2`}
                 style={{ 
                   borderColor: '#fbbf24',
                   color: '#fbbf24',
                   backgroundColor: 'transparent',
                 }}
               >
                 Join Waitlist
               </button>
             )}
          </div>
        )}

        <button 
          className="absolute top-2 right-2 md:top-3 md:right-3 p-1.5 md:p-2 rounded-full backdrop-blur-md transition-all"
          style={{ 
            backgroundColor: `${theme.colors.primaryBg}60`,
            color: theme.colors.primaryText,
          }}
        >
          <Heart size={config.heartSize} />
        </button>

        {/* PDF Available Badge */}
        {(book.hasSoftCopy || book.softCopyUrl) && (
          <div 
            className="absolute top-2 left-2 md:top-3 md:left-3 px-2 py-1 rounded-full backdrop-blur-md flex items-center gap-1"
            style={{ 
              backgroundColor: 'rgba(34, 197, 94, 0.9)',
              color: '#fff',
            }}
          >
            <FileText size={config.iconSize} />
            <span className={`font-semibold ${config.textSize}`}>PDF</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`${config.padding} flex-1 flex flex-col`}>
        {/* Status Badge */}
        <div className="mb-2">
          <span 
            className={`inline-flex items-center gap-1 rounded-full font-semibold border ${config.badgeSize}`}
            style={{ 
              backgroundColor: statusColors.bg,
              color: statusColors.text,
              borderColor: statusColors.border,
            }}
          >
            {getStatusIcon(book.status)}
            {book.status}
          </span>
        </div>

        <h3 
          className={`font-semibold ${config.titleSize} leading-snug mb-1 transition-colors line-clamp-2`}
          style={{ color: theme.colors.primaryText }}
        >
          {book.title}
        </h3>
        <p 
          className={`${config.textSize} font-medium mb-3 line-clamp-1`}
          style={{ color: theme.colors.mutedText }}
        >
          {book.author}
        </p>
        
        <div className="mt-auto space-y-2">
            {/* Call Number & Location */}
            {config.showCallNumber && book.callNumber && (
              <div 
                className="p-2 rounded-lg"
                style={{ 
                  backgroundColor: `${theme.colors.accent}10`,
                  border: `1px solid ${theme.colors.accent}20`,
                }}
              >
                <div className={`flex items-center justify-between ${config.textSize}`}>
                  <span style={{ color: theme.colors.mutedText }}>Call Number:</span>
                  <span className="font-bold" style={{ color: theme.colors.accent }}>{book.callNumber}</span>
                </div>
                {book.shelfLocation && (
                  <div className={`flex items-center justify-between ${config.textSize} mt-1`}>
                    <span style={{ color: theme.colors.mutedText }}>Location:</span>
                    <span style={{ color: theme.colors.primaryText }}>{book.shelfLocation}</span>
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            {config.showStats && (
              <div className="hidden sm:block">
                <div className={`flex justify-between ${config.textSize} mb-1`} style={{ color: theme.colors.mutedText }}>
                  <span>Popularity</span>
                  <span>{book.popularity}%</span>
                </div>
                <div 
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: theme.colors.primaryBg }}
                >
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${book.popularity}%`,
                      backgroundColor: theme.colors.accent,
                    }}
                  />
                </div>
              </div>
            )}

            {config.showDetails && (
              <>
                <div 
                  className={`flex items-center justify-between ${config.textSize} font-medium pt-2`}
                  style={{ borderTop: `1px solid ${theme.colors.logoAccent}30` }}
                >
                   <span style={{ color: theme.colors.mutedText }}>Category</span>
                   <span 
                     className="px-2 py-0.5 rounded truncate max-w-[100px]"
                     style={{ 
                       backgroundColor: `${theme.colors.accent}15`,
                       color: theme.colors.accent,
                     }}
                   >
                     {book.category}
                   </span>
                </div>
                <div className={`flex items-center justify-between ${config.textSize} font-medium`}>
                   <span style={{ color: theme.colors.mutedText }}>Copies</span>
                   <span style={{ color: book.copiesAvailable > 0 ? '#4ade80' : '#f87171' }}>
                     {book.copiesAvailable} / {book.totalCopies}
                   </span>
                </div>
              </>
            )}

            {/* Minimal info for small sizes */}
            {!config.showDetails && (
              <div className={`flex items-center justify-between ${config.textSize} font-medium`}>
                 <span style={{ color: book.copiesAvailable > 0 ? '#4ade80' : '#f87171' }}>
                   {book.copiesAvailable}/{book.totalCopies}
                 </span>
              </div>
            )}
        </div>

        {/* Mobile Action Button */}
        <div className="mt-3 md:hidden">
          {book.status === BookStatus.AVAILABLE ? (
            <button 
              className={`w-full py-2 ${config.textSize} font-semibold rounded-lg`}
              style={{ 
                backgroundColor: theme.colors.accent,
                color: theme.colors.primaryBg,
              }}
            >
              Read More
            </button>
          ) : (
            <button 
              className={`w-full py-2 border ${config.textSize} font-semibold rounded-lg`}
              style={{ 
                borderColor: '#fbbf24',
                color: '#fbbf24',
              }}
            >
              Waitlist
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookCard;

