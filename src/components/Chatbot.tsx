import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, X, Send, Bot, User, Minimize2, Maximize2, History, Trash2, ArrowLeft } from "lucide-react";
import Markdown from "react-markdown";
import { GoogleGenAI, Type } from "@google/genai";
import { auth, onAuthStateChanged } from "../firebase";
import { api } from "../lib/api";

const SYSTEM_INSTRUCTION = `You are a professional AI assistant for **Muhammad Bilal Rasheed**. 

**CORE DIRECTIVES:**
1. **Be Concise:** Keep responses short and professional.
2. **Website Context:** You know all sections: Navbar, Hero, About, Skills, Projects, Certificates, Contact, and Admin.
3. **Greetings:** Standard welcome message for first greets.
4. **Lead Detection:** If the user expresses interest in web design, development, or hiring Bilal, NATURALLY suggest connecting. 
5. **Collection of Info:** If they are interested, you MUST ask for their: Name, Email, Phone, and Project Description.
6. **Triggering Lead Save:** Once you have ALL 4 pieces of information (Name, Email, Phone, Description), you must confirm you've received it and clearly state that Bilal will follow up soon.

**ABOUT BILAL:**
CS student from Multan, Pakistan. Specialist in WordPress, Frontend, and Vibe Coding.`;

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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", text: "Hello! Welcome to Muhammad Bilal Rasheed's portfolio. I’m here to help you explore his work and expertise. How can I assist you today?", timestamp: new Date().toISOString() }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      loadHistory(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

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
    const newSession: ChatSession = {
      userId: user?.uid || "guest",
      userName: user?.displayName || "Guest",
      isGuest: !user,
      messages: [{ role: "model", text: "Hello! Welcome to Muhammad Bilal Rasheed's portfolio. I’m here to help you explore his work and expertise. How can I assist you today?", timestamp: new Date().toISOString() }],
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

    // Ensure session exists
    if (!session) {
      await createNewSession();
    }

    const userMsg: Message = { role: "user", text: input.trim(), timestamp: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    
    setInput("");
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const historyForAI = newMessages.slice(1).map(m => ({ 
        role: m.role as "user" | "model", 
        parts: [{ text: m.text }] 
      }));

      // Lead detection logic
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...historyForAI
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              isLeadDetected: { type: Type.BOOLEAN },
              leadInfo: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  email: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            }
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      const modelText = data.reply || "I'm sorry, I couldn't process that.";
      const modelMsg: Message = { role: "model", text: modelText, timestamp: new Date().toISOString() };
      
      const finalMessages = [...newMessages, modelMsg];
      setMessages(finalMessages);
      saveCurrentSession(finalMessages);

      if (data.isLeadDetected && data.leadInfo?.name && data.leadInfo?.email) {
        await api.saveLead({
          ...data.leadInfo,
          source: "chatbot",
          userId: user?.uid || "guest"
        });
        // Also notify via existing simulation
        api.notify({ type: "lead", ...data.leadInfo });
      }

    } catch (error: any) {
      console.error("Chatbot error:", error);
      const errorMsg: Message = { role: "model", text: "Something went wrong. Let's try that again.", timestamp: new Date().toISOString() };
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
            layoutId="chat-panel"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? "64px" : "600px",
              width: "400px"
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-black border border-line rounded-3xl shadow-2xl overflow-hidden flex flex-col mb-4"
          >
            {/* Header */}
            <div className="p-4 bg-white/5 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                  <Bot size={22} className="text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-display uppercase tracking-wider">Bilal's AI Agent</h4>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">Active Ahora</span>
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
              <div className="flex-1 flex flex-col relative overflow-hidden">
                <AnimatePresence mode="wait">
                  {showHistory ? (
                    <motion.div
                      key="history"
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      className="absolute inset-0 bg-black z-10 p-6 overflow-y-auto"
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
                      
                      <div className="space-y-3">
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
                      className="flex-1 flex flex-col"
                    >
                      {/* Messages Area */}
                      <div 
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-line"
                      >
                        {messages.map((msg, i) => (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={i}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                              msg.role === "user" 
                                ? "bg-accent text-white rounded-tr-none shadow-lg shadow-accent/20" 
                                : "bg-white/5 text-secondary border border-line rounded-tl-none font-medium"
                            }`}>
                              <Markdown>{msg.text}</Markdown>
                            </div>
                          </motion.div>
                        ))}
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white/5 border border-line p-4 rounded-2xl rounded-tl-none flex gap-1.5">
                              <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                              <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.2s]" />
                              <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Input Area */}
                      <div className="p-4 border-t border-line bg-white/5">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Need a website? Ask Bilal..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            className="w-full bg-black border border-line rounded-full py-4 pl-6 pr-14 text-sm focus:outline-none focus:border-accent transition-all shadow-inner"
                          />
                          <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                          >
                            <Send size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.button
            layoutId="chat-panel"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
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
