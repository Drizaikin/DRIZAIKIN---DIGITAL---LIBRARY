import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Settings, Trash2, History } from 'lucide-react';
import { ChatMessage, User as UserType } from '../types';
import { generateLibrarianResponse, getChatHistory, clearChatHistory } from '../services/geminiService';
import { darkTheme } from '../constants/darkTheme';

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
       {/* Header - Dark theme with accent color */}
       <div 
         className="rounded-t-xl md:rounded-t-2xl p-4 md:p-6 shadow-lg shrink-0"
         style={{ 
           backgroundColor: darkTheme.colors.secondarySurface,
           borderBottom: `1px solid ${darkTheme.colors.logoAccent}40`
         }}
       >
          <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2 md:gap-4 min-w-0">
               <div 
                 className="p-2 md:p-3 rounded-full backdrop-blur-md shrink-0"
                 style={{ 
                   backgroundColor: `${darkTheme.colors.accent}20`,
                   border: `1px solid ${darkTheme.colors.accent}40`
                 }}
               >
                 <Sparkles size={20} className="animate-pulse-slow" style={{ color: darkTheme.colors.accent }} />
               </div>
               <div className="min-w-0">
                 <h2 className="text-lg md:text-2xl font-serif font-bold truncate" style={{ color: darkTheme.colors.primaryText }}>
                   AI Research Assistant
                 </h2>
                 <p className="text-xs md:text-sm opacity-80 truncate" style={{ color: darkTheme.colors.mutedText }}>
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
                 className="p-1.5 md:p-2 rounded-lg transition-colors"
                 style={{ 
                   backgroundColor: darkTheme.colors.hoverBg,
                   color: darkTheme.colors.primaryText
                 }}
                 title="Set your interests"
               >
                 <Settings size={18} />
               </button>
               {messages.length > 1 && (
                 <button
                   onClick={handleClearHistory}
                   className="p-1.5 md:p-2 rounded-lg hover:bg-red-500/50 transition-colors"
                   style={{ 
                     backgroundColor: darkTheme.colors.hoverBg,
                     color: darkTheme.colors.primaryText
                   }}
                   title="Clear chat history"
                 >
                   <Trash2 size={18} />
                 </button>
               )}
             </div>
          </div>
          
          {showSettings && (
            <div 
              className="mt-3 md:mt-4 p-3 md:p-4 rounded-lg md:rounded-xl backdrop-blur-md"
              style={{ 
                backgroundColor: darkTheme.colors.hoverBg,
                border: `1px solid ${darkTheme.colors.logoAccent}40`
              }}
            >
              <label className="block text-xs md:text-sm font-medium mb-2" style={{ color: darkTheme.colors.primaryText }}>
                Your Interests (optional)
              </label>
              <input
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g., Machine Learning, African History..."
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all"
                style={{ 
                  backgroundColor: darkTheme.colors.primaryBg,
                  border: `1px solid ${darkTheme.colors.logoAccent}`,
                  color: darkTheme.colors.primaryText,
                  '--tw-ring-color': darkTheme.colors.accent
                } as React.CSSProperties}
              />
              <p className="text-[10px] md:text-xs mt-2" style={{ color: darkTheme.colors.mutedText }}>
                Add interests for personalized recommendations
              </p>
            </div>
          )}
       </div>

       {/* Messages area - Dark theme */}
       <div 
         className="flex-1 overflow-y-auto p-3 md:p-6"
         style={{ 
           backgroundColor: darkTheme.colors.primaryBg,
           borderLeft: `1px solid ${darkTheme.colors.logoAccent}30`,
           borderRight: `1px solid ${darkTheme.colors.logoAccent}30`
         }}
       >
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div 
                  className="w-8 h-8 border-4 rounded-full animate-spin mx-auto mb-3"
                  style={{ 
                    borderColor: `${darkTheme.colors.accent}30`,
                    borderTopColor: darkTheme.colors.accent
                  }}
                />
                <p className="text-sm" style={{ color: darkTheme.colors.mutedText }}>Loading your conversation history...</p>
              </div>
            </div>
          ) : (
          <div className="space-y-4 md:space-y-6">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-2 md:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div 
                  className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-sm"
                  style={{ 
                    backgroundColor: msg.role === 'model' ? darkTheme.colors.accent : darkTheme.colors.hoverBg,
                    color: msg.role === 'model' ? '#ffffff' : darkTheme.colors.primaryText
                  }}
                >
                  {msg.role === 'model' ? <Bot size={16} /> : <User size={16} />}
                </div>
                
                <div 
                  className={`max-w-[85%] md:max-w-[80%] rounded-xl md:rounded-2xl p-3 md:p-4 shadow-sm ${
                     msg.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'
                  }`}
                  style={{ 
                    backgroundColor: msg.role === 'user' ? darkTheme.colors.accent : darkTheme.colors.secondarySurface,
                    color: msg.role === 'user' ? '#ffffff' : darkTheme.colors.primaryText,
                    border: msg.role === 'model' ? `1px solid ${darkTheme.colors.logoAccent}40` : 'none'
                  }}
                >
                  <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{formatMessage(msg.text)}</p>
                  <span 
                    className="text-[9px] md:text-[10px] block mt-1 md:mt-2 opacity-60"
                    style={{ color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : darkTheme.colors.mutedText }}
                  >
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            
            {isThinking && (
              <div className="flex gap-2 md:gap-4">
                 <div 
                   className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center"
                   style={{ backgroundColor: darkTheme.colors.accent, color: '#ffffff' }}
                 >
                    <Bot size={16} />
                 </div>
                 <div 
                   className="rounded-xl md:rounded-2xl rounded-tl-none p-3 md:p-4 shadow-sm flex items-center gap-2"
                   style={{ 
                     backgroundColor: darkTheme.colors.secondarySurface,
                     border: `1px solid ${darkTheme.colors.logoAccent}40`
                   }}
                 >
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: `${darkTheme.colors.accent}80`, animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: `${darkTheme.colors.accent}80`, animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: `${darkTheme.colors.accent}80`, animationDelay: '300ms' }} />
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          )}
       </div>

       {/* Input area - Dark theme */}
       <div 
         className="p-3 md:p-4 rounded-b-xl md:rounded-b-2xl shadow-lg shrink-0"
         style={{ 
           backgroundColor: darkTheme.colors.secondarySurface,
           borderTop: `1px solid ${darkTheme.colors.logoAccent}40`
         }}
       >
          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about books, topics..."
              className="w-full rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 pr-12 text-sm focus:outline-none focus:ring-2 transition-all"
              style={{ 
                backgroundColor: darkTheme.colors.primaryBg,
                border: `1px solid ${darkTheme.colors.logoAccent}`,
                color: darkTheme.colors.primaryText,
                '--tw-ring-color': darkTheme.colors.accent
              } as React.CSSProperties}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="absolute right-2 p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ 
                backgroundColor: darkTheme.colors.accent,
                color: '#ffffff'
              }}
            >
              <Send size={16} />
            </button>
          </div>
       </div>
    </div>
  );
};

export default AILibrarian;
