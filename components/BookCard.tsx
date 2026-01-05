import React from 'react';
import { Book, BookStatus } from '../types';
import { Heart, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { IconSize } from '../services/preferencesService';
import { ICON_SIZES } from '../constants/themes';

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
    padding: 'p-3 md:p-5',
    titleSize: 'text-sm md:text-lg',
    textSize: 'text-xs md:text-sm',
    badgeSize: 'text-[10px] md:text-xs px-2 py-0.5 md:px-2.5 md:py-1',
    iconSize: 10,
    heartSize: 14,
    showDetails: true,
    showStats: true,
    showCallNumber: true,
  },
  lg: {
    padding: 'p-4 md:p-6',
    titleSize: 'text-base md:text-xl',
    textSize: 'text-sm md:text-base',
    badgeSize: 'text-xs px-2.5 py-1',
    iconSize: 12,
    heartSize: 16,
    showDetails: true,
    showStats: true,
    showCallNumber: true,
  },
  xl: {
    padding: 'p-5 md:p-7',
    titleSize: 'text-lg md:text-2xl',
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
  const sizeClasses = ICON_SIZES[iconSize];
  const config = SIZE_CONFIG[iconSize];

  const getStatusColor = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return 'bg-emerald-100/80 text-emerald-700 border-emerald-200';
      case BookStatus.WAITLIST: return 'bg-amber-100/80 text-amber-700 border-amber-200';
      case BookStatus.BORROWED: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getStatusIcon = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return <CheckCircle size={config.iconSize} />;
      case BookStatus.WAITLIST: return <Clock size={config.iconSize} />;
      case BookStatus.BORROWED: return <AlertCircle size={config.iconSize} />;
    }
  };

  return (
    <div 
      onClick={() => onViewDetails(book)}
      className={`group relative bg-white rounded-lg md:rounded-xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 ease-out border border-slate-100 flex flex-col h-full cursor-pointer ${sizeClasses.card}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Image Container */}
      <div className={`relative aspect-[2/3] overflow-hidden bg-slate-200 ${sizeClasses.image}`}>
        <img 
          src={book.coverUrl} 
          alt={book.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[10%] group-hover:grayscale-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
        
        {/* Hover Overlay Buttons - Hidden on mobile and small sizes */}
        {(iconSize === 'md' || iconSize === 'lg' || iconSize === 'xl') && (
          <div className="absolute bottom-0 left-0 right-0 p-2 md:p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-white/90 backdrop-blur-md border-t border-white/50 hidden md:block">
             {book.status === BookStatus.AVAILABLE ? (
               <button className={`w-full py-2 md:py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white ${config.textSize} font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2`}>
                 Borrow Now
               </button>
             ) : (
               <button className={`w-full py-2 md:py-2.5 bg-transparent border border-amber-500 text-amber-600 ${config.textSize} font-semibold rounded-lg hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center gap-2`}>
                 Join Waitlist
               </button>
             )}
          </div>
        )}

        <button className="absolute top-2 right-2 md:top-3 md:right-3 p-1.5 md:p-2 rounded-full bg-white/20 backdrop-blur-md hover:bg-white text-white hover:text-rose-500 transition-all">
          <Heart size={config.heartSize} />
        </button>
      </div>

      {/* Content */}
      <div className={`${config.padding} flex-1 flex flex-col`}>
        {/* Status Badge */}
        <div className="mb-2 md:mb-3">
          <span className={`inline-flex items-center gap-1 rounded-full font-semibold border ${config.badgeSize} ${getStatusColor(book.status)}`}>
            {getStatusIcon(book.status)}
            {book.status}
          </span>
        </div>

        <h3 className={`font-serif font-bold ${config.titleSize} text-indigo-900 leading-snug mb-0.5 md:mb-1 group-hover:text-purple-600 transition-colors line-clamp-2`}>
          {book.title}
        </h3>
        <p className={`${config.textSize} text-slate-500 font-medium mb-2 md:mb-4 line-clamp-1`}>{book.author}</p>
        
        <div className="mt-auto space-y-2 md:space-y-3">
            {/* Call Number & Location - Most Important Info */}
            {config.showCallNumber && book.callNumber && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-2 rounded-lg border border-indigo-100">
                <div className={`flex items-center justify-between ${config.textSize}`}>
                  <span className="text-slate-600 font-medium">Call Number:</span>
                  <span className="font-bold text-indigo-600">{book.callNumber}</span>
                </div>
                {book.shelfLocation && (
                  <div className={`flex items-center justify-between ${config.textSize} mt-1`}>
                    <span className="text-slate-500">Location:</span>
                    <span className="text-slate-700">{book.shelfLocation}</span>
                  </div>
                )}
                {book.floorNumber && (
                  <div className={`flex items-center justify-between ${config.textSize}`}>
                    <span className="text-slate-500">Floor:</span>
                    <span className="text-slate-700">{book.floorNumber}</span>
                  </div>
                )}
              </div>
            )}

            {/* Stats - Hidden on very small screens and small sizes */}
            {config.showStats && (
              <div className="hidden sm:block">
                <div className={`flex justify-between ${config.textSize} text-slate-400 mb-1`}>
                  <span>Popularity</span>
                  <span>{book.popularity}%</span>
                </div>
                <div className="h-1 md:h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" 
                    style={{ width: `${book.popularity}%` }}
                  />
                </div>
              </div>
            )}

            {config.showDetails && (
              <>
                <div className={`flex items-center justify-between ${config.textSize} font-medium pt-2 border-t border-slate-100`}>
                   <span className="text-slate-500">Category</span>
                   <span className={`text-indigo-600 bg-indigo-50 px-1.5 md:px-2 py-0.5 rounded ${config.textSize} truncate max-w-[80px] md:max-w-none`}>{book.category}</span>
                </div>
                <div className={`flex items-center justify-between ${config.textSize} font-medium`}>
                   <span className="text-slate-500">Copies</span>
                   <span className={book.copiesAvailable > 0 ? "text-emerald-600" : "text-rose-500"}>
                     {book.copiesAvailable} / {book.totalCopies}
                   </span>
                </div>
              </>
            )}

            {/* Minimal info for small sizes */}
            {!config.showDetails && (
              <div className={`flex items-center justify-between ${config.textSize} font-medium`}>
                 <span className={book.copiesAvailable > 0 ? "text-emerald-600" : "text-rose-500"}>
                   {book.copiesAvailable}/{book.totalCopies}
                 </span>
              </div>
            )}
        </div>

        {/* Mobile Action Button */}
        <div className="mt-3 md:hidden">
          {book.status === BookStatus.AVAILABLE ? (
            <button className={`w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white ${config.textSize} font-semibold rounded-lg shadow-md`}>
              Borrow
            </button>
          ) : (
            <button className={`w-full py-2 border border-amber-500 text-amber-600 ${config.textSize} font-semibold rounded-lg`}>
              Waitlist
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookCard;
