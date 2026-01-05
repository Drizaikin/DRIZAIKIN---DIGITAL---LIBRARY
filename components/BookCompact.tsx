import React from 'react';
import { Book, BookStatus } from '../types';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface BookCompactProps {
  books: Book[];
  onViewDetails: (book: Book) => void;
}

const BookCompact: React.FC<BookCompactProps> = ({ books, onViewDetails }) => {
  const getStatusDot = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return 'bg-emerald-600';
      case BookStatus.WAITLIST: return 'bg-rose-500';
      case BookStatus.BORROWED: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return <CheckCircle size={10} className="text-emerald-600" />;
      case BookStatus.WAITLIST: return <Clock size={10} className="text-rose-500" />;
      case BookStatus.BORROWED: return <AlertCircle size={10} className="text-gray-400" />;
    }
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 md:gap-3">
      {books.map((book, index) => (
        <div
          key={book.id}
          onClick={() => onViewDetails(book)}
          className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-slate-100 cursor-pointer"
          style={{ animationDelay: `${index * 30}ms` }}
        >
          {/* Book Cover with Status Indicator */}
          <div className="relative aspect-[2/3] overflow-hidden bg-slate-200">
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Status Dot */}
            <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${getStatusDot(book.status)} ring-2 ring-white`} />
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <div className="flex items-center gap-1 text-white text-[10px]">
                  {getStatusIcon(book.status)}
                  <span>{book.copiesAvailable}/{book.totalCopies}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Minimal Info */}
          <div className="p-1.5 md:p-2">
            <h3 className="font-medium text-[10px] md:text-xs text-indigo-600 leading-tight line-clamp-2 group-hover:text-rose-500 transition-colors">
              {book.title}
            </h3>
            <p className="text-[9px] md:text-[10px] text-slate-500 mt-0.5 line-clamp-1">
              {book.author}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BookCompact;
