import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Filter, 
  User, 
  Mail, 
  Clock, 
  MessageSquare, 
  Flame, 
  Star, 
  ChevronRight, 
  Download, 
  Trash2, 
  TrendingUp, 
  Users, 
  MessageCircle,
  X,
  FileText,
  Calendar,
  Bot
} from "lucide-react";
import { api } from "../lib/api";

interface Message {
  role: 'user' | 'bot' | 'model';
  content: string;
  text?: string; // Support for existing data
  timestamp: any;
}

interface ChatSession {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  startTime?: any;
  createdAt?: any;
  endTime?: any;
  messageCount: number;
  messages: Message[];
  isLead?: boolean;
  leadScore?: number;
  hasEmail?: boolean;
  askedAboutPricing?: boolean;
  askedAboutTimeline?: boolean;
  status?: 'active' | 'ended';
  lastActivity?: any;
  lastUpdated?: any;
  tags?: string[];
}

interface ChatHistoryManagerProps {
  initialSessions: ChatSession[];
  onRefresh: () => void;
}

export default function ChatHistoryManager({ initialSessions, onRefresh }: ChatHistoryManagerProps) {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTimeFilter, setActiveTimeFilter] = useState<"today" | "week" | "all">("all");
  const [filters, setFilters] = useState({
    hasEmail: false,
    isLead: false,
    pricing: false,
    longSessions: false
  });

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  const selectedSession = useMemo(() => 
    sessions.find(s => s.id === selectedSessionId), [sessions, selectedSessionId]
  );

  // Helper: Format Time
  const formatTime = (ts: any) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: any) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTimeAgo = (ts: any) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  };

  // Smart Detection: Run locally if data is missing
  const processedSessions = useMemo(() => {
    return sessions.map(session => {
      const msgs = session.messages || [];
      const hasEmail = session.userEmail || msgs.some(m => (m.content || m.text || "").includes("@"));
      const askedAboutPricing = msgs.some(m => {
        const text = (m.content || m.text || "").toLowerCase();
        return text.includes("price") || text.includes("cost") || text.includes("budget") || text.includes("how much");
      });
      const askedAboutTimeline = msgs.some(m => {
        const text = (m.content || m.text || "").toLowerCase();
        return text.includes("time") || text.includes("duration") || text.includes("long") || text.includes("deadline");
      });

      // Auto Lead Detection
      const signals = [
        hasEmail,
        askedAboutPricing,
        askedAboutTimeline,
        msgs.length > 5
      ];
      const isAutoLead = signals.filter(Boolean).length >= 2;

      return {
        ...session,
        hasEmail: session.hasEmail ?? !!hasEmail,
        askedAboutPricing: session.askedAboutPricing ?? askedAboutPricing,
        askedAboutTimeline: session.askedAboutTimeline ?? askedAboutTimeline,
        isLead: session.isLead ?? isAutoLead,
        messageCount: session.messageCount ?? msgs.length,
        lastActivity: session.lastActivity || session.lastUpdated || session.createdAt
      };
    });
  }, [sessions]);

  // Filtering Logic
  const filteredSessions = useMemo(() => {
    return processedSessions.filter(s => {
      // Time Filter
      const lastActivityDate = s.lastActivity?.toDate ? s.lastActivity.toDate() : new Date(s.lastActivity);
      const now = new Date();
      if (activeTimeFilter === "today") {
        if (lastActivityDate.toDateString() !== now.toDateString()) return false;
      } else if (activeTimeFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (lastActivityDate < weekAgo) return false;
      }

      // Search
      const searchStr = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (s.userName || "").toLowerCase().includes(searchStr) || 
        (s.userEmail || "").toLowerCase().includes(searchStr) ||
        s.messages.some(m => (m.content || m.text || "").toLowerCase().includes(searchStr));
      
      if (!matchesSearch) return false;

      // Checkbox Filters
      if (filters.hasEmail && !s.hasEmail) return false;
      if (filters.isLead && !s.isLead) return false;
      if (filters.pricing && !s.askedAboutPricing) return false;
      if (filters.longSessions && (s.messageCount || 0) < 10) return false;

      return true;
    }).sort((a,b) => {
      const getT = (ts: any) => ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
      return getT(b.lastActivity) - getT(a.lastActivity);
    });
  }, [processedSessions, searchQuery, filters, activeTimeFilter]);

  // Analytics Calculations
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const now = new Date().getTime();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const todayCount = processedSessions.filter(s => {
      const d = s.lastActivity?.toDate ? s.lastActivity.toDate() : new Date(s.lastActivity);
      return d.toDateString() === today;
    }).length;

    const weekCount = processedSessions.filter(s => {
      const d = s.lastActivity?.toDate ? s.lastActivity.toDate() : new Date(s.lastActivity);
      return d.getTime() > weekAgo;
    }).length;

    const leadsCount = processedSessions.filter(s => s.isLead).length;
    const withEmailCount = processedSessions.filter(s => s.hasEmail).length;
    const avgMessages = processedSessions.length ? (processedSessions.reduce((acc, s) => acc + (s.messageCount || 0), 0) / processedSessions.length).toFixed(1) : 0;

    // Top Questions Analysis
    let pricingCount = 0;
    let techCount = 0;
    let timelineCount = 0;
    let portfolioCount = 0;

    processedSessions.forEach(s => {
      if (s.askedAboutPricing) pricingCount++;
      if (s.askedAboutTimeline) timelineCount++;
      const msgs = s.messages.map(m => (m.content || m.text || "").toLowerCase());
      if (msgs.some(txt => txt.includes("experience") || txt.includes("react") || txt.includes("skill") || txt.includes("tech"))) techCount++;
      if (msgs.some(txt => txt.includes("work") || txt.includes("portfolio") || txt.includes("project"))) portfolioCount++;
    });

    const totalSignals = processedSessions.length || 1;
    const topQuestions = [
      { label: "Pricing / Budget", count: pricingCount, percent: Math.round((pricingCount / totalSignals) * 100) },
      { label: "Timeline / Deadline", count: timelineCount, percent: Math.round((timelineCount / totalSignals) * 100) },
      { label: "Technologies / Skills", count: techCount, percent: Math.round((techCount / totalSignals) * 100) },
      { label: "Portfolio / Work", count: portfolioCount, percent: Math.round((portfolioCount / totalSignals) * 100) },
    ].sort((a,b) => b.count - a.count);

    return { todayCount, weekCount, leadsCount, withEmailCount, avgMessages, topQuestions };
  }, [processedSessions]);

  const handleMarkLead = async (sessionId: string, currentLeadStatus: boolean) => {
    try {
      await api.put("chatSessions", sessionId, { isLead: !currentLeadStatus });
      onRefresh();
    } catch (err) {
      console.error("Failed to update lead status:", err);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (window.confirm("Delete this chat session permanently?")) {
      try {
        await api.delete("chatSessions", sessionId);
        if (selectedSessionId === sessionId) setSelectedSessionId(null);
        onRefresh();
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    }
  };

  const exportChat = (session: ChatSession) => {
    const text = session.messages.map(m => {
      const role = m.role === 'model' ? 'BOT' : m.role.toUpperCase();
      const content = m.content || m.text || "";
      const time = formatTime(m.timestamp);
      return `[${role}] (${time}): ${content}`;
    }).join("\n\n");
    
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `chat-session-${session.id}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const exportAllLeads = () => {
    const leadsList = processedSessions.filter(s => s.isLead);
    const csv = leadsList.map(s => {
      return `"${s.userName || 'Anonymous'}","${s.userEmail || ''}","${s.messageCount}","${formatDate(s.lastActivity)}"`;
    }).join("\n");
    
    const headers = "Name,Email,Messages,Last Active\n";
    const element = document.createElement("a");
    const file = new Blob([headers + csv], {type: 'text/csv'});
    element.href = URL.createObjectURL(file);
    element.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Analytics Dashboard */}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Chats" value={processedSessions.length} icon={<MessageCircle className="text-blue-500" />} />
          <StatCard title="Potential Leads" value={stats.leadsCount} icon={<Flame className="text-orange-500" />} subtitle={`${stats.withEmailCount} with email`} />
          <StatCard title="Today's Volume" value={stats.todayCount} icon={<TrendingUp className="text-green-500" />} subtitle={`${stats.weekCount} this week`} />
          <StatCard title="Avg. Depth" value={stats.avgMessages} icon={<TrendingUp className="text-purple-500" />} subtitle="Messages / session" />
        </div>
        
        {/* Top Interests section */}
        <div className="glass p-6 rounded-3xl border border-line">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-mono text-[10px] uppercase text-secondary tracking-[0.3em]">Top User Interest Signals</h3>
            <span className="text-[10px] font-mono text-accent uppercase font-bold tracking-widest">Real-time Analysis</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {stats.topQuestions.map((q, idx) => (
              <div key={idx} className="space-y-3">
                <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest">
                  <span className="text-white/60">{q.label}</span>
                  <span className="text-accent">{q.percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${q.percent}%` }}
                    transition={{ duration: 1, delay: idx * 0.1 }}
                    className="h-full bg-accent"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[800px]">
        {/* Left Panel: List & Filters */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 h-full">
          {/* Filter & Search Panel */}
          <div className="glass p-6 rounded-3xl border border-line flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => setActiveTimeFilter("today")}
                className={`py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${activeTimeFilter === 'today' ? 'bg-white text-black' : 'bg-white/5 text-secondary hover:text-white'}`}
              >
                Today
              </button>
              <button 
                onClick={() => setActiveTimeFilter("week")}
                className={`py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${activeTimeFilter === 'week' ? 'bg-white text-black' : 'bg-white/5 text-secondary hover:text-white'}`}
              >
                Week
              </button>
              <button 
                onClick={() => setActiveTimeFilter("all")}
                className={`py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${activeTimeFilter === 'all' ? 'bg-white text-black' : 'bg-white/5 text-secondary hover:text-white'}`}
              >
                All
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-mono text-secondary/50 uppercase tracking-widest">Filter by</span>
              <div className="space-y-2">
                <FilterCheckbox 
                  label="Contains Email" 
                  checked={filters.hasEmail} 
                  onChange={() => setFilters({...filters, hasEmail: !filters.hasEmail})} 
                />
                <FilterCheckbox 
                  label="Potential Leads" 
                  checked={filters.isLead} 
                  onChange={() => setFilters({...filters, isLead: !filters.isLead})} 
                />
                <FilterCheckbox 
                  label="Asked Pricing" 
                  checked={filters.pricing} 
                  onChange={() => setFilters({...filters, pricing: !filters.pricing})} 
                />
                <FilterCheckbox 
                  label="Long Sessions (10+)" 
                  checked={filters.longSessions} 
                  onChange={() => setFilters({...filters, longSessions: !filters.longSessions})} 
                />
              </div>
            </div>

            <button 
              onClick={exportAllLeads}
              className="mt-2 w-full py-3 bg-accent text-white rounded-xl font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-accent/80 transition-all"
            >
              <Download size={14} /> Export All Leads (CSV)
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 glass rounded-3xl border border-line overflow-hidden flex flex-col">
            <div className="p-4 bg-white/5 border-b border-line flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-display uppercase text-xs">Sessions ({filteredSessions.length})</span>
                <span className="text-[10px] font-mono text-accent animate-pulse">Live Updates</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={14} />
                <input 
                  placeholder="Filter sessions..." 
                  className="w-full bg-white/5 border border-line rounded-lg py-2 pl-9 pr-4 text-[10px] font-mono outline-none focus:border-accent transition-all"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-line scrollbar-thin">
              {filteredSessions.map(session => (
                <div 
                  key={session.id}
                  onClick={() => {
                    setSelectedSessionId(session.id);
                    setIsModalOpen(true);
                  }}
                  className={`p-4 cursor-pointer transition-all hover:bg-white/5 relative group ${selectedSessionId === session.id ? 'bg-accent/5 after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-accent' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        {session.userName || "Anonymous Guest"}
                        {session.isLead && <Flame size={12} className="text-orange-500" fill="currentColor" />}
                      </h3>
                      <p className="text-[10px] text-secondary/60 font-mono truncate max-w-[200px] mt-1 italic">
                        "{session.messages[session.messages.length - 1]?.content || session.messages[session.messages.length - 1]?.text || "No messages"}"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] font-mono text-secondary uppercase tracking-tighter">
                    <span className="flex items-center gap-1"><Clock size={10} /> {formatTimeAgo(session.lastActivity)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><MessageSquare size={10} /> {session.messageCount} msgs</span>
                  </div>
                </div>
              ))}
              {filteredSessions.length === 0 && (
                <div className="p-12 text-center text-secondary font-mono text-xs uppercase opacity-30">
                  No sessions found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Detail View */}
        <div className="flex-1 glass rounded-3xl border border-line h-full flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            {selectedSession ? (
              <motion.div 
                key={selectedSession.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col h-full"
              >
                {/* Detail Header */}
                <div className="p-6 bg-white/5 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                        <User size={20} />
                      </div>
                      <div>
                        <h2 className="text-xl font-display uppercase">{selectedSession.userName || "Anonymous Guest"}</h2>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-secondary uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Mail size={10} /> {selectedSession.userEmail || "No email detected"}</span>
                          <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(selectedSession.lastActivity)}</span>
                          <span className="flex items-center gap-1"><MessageCircle size={10} /> {selectedSession.messageCount} messages</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-mono text-secondary uppercase tracking-widest mb-1">Status</span>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[9px] font-mono text-green-500 uppercase font-bold tracking-tighter">Active</span>
                      </div>
                    </div>
                    {selectedSession.leadScore && (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-mono text-secondary uppercase tracking-widest mb-1">Lead Score</span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={12} className={i <= (selectedSession.leadScore || 0) ? "text-yellow-500 fill-current" : "text-white/10"} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
                  {selectedSession.messages.map((msg, i) => {
                    const isBot = msg.role === 'bot' || msg.role === 'model';
                    const content = msg.content || msg.text || "";
                    
                    // Highlight keywords in user messages
                    const keywords = ['pricing', 'budget', 'timeline', 'hire', 'project', 'expert', 'react', 'firebase'];
                    let highlightedContent: any = [content];
                    
                    if (!isBot) {
                      keywords.forEach(keyword => {
                        const regex = new RegExp(`(${keyword})`, 'gi');
                        const newParts: any[] = [];
                        highlightedContent.forEach((part: any) => {
                          if (typeof part === 'string') {
                            const split = part.split(regex);
                            split.forEach((subPart, j) => {
                              if (subPart.toLowerCase() === keyword.toLowerCase()) {
                                newParts.push(<span key={`${i}-${j}`} className="bg-yellow-500/30 text-yellow-200 border-b border-yellow-500/50 px-0.5">{subPart}</span>);
                              } else if (subPart) {
                                newParts.push(subPart);
                              }
                            });
                          } else {
                            newParts.push(part);
                          }
                        });
                        highlightedContent = newParts;
                      });
                    }

                    return (
                      <div key={i} className={`flex flex-col ${!isBot ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-2 text-[10px] font-mono text-secondary uppercase tracking-widest">
                          {isBot ? <><Bot size={12} className="text-accent" /> <span>System Agent</span></> : <><User size={12} /> <span>User</span></>}
                          <span className="opacity-30 tracking-tighter ml-2">{formatTime(msg.timestamp)}</span>
                        </div>
                        <div className={`max-w-[70%] p-5 rounded-2xl text-sm leading-relaxed ${isBot ? 'bg-white/5 border border-line rounded-tl-none font-light' : 'bg-accent text-white rounded-tr-none font-medium shadow-[0_10px_30px_-10px_rgba(33,150,243,0.3)]'}`}>
                          {isBot ? (
                            content
                          ) : (
                            <div className="flex flex-wrap items-center">{highlightedContent}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Session Actions */}
                <div className="p-6 bg-white/5 border-t border-line flex flex-wrap gap-4 items-center justify-between mt-auto">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => handleMarkLead(selectedSession.id, selectedSession.isLead || false)}
                      className={`px-6 py-2.5 rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all border ${selectedSession.isLead ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/5 border-line text-secondary hover:text-white'}`}
                    >
                      <Star size={14} className={selectedSession.isLead ? "fill-current" : ""} />
                      {selectedSession.isLead ? "Marked as Lead" : "Mark as Lead"}
                    </button>
                    <button 
                      onClick={() => exportChat(selectedSession)}
                      className="px-6 py-2.5 bg-white/5 border border-line text-secondary hover:text-white rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all"
                    >
                      <Download size={14} /> Export Chat
                    </button>
                  </div>
                  <button 
                    onClick={() => handleDelete(selectedSession.id)}
                    className="px-6 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all"
                  >
                    <Trash2 size={14} /> Delete Session
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-white/5 border border-line flex items-center justify-center text-secondary opacity-20">
                  <MessageSquare size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-display uppercase tracking-widest opacity-30">Select a Conversation</h3>
                  <p className="text-xs font-mono text-secondary uppercase tracking-[0.2em] opacity-40">Choose a session from the list to view chat details & leads</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Full Screen Chat Detail Popup */}
      <AnimatePresence>
        {isModalOpen && selectedSession && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl h-[90vh] bg-[#0a0a0a] border border-line rounded-[2rem] overflow-hidden flex flex-col shadow-[0_30px_100px_rgba(0,0,0,1)]"
            >
              {/* Modal Header */}
              <div className="p-6 md:p-8 border-b border-line flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                    <User size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-display uppercase tracking-tight flex items-center gap-3">
                      {selectedSession.userName || "Anonymous Guest"}
                      {selectedSession.isLead && <Flame size={16} className="text-orange-500" fill="currentColor" />}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-secondary uppercase tracking-widest mt-1">
                      <span className="flex items-center gap-1.5"><Mail size={12} /> {selectedSession.userEmail || "No documented email"}</span>
                      <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(selectedSession.lastActivity)}</span>
                      <span className="flex items-center gap-1.5"><MessageCircle size={12} /> {selectedSession.messageCount} messages</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-10 h-10 rounded-full border border-line flex items-center justify-center hover:bg-white/10 transition-all text-secondary hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Messages Feed */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scrollbar-thin">
                {selectedSession.messages.map((msg, i) => {
                  const isBot = msg.role === 'bot' || msg.role === 'model';
                  const content = msg.content || msg.text || "";
                  
                  return (
                    <div key={i} className={`flex flex-col ${!isBot ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`} style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className="flex items-center gap-2 mb-2 text-[10px] font-mono text-secondary uppercase tracking-widest">
                        {isBot ? <><Bot size={12} className="text-accent" /> <span>AI Agent</span></> : <><User size={12} /> <span>Customer</span></>}
                        <span className="opacity-30 tracking-tighter ml-2">
                          {formatDate(msg.timestamp)} • {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <div className={`max-w-[85%] md:max-w-[70%] p-6 rounded-3xl text-sm md:text-base leading-relaxed ${isBot ? 'bg-white/5 border border-line rounded-tl-none font-light' : 'bg-accent text-white rounded-tr-none font-medium shadow-[0_10px_40px_-10px_rgba(33,150,243,0.4)]'}`}>
                        {content}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer Actions */}
              <div className="p-6 md:p-8 bg-black border-t border-line flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleMarkLead(selectedSession.id, selectedSession.isLead || false)}
                    className={`px-8 py-3 rounded-full font-mono text-[11px] uppercase tracking-widest flex items-center gap-2.5 transition-all border ${selectedSession.isLead ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-white/5 border-line text-secondary hover:text-white'}`}
                  >
                    <Star size={16} className={selectedSession.isLead ? "fill-current" : ""} />
                    {selectedSession.isLead ? "Verified Lead" : "Tag as Lead"}
                  </button>
                  <button 
                    onClick={() => exportChat(selectedSession)}
                    className="px-8 py-3 bg-white/5 border border-line text-secondary hover:text-white rounded-full font-mono text-[11px] uppercase tracking-widest flex items-center gap-2.5 transition-all"
                  >
                    <Download size={16} /> Export Logs
                  </button>
                </div>
                <button 
                  onClick={() => handleDelete(selectedSession.id)}
                  className="px-8 py-3 bg-red-500/5 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-full font-mono text-[11px] uppercase tracking-widest flex items-center gap-2.5 transition-all"
                >
                  <Trash2 size={16} /> Purge History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, icon, subtitle }: { title: string; value: string | number; icon: React.ReactNode; subtitle?: string }) {
  return (
    <div className="glass p-6 rounded-3xl border border-line flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase text-secondary tracking-widest">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">{icon}</div>
      </div>
      <div>
        <div className="text-3xl font-display uppercase">{value}</div>
        {subtitle && <div className="text-[9px] font-mono text-secondary uppercase tracking-tighter mt-1 opacity-60">{subtitle}</div>}
      </div>
    </div>
  );
}

function FilterCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div 
        onClick={onChange}
        className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${checked ? 'bg-accent border-accent' : 'border-line group-hover:border-accent/50'}`}
      >
        {checked && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
      <span className={`text-[11px] font-mono uppercase tracking-widest transition-all ${checked ? 'text-white' : 'text-secondary group-hover:text-white'}`}>{label}</span>
      <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
    </label>
  );
}
