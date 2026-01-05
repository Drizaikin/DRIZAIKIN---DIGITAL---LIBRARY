import React, { useState, useEffect } from 'react';
import { Loan, BorrowRequest } from '../types';
import { Clock, AlertTriangle, BookOpen, Calendar, RefreshCw, XCircle, CheckCircle, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { authService } from '../services/authService';
import LiveTimer from './LiveTimer';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface MyLoansProps {
  loans: Loan[];
}

const MyLoans: React.FC<MyLoansProps> = ({ loans }) => {
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [reRequestingId, setReRequestingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentUser = authService.getCurrentUser();

  // Fetch borrow requests for the current user
  useEffect(() => {
    const fetchBorrowRequests = async () => {
      if (!currentUser) {
        setLoadingRequests(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/borrow-requests/${currentUser.id}`);
        if (response.ok) {
          const data = await response.json();
          setBorrowRequests(data);
        }
      } catch (err) {
        console.error('Error fetching borrow requests:', err);
      } finally {
        setLoadingRequests(false);
      }
    };

    fetchBorrowRequests();
  }, [currentUser]);

  // Handle re-requesting a rejected book
  const handleReRequest = async (bookId: string) => {
    if (!currentUser) return;

    setReRequestingId(bookId);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/borrow-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, bookId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: '✅ New borrow request submitted successfully!' });
        // Refresh the requests list
        const refreshResponse = await fetch(`${API_URL}/borrow-requests/${currentUser.id}`);
        if (refreshResponse.ok) {
          const refreshedData = await refreshResponse.json();
          setBorrowRequests(refreshedData);
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit request.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setReRequestingId(null);
    }
  };

  // Separate requests by status
  const pendingRequests = borrowRequests.filter(req => req.status === 'pending');
  const rejectedRequests = borrowRequests.filter(req => req.status === 'rejected');
  const getDaysRemaining = (dueDate: Date) => {
    const diff = dueDate.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const readingData = [
    { name: 'Mon', hours: 1.5 },
    { name: 'Tue', hours: 2.3 },
    { name: 'Wed', hours: 0.5 },
    { name: 'Thu', hours: 3.1 },
    { name: 'Fri', hours: 1.2 },
    { name: 'Sat', hours: 4.5 },
    { name: 'Sun', hours: 2.0 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
      <header className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-indigo-900 mb-2">My Library Dashboard</h2>
        <p className="text-sm md:text-base text-slate-500">Manage your active loans, pending requests, and track reading progress.</p>
      </header>

      {/* Message Display */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Main Content Section */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          
          {/* Pending Requests Section */}
          {(pendingRequests.length > 0 || loadingRequests) && (
            <div className="space-y-4 md:space-y-6">
              <h3 className="text-lg md:text-xl font-semibold text-slate-700 flex items-center gap-2">
                <Clock size={18} className="text-amber-500" />
                Pending Requests
                {pendingRequests.length > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                    {pendingRequests.length}
                  </span>
                )}
              </h3>
              
              <div className="space-y-3 md:space-y-4">
                {loadingRequests ? (
                  <div className="glass-panel p-6 md:p-8 rounded-xl text-center text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Loading requests...
                  </div>
                ) : (
                  pendingRequests.map((request) => (
                    <div key={request.id} className="glass-panel p-3 md:p-4 rounded-xl flex flex-col sm:flex-row gap-3 md:gap-4 items-start sm:items-center border-l-4 border-amber-400">
                      <div className="h-20 w-14 md:h-24 md:w-16 shrink-0 rounded-lg overflow-hidden shadow-md bg-slate-100">
                        {request.bookCoverUrl ? (
                          <img src={request.bookCoverUrl} alt={request.bookTitle} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-400">
                            <BookOpen size={24} />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm md:text-base text-indigo-900 truncate">{request.bookTitle || 'Unknown Book'}</h4>
                        <p className="text-xs md:text-sm text-slate-500 mb-2">{request.bookAuthor || 'Unknown Author'}</p>
                        
                        <div className="flex flex-wrap gap-2 text-[10px] md:text-xs">
                          <div className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 md:py-1 rounded">
                            <Calendar size={10} />
                            Requested: {new Date(request.requestedAt).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 md:py-1 rounded font-medium">
                            <Clock size={10} />
                            Awaiting Approval
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Rejected Requests Section */}
          {rejectedRequests.length > 0 && (
            <div className="space-y-4 md:space-y-6">
              <h3 className="text-lg md:text-xl font-semibold text-slate-700 flex items-center gap-2">
                <XCircle size={18} className="text-red-500" />
                Rejected Requests
              </h3>
              
              <div className="space-y-3 md:space-y-4">
                {rejectedRequests.map((request) => (
                  <div key={request.id} className="glass-panel p-3 md:p-4 rounded-xl flex flex-col sm:flex-row gap-3 md:gap-4 items-start sm:items-center border-l-4 border-red-400">
                    <div className="h-20 w-14 md:h-24 md:w-16 shrink-0 rounded-lg overflow-hidden shadow-md bg-slate-100">
                      {request.bookCoverUrl ? (
                        <img src={request.bookCoverUrl} alt={request.bookTitle} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-400">
                          <BookOpen size={24} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm md:text-base text-indigo-900 truncate">{request.bookTitle || 'Unknown Book'}</h4>
                      <p className="text-xs md:text-sm text-slate-500 mb-2">{request.bookAuthor || 'Unknown Author'}</p>
                      
                      <div className="flex flex-wrap gap-2 text-[10px] md:text-xs">
                        <div className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 md:py-1 rounded font-medium">
                          <XCircle size={10} />
                          Rejected
                        </div>
                        {request.rejectionReason && (
                          <div className="text-slate-600 bg-slate-100 px-2 py-0.5 md:py-1 rounded">
                            Reason: {request.rejectionReason}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 w-full sm:w-auto">
                      <button 
                        onClick={() => handleReRequest(request.bookId)}
                        disabled={reRequestingId === request.bookId}
                        className="w-full sm:w-auto px-4 py-2 text-xs md:text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {reRequestingId === request.bookId ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Requesting...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={14} />
                            Request Again
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Loans Section */}
          <div className="space-y-4 md:space-y-6">
            <h3 className="text-lg md:text-xl font-semibold text-slate-700 flex items-center gap-2">
              <CheckCircle size={18} className="text-green-500" />
              Active Loans
              {loans.length > 0 && (
                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                  {loans.length}
                </span>
              )}
            </h3>
            
            <div className="space-y-3 md:space-y-4">
              {loans.length === 0 ? (
                  <div className="glass-panel p-6 md:p-8 rounded-xl text-center text-slate-500">
                      You have no active loans.
                  </div>
              ) : (
                  loans.map((loan) => {
                  const daysLeft = getDaysRemaining(loan.dueDate);
                  const isOverdue = daysLeft < 0;
                  
                  return (
                      <div key={loan.id} className="glass-panel p-3 md:p-4 rounded-xl flex flex-col sm:flex-row gap-3 md:gap-4 items-start sm:items-center group hover:border-indigo-600/30 transition-all border-l-4 border-green-400">
                      <div className="h-20 w-14 md:h-24 md:w-16 shrink-0 rounded-lg overflow-hidden shadow-md">
                          <img src={loan.book.coverUrl} alt={loan.book.title} className="h-full w-full object-cover" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm md:text-base text-indigo-900 truncate">{loan.book.title}</h4>
                          <p className="text-xs md:text-sm text-slate-500 mb-2">{loan.book.author}</p>
                          
                          <div className="flex flex-wrap gap-2 text-[10px] md:text-xs">
                              <div className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 md:py-1 rounded">
                              <Calendar size={10} />
                              Due: {loan.dueDate.toLocaleDateString()}
                              </div>
                              {isOverdue && (
                              <div className="flex items-center gap-1 text-rose-600 bg-red-50 px-2 py-0.5 md:py-1 rounded font-medium">
                                  <AlertTriangle size={10} />
                                  Fine: KES {loan.fineAmount || 0}
                              </div>
                              )}
                          </div>
                      </div>

                      <div className="shrink-0 w-full sm:w-auto flex flex-col items-center sm:items-end gap-2">
                          {/* Live Timer */}
                          <LiveTimer dueDate={loan.dueDate} />
                          
                          <button className="px-3 md:px-4 py-1 md:py-1.5 text-xs md:text-sm bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-600 rounded-lg transition-colors shadow-sm">
                              Renew
                          </button>
                      </div>
                      </div>
                  );
                  })
              )}
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="space-y-4 md:space-y-6">
          <h3 className="text-lg md:text-xl font-semibold text-slate-700 flex items-center gap-2">
            <Clock size={18} className="text-indigo-600" />
            Reading Activity
          </h3>
          
          <div className="glass-panel p-4 md:p-6 rounded-xl">
             <div className="h-48 md:h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={readingData}>
                   <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                   <Tooltip 
                      cursor={{fill: '#f1f5f9'}}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                   />
                   <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                     {readingData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.hours > 3 ? '#4f46e5' : '#94a3b8'} />
                     ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
             <p className="text-center text-xs md:text-sm text-slate-500 mt-3 md:mt-4">Hours read this week</p>
          </div>

          <div className="glass-panel p-4 md:p-6 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
             <h4 className="font-serif text-base md:text-lg font-bold mb-2">Student Status</h4>
             <div className="space-y-2 text-xs md:text-sm text-blue-100">
               <div className="flex justify-between">
                 <span>Account Type</span>
                 <span className="font-semibold text-white">Undergraduate</span>
               </div>
               <div className="flex justify-between">
                 <span>Books Allowed</span>
                 <span className="font-semibold text-white">5</span>
               </div>
               <div className="flex justify-between">
                 <span>Current Loans</span>
                 <span className="font-semibold text-white">{loans.length}</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyLoans;
