import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Settings, Trash2, History } from 'lucide-react';
import { ChatMessage, User as UserType } from '../types';
import { generateLibrarianResponse, getChatHistory, clearChatHistory } from '../services/geminiService';

interface AILibrarianProps {
  currentUser?: UserType | null;
}

// Function to format text: convert **text** to bold
const formatMessage = (text: string): React.ReactNode => {
  // Split by **text** pattern and convert to bold
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove asterisks and make bold
      const boldText = part.slice(2, -2);
      return <strong key={index} className="font-semibold">{boldText}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
};

const AILibrarian: React.FC<AILibrarianProps> = ({ currentUser }) => {
  const [interests, setInterests] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      if (currentUser?.id) {
        setIsLoadingHistory(true);
        const history = await getChatHistory(currentUser.id);
        
        if (history.length > 0) {
          const loadedMessages: ChatMessage[] = history.map(h => ({
            id: h.id,
            role: h.role as 'user' | 'model',
            text: h.text,
            timestamp: new Date(h.timestamp)
          }));
          setMessages(loadedMessages);
        } else {
          // Set welcome message if no history
          setMessages([{
            id: 'welcome',
            role: 'model',
            text: currentUser?.course 
              ? `Greetings, ${currentUser.name}! I see you're studying ${currentUser.course}. I'm the Drizaikn AI Librarian, ready to help you find resources tailored to your field. How may I assist you today?`
              : 'Greetings! I am the Drizaikn AI Librarian. How may I assist you with your academic research today?',
            timestamp: new Date()
          }]);
        }
        setIsLoadingHistory(false);
      }
    };
    
    loadHistory();
  }, [currentUser?.id, currentUser?.name, currentUser?.course]);

  const handleClearHistory = async () => {
    if (currentUser?.id && window.confirm('Are you sure you want to clear your chat history? This cannot be undone.')) {
      const success = await clearChatHistory(currentUser.id);
      if (success) {
        setMessages([{
          id: 'welcome',
          role: 'model',
          text: `Chat history cleared. Hello ${currentUser.name || 'there'}! How can I help you today?`,
          timestamp: new Date()
        }]);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    const userContext = {
      name: currentUser?.name,
      course: currentUser?.course,
      interests: interests || undefined,
      role: currentUser?.role,
      userId: currentUser?.id
    };

    const responseText = await generateLibrarianResponse(input, userContext);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsThinking(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] max-w-4xl mx-auto">
       <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-t-xl md:rounded-t-2xl p-4 md:p-6 shadow-lg text-white shrink-0">
          <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2 md:gap-4 min-w-0">
               <div className="p-2 md:p-3 bg-white/10 rounded-full backdrop-blur-md border border-white/20 shrink-0">
                 <Sparkles size={20} className="animate-pulse-slow" />
               </div>
               <div className="min-w-0">
                 <h2 className="text-lg md:text-2xl font-serif font-bold truncate">AI Research Assistant</h2>
                 <p className="text-indigo-100 text-xs md:text-sm opacity-80 truncate">
                   {currentUser?.course ? `For ${currentUser.course}` : 'Drizaikn Library'}
                   {messages.length > 1 && (
                     <span className="ml-1 md:ml-2 inline-flex items-center gap-1">
                       <History size={10} className="hidden sm:inline" />
                       <span className="hidden sm:inline">{messages.length} saved</span>
                     </span>
                   )}
                 </p>
               </div>
             </div>
             <div className="flex items-center gap-1 md:gap-2 shrink-0">
               <button
                 onClick={() => setShowSettings(!showSettings)}
                 className="p-1.5 md:p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                 title="Set your interests"
               >
                 <Settings size={18} />
               </button>
               {messages.length > 1 && (
                 <button
                   onClick={handleClearHistory}
                   className="p-1.5 md:p-2 bg-white/10 rounded-lg hover:bg-red-500/50 transition-colors"
                   title="Clear chat history"
                 >
                   <Trash2 size={18} />
                 </button>
               )}
             </div>
          </div>
          
          {showSettings && (
            <div className="mt-3 md:mt-4 p-3 md:p-4 bg-white/10 rounded-lg md:rounded-xl backdrop-blur-md">
              <label className="block text-xs md:text-sm font-medium mb-2">Your Interests (optional)</label>
              <input
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g., Machine Learning, African History..."
                className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              <p className="text-[10px] md:text-xs text-indigo-200 mt-2">
                Add interests for personalized recommendations
              </p>
            </div>
          )}
       </div>

       <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-white/60 backdrop-blur-xl border-x border-white/40">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Loading your conversation history...</p>
              </div>
            </div>
          ) : (
          <div className="space-y-4 md:space-y-6">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-2 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-sm ${
                  msg.role === 'model' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {msg.role === 'model' ? <Bot size={16} /> : <User size={16} />}
                </div>
                
                <div className={`max-w-[85%] md:max-w-[80%] rounded-xl md:rounded-2xl p-3 md:p-4 shadow-sm ${
                   msg.role === 'user' 
                   ? 'bg-indigo-600 text-white rounded-tr-none' 
                   : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                }`}>
                  <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{formatMessage(msg.text)}</p>
                  <span className={`text-[9px] md:text-[10px] block mt-1 md:mt-2 opacity-60 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            
            {isThinking && (
              <div className="flex gap-2 md:gap-4">
                 <div className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                    <Bot size={16} />
                 </div>
                 <div className="bg-white border border-slate-100 rounded-xl md:rounded-2xl rounded-tl-none p-3 md:p-4 shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-600/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-indigo-600/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-indigo-600/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          )}
       </div>

       <div className="p-3 md:p-4 bg-white border-t border-slate-100 rounded-b-xl md:rounded-b-2xl shadow-lg shrink-0">
          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about books, topics..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 pr-12 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
       </div>
    </div>
  );
};

export default AILibrarian;
