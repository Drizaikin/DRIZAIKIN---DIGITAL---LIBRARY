import React, { useState } from 'react';
import { Book, BookStatus } from '../types';
import { CheckCircle, Clock, AlertCircle, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

interface BookTableProps {
  books: Book[];
  onViewDetails: (book: Book) => void;
}

type SortKey = 'title' | 'author' | 'category' | 'status' | 'copies' | 'callNumber';
type SortDirection = 'asc' | 'desc';

const BookTable: React.FC<BookTableProps> = ({ books, onViewDetails }) => {
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const getStatusColor = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return 'bg-emerald-600/10 text-emerald-600';
      case BookStatus.WAITLIST: return 'bg-rose-500/10 text-rose-500';
      case BookStatus.BORROWED: return 'bg-gray-100 text-gray-500';
    }
  };

  const getStatusIcon = (status: BookStatus) => {
    switch (status) {
      case BookStatus.AVAILABLE: return <CheckCircle size={12} />;
      case BookStatus.WAITLIST: return <Clock size={12} />;
      case BookStatus.BORROWED: return <AlertCircle size={12} />;
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedBooks = [...books].sort((a, b) => {
    let comparison = 0;
    switch (sortKey) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'author':
        comparison = a.author.localeCompare(b.author);
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      case 'copies':
        comparison = a.copiesAvailable - b.copiesAvailable;
        break;
      case 'callNumber':
        comparison = (a.callNumber || '').localeCompare(b.callNumber || '');
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown size={14} className="text-slate-300" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp size={14} className="text-indigo-600" />
      : <ChevronDown size={14} className="text-indigo-600" />;
  };

  const HeaderCell = ({ label, sortKeyName, className = '' }: { label: string; sortKeyName: SortKey; className?: string }) => (
    <th
      onClick={() => handleSort(sortKeyName)}
      className={`px-2 md:px-4 py-2 md:py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${className}`}
    >
      <div className="flex items-center gap-1">
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{label.slice(0, 3)}</span>
        <SortIcon columnKey={sortKeyName} />
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-16 px-4 py-3"></th>
              <HeaderCell label="Title" sortKeyName="title" />
              <HeaderCell label="Author" sortKeyName="author" />
              <HeaderCell label="Category" sortKeyName="category" />
              <HeaderCell label="Status" sortKeyName="status" />
              <HeaderCell label="Copies" sortKeyName="copies" />
              <HeaderCell label="Call Number" sortKeyName="callNumber" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Location
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedBooks.map((book) => (
              <tr
                key={book.id}
                onClick={() => onViewDetails(book)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-10 h-14 object-cover rounded shadow-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-indigo-600 hover:text-rose-500 transition-colors line-clamp-2">
                    {book.title}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{book.author}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-blue-50 text-indigo-600 px-2 py-1 rounded">
                    {book.category}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(book.status)}`}>
                    {getStatusIcon(book.status)}
                    {book.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${book.copiesAvailable > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {book.copiesAvailable}/{book.totalCopies}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm text-slate-600">
                  {book.callNumber || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {book.shelfLocation || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden">
        {/* Mobile Sort Controls */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-200 bg-slate-50 overflow-x-auto">
          <span className="text-xs text-slate-500 flex-shrink-0">Sort:</span>
          {(['title', 'author', 'status', 'copies'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`px-2 py-1 text-xs rounded-full flex-shrink-0 transition-colors ${
                sortKey === key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        {/* Mobile Cards */}
        <div className="divide-y divide-slate-100">
          {sortedBooks.map((book) => (
            <div
              key={book.id}
              onClick={() => onViewDetails(book)}
              className="p-3 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <div className="flex gap-3">
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-indigo-600 line-clamp-1">{book.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{book.author}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(book.status)}`}>
                      {getStatusIcon(book.status)}
                      {book.status}
                    </span>
                    <span className={`text-[10px] font-medium ${book.copiesAvailable > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {book.copiesAvailable}/{book.totalCopies}
                    </span>
                    {book.callNumber && (
                      <span className="text-[10px] font-mono text-slate-500">{book.callNumber}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BookTable;
