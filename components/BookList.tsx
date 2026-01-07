import React from 'react';
import { Book, BookStatus } from '../types';
import { Heart, Clock, AlertCircle, CheckCircle, MapPin, Layers } from 'lucide-react';

interface BookListProps {
  books: Book[];
  onViewDetails: (book: Book) => void;
}

const BookList: React.FC<BookListProps> = ({ books, onViewDetails }) => {
  const getStatusColor = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return 'bg-emerald-600/10 text-emerald-600 border-emerald-600/20';
      case BookStatus.WAITLIST: return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case BookStatus.BORROWED: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getStatusIcon = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return <CheckCircle size={12} />;
      case BookStatus.WAITLIST: return <Clock size={12} />;
      case BookStatus.BORROWED: return <AlertCircle size={12} />;
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {books.map((book, index) => (
        <div
          key={book.id}
          onClick={() => onViewDetails(book)}
          className="group bg-white rounded-lg md:rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100 cursor-pointer"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex flex-col sm:flex-row">
            {/* Book Cover */}
            <div className="relative w-full sm:w-32 md:w-40 lg:w-48 flex-shrink-0">
              <div className="aspect-[2/3] sm:aspect-auto sm:h-full overflow-hidden bg-slate-200">
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <button className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-slate-400 hover:text-rose-500 transition-all">
                <Heart size={14} />
              </button>
            </div>

            {/* Book Details */}
            <div className="flex-1 p-3 md:p-4 lg:p-5 flex flex-col">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif font-bold text-base md:text-lg lg:text-xl text-indigo-600 leading-snug group-hover:text-rose-500 transition-colors line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="text-sm md:text-base text-slate-500 font-medium mt-0.5">{book.author}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold border flex-shrink-0 ${getStatusColor(book.status)}`}>
                  {getStatusIcon(book.status)}
                  {book.status}
                </span>
              </div>

              {/* Description - Hidden on mobile */}
              {book.description && (
                <p className="hidden md:block text-sm text-slate-600 line-clamp-2 mb-3">
                  {book.description}
                </p>
              )}

              {/* Book Info Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mt-auto">
                {/* Category */}
                <div className="flex items-center gap-1.5 text-xs md:text-sm">
                  <span className="text-slate-400">Category:</span>
                  <span className="text-indigo-600 font-medium truncate">{book.category}</span>
                </div>

                {/* Copies */}
                <div className="flex items-center gap-1.5 text-xs md:text-sm">
                  <Layers size={14} className="text-slate-400" />
                  <span className={book.copiesAvailable > 0 ? "text-emerald-600 font-medium" : "text-rose-500 font-medium"}>
                    {book.copiesAvailable}/{book.totalCopies} available
                  </span>
                </div>

                {/* Call Number */}
                {book.callNumber && (
                  <div className="flex items-center gap-1.5 text-xs md:text-sm">
                    <span className="text-slate-400">Call#:</span>
                    <span className="font-mono text-indigo-600 font-medium">{book.callNumber}</span>
                  </div>
                )}

                {/* Location */}
                {book.shelfLocation && (
                  <div className="flex items-center gap-1.5 text-xs md:text-sm">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="text-slate-600 truncate">{book.shelfLocation}</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BookList;
