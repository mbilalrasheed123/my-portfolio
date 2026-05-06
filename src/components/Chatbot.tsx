import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, X, Send, Bot, User, Minimize2, Maximize2, History, Trash2, ArrowLeft } from "lucide-react";
import Markdown from "react-markdown";
import { auth, onAuthStateChanged } from "../firebase";
import { api } from "../lib/api";
import { trackClick } from "../lib/analytics";
import { handleAnalyticsQuery } from "../lib/chatbot-analytics";

import { GoogleGenAI } from "@google/genai";

const BASE_SYSTEM_INSTRUCTION = `You are a professional AI assistant for **Muhammad Bilal Rasheed**. 
CORE DIRECTIVES:
1. Be Concise and professional.
2. website context: You are on Bilal's official portfolio.
3. PROACTIVE LEAD COLLECTION: If the user is interested in hiring, collect: Name, Email, Phone, Project Description.

OUTPUT FORMAT: You must output valid JSON with this schema:
{
  "reply": "your text response",
  "isLeadDetected": boolean,
  "leadInfo": { "name": "...", "email": "...", "phone": "...", "description": "..." }
}`;

interface Message {
  role: "user" | "model";
  text: string;
  timestamp: string;
}

interface ChatSession {
  id?: string;
  userId: string;
  userName: string;
  isGuest: boolean;
  messages: Message[];
  createdAt: any;
}

interface ChatbotProps {
  userId?: string;
}

export default function Chatbot({ userId }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<any>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([]);
  const [kbContent, setKbContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      const kb = await api.fetchKnowledgeBase(userId, true);
      if (kb && kb.length > 0) {
        const context = kb.map(entry => `[${entry.category}] ${entry.title}: ${entry.content}`).join("\n\n");
        setKbContent(context);
      }
      const s = await api.getSettings(userId);
      setSettings(s || {});
    };
    fetchData();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      loadHistory(u);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (messages.length === 0) {
      const name = settings.name || "the developer";
      setMessages([
        { role: "model", text: `Hello! Welcome to ${name}'s portfolio. I’m here to help you explore their work and expertise. How can I assist you today?`, timestamp: new Date().toISOString() }
      ]);
    }
  }, [settings]);

  useEffect(() => {
    if (scrollRef.current && isOpen && !isMinimized) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth"
          });
        }
      }, 100);
    }
  }, [messages, isLoading, isOpen, isMinimized]);

  const loadHistory = async (u: any) => {
    if (u) {
      const sessions = await api.fetchChatSessions(u.uid);
      setPastSessions(sessions as ChatSession[]);
    } else {
      const local = localStorage.getItem("guest_chat_history");
      if (local) {
        setPastSessions(JSON.parse(local));
      }
    }
  };

  const createNewSession = async () => {
    const name = settings.name || "the developer";
    const newSession: ChatSession = {
      userId: user?.uid || "guest",
      userName: user?.displayName || "Guest",
      isGuest: !user,
      messages: [{ role: "model", text: `Hello! Welcome to ${name}'s portfolio. I’m here to help you explore their work and expertise. How can I assist you today?`, timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };
    
    if (user) {
      const id = await api.saveChatSession(newSession);
      newSession.id = id;
    }
    
    setSession(newSession);
    setMessages(newSession.messages);
    setShowHistory(false);
  };

  const saveCurrentSession = async (updatedMessages: Message[]) => {
    if (!session) return;
    
    const updated = { ...session, messages: updatedMessages };
    setSession(updated);

    if (user) {
      await api.saveChatSession(updated);
    } else {
      // For guests, we save a single current session or a list in localStorage
      const guestSessions = [updated];
      localStorage.setItem("guest_chat_history", JSON.stringify(guestSessions));
      setPastSessions(guestSessions);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!session) {
      await createNewSession();
    }

    trackClick('chatbot-send-message');

    const userMsg: Message = { role: "user", text: input.trim(), timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    
    setInput("");
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // 1. Get API Key from environment
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        const errorMsg: Message = { 
          role: "model", 
          text: "My apologies, but I'm currently unable to connect to the AI service. Please try again in a few minutes.", 
          timestamp: new Date().toISOString() 
        };
        setMessages(prev => [...prev, errorMsg]);
        setIsLoading(false);
        return;
      }

      // 2. Intelligence Queries (Admin)
      const messageLower = input.toLowerCase();
      const analyticsKeywords = ['visitor', 'traffic', 'analytics', 'page', 'device', 'click', 'report', 'stats', 'popular', 'intelligence'];
      const isAnalyticsQuery = analyticsKeywords.some(keyword => messageLower.includes(keyword));
      
      if (isAnalyticsQuery && auth.currentUser?.email === 'muhammadbilalrasheed78@gmail.com') {
        const analyticsResponse = await handleAnalyticsQuery(auth.currentUser?.email || undefined, input);
        const modelMsg: Message = { role: "model", text: analyticsResponse, timestamp: new Date().toISOString() };
        const finalMessages = [...newMessages, modelMsg];
        setMessages(finalMessages);
        saveCurrentSession(finalMessages);
        setIsLoading(false);
        return;
      }

      // 3. Normal Chat Implementation
      const name = settings.name || "Bilal";
      const personalContext = `NAME: ${name}
ABOUT: ${settings.aboutText || "Professional Developer."}
CONTEXT: ${kbContent || "No additional personal knowledge base entries provided."}`;

      const ai = new GoogleGenAI({ apiKey });
      
      const contents = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      contents.push({
        role: "user",
        parts: [{ text: input.trim() }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
          systemInstruction: BASE_SYSTEM_INSTRUCTION + "\n\n" + personalContext,
          responseMimeType: "application/json",
        }
      });

      if (!response.text) {
        throw new Error("Empty response from AI");
      }

      let modelData;
      try {
        modelData = JSON.parse(response.text.trim());
      } catch (e) {
        modelData = { reply: response.text, isLeadDetected: false };
      }

      const modelText = modelData.reply || "I'm sorry, I couldn't process that.";
      const modelMsg: Message = { role: "model", text: modelText, timestamp: new Date().toISOString() };
      
      const finalMessages = [...newMessages, modelMsg];
      setMessages(finalMessages);
      saveCurrentSession(finalMessages);

      if (modelData.isLeadDetected && modelData.leadInfo) {
        trackClick('chatbot-lead-detected');
        api.saveLead({
          ...modelData.leadInfo,
          userId: userId || 'guest',
          chatId: session?.id || 'none'
        }).catch(err => console.error("Lead saving failed:", err));
      }

    } catch (error: any) {
      console.error("Chatbot error:", error);
      
      const errorMsg: Message = { role: "model", text: "I'm a bit busy right now. Could you please try again in a moment?", timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectSession = (s: ChatSession) => {
    setSession(s);
    setMessages(s.messages);
    setShowHistory(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50, transformOrigin: "bottom right" }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? "64px" : "min(600px, 85vh)",
              width: "min(400px, 90vw)"
            }}
            exit={{ opacity: 0, scale: 0.5, y: 50, transformOrigin: "bottom right" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col mb-4 origin-bottom-right"
          >
            {/* Header */}
            <div className="p-4 bg-white/5 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                  <Bot size={22} className="text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-display uppercase tracking-wider">{settings.name || "Bilal"}'s AI Agent</h4>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">Active Now</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-secondary"
                  title="Chat History"
                >
                  <History size={18} />
                </button>
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-secondary"
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-secondary"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <div className="flex-1 flex flex-col relative overflow-hidden min-h-0">
                <AnimatePresence mode="wait">
                  {showHistory ? (
                    <motion.div
                      key="history"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      className="absolute inset-0 bg-black z-20 p-6 overflow-y-auto"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-display uppercase text-sm tracking-widest text-secondary">Past Conversations</h3>
                        <button 
                          onClick={() => createNewSession()}
                          className="text-xs font-mono text-accent uppercase hover:underline"
                        >
                          New Chat
                        </button>
                      </div>
                      
                      <div className="space-y-3 pb-4">
                        {pastSessions.length > 0 ? pastSessions.map((s, i) => (
                          <div 
                            key={i}
                            onClick={() => selectSession(s)}
                            className="p-4 rounded-2xl border border-line bg-white/5 hover:bg-white/10 cursor-pointer transition-all group"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-[10px] font-mono text-secondary uppercase">
                                {new Date(s.createdAt).toLocaleDateString()}
                              </span>
                              <span className="text-[10px] font-mono text-accent uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                View →
                              </span>
                            </div>
                            <p className="text-xs text-secondary line-clamp-2 italic">
                              "{s.messages[s.messages.length - 1]?.text || 'No messages'}"
                            </p>
                          </div>
                        )) : (
                          <div className="text-center py-12 text-secondary opacity-50">
                            <History size={32} className="mx-auto mb-4 opacity-20" />
                            <p className="text-sm">No past conversations found.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="chat"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col h-full overflow-hidden"
                    >
                      {/* Messages Area - This should be the only scrolling part */}
                      <div 
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scroll-smooth"
                      >
                        {messages.map((msg, i) => (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            key={i}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-2`}
                          >
                            <div className={`relative max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                              msg.role === "user" 
                                ? "bg-[#00ffa3] text-black font-semibold rounded-br-none shadow-[0_10px_25px_-5px_rgba(0,255,163,0.4)]" 
                                : "bg-white/5 text-white/90 border border-white/10 rounded-bl-none font-medium backdrop-blur-sm"
                            }`}>
                              <div className="markdown-body">
                                <Markdown>{msg.text}</Markdown>
                              </div>
                              <span className="absolute -bottom-5 left-0 right-0 text-[9px] font-mono opacity-30 text-center uppercase tracking-tighter">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-bl-none flex gap-1.5 backdrop-blur-sm">
                              <div className="w-1.5 h-1.5 bg-[#00ffa3] rounded-full animate-bounce [animation-duration:0.6s]" />
                              <div className="w-1.5 h-1.5 bg-[#00ffa3] rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.1s]" />
                              <div className="w-1.5 h-1.5 bg-[#00ffa3] rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.2s]" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Input Area - Fixed at bottom of this container */}
                      <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-md mt-auto">
                        <div className="relative group">
                          <input
                            type="text"
                            placeholder="Ask about web design, projects, or hiring Bilal..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            className="w-full bg-black/60 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-sm focus:outline-none focus:border-[#00ffa3] focus:ring-1 focus:ring-[#00ffa3]/20 transition-all shadow-inner text-white"
                          />
                          <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            title="Send Message"
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[#00ffa3] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 shadow-[0_0_15px_rgba(0,255,163,0.3)] z-10"
                          >
                            <Send size={18} />
                          </button>
                        </div>
                        <p className="mt-2 text-[9px] text-center text-secondary font-mono uppercase tracking-widest opacity-40">
                          ai agent powered by bilal's tech
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => {
              setIsOpen(true);
              trackClick('chatbot-open');
            }}
            className="w-16 h-16 rounded-full bg-accent text-white shadow-2xl flex items-center justify-center hover:shadow-accent/40 transition-all border-4 border-black group"
          >
            <Bot size={32} className="group-hover:rotate-12 transition-transform" />
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-black"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
