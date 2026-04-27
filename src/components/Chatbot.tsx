import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, X, Send, Bot, User, Minimize2, Maximize2 } from "lucide-react";
import Markdown from "react-markdown";

const SYSTEM_INSTRUCTION = `You are a professional AI assistant for **Muhammad Bilal Rasheed**. 

**CORE DIRECTIVES:**
1. **Be Concise:** Keep responses extremely short. Maximum 1-2 short paragraphs.
2. **Website Context:** You explicitly know all sections of this portfolio: Navbar, Hero, About, Skills, Projects, Certificates, Contact, and Admin Panel.
3. **Greetings:** If a user says "hi", "hello", or greets you, respond ONLY with: "Hello! Welcome to Muhammad Bilal Rasheed's portfolio. I’m here to help you explore his work and expertise. How can I assist you today?"
4. **Brevity & Professionalism:** Always maintain a professional tone and prioritize brevity.

**ABOUT BILAL:**
CS student from Multan, Pakistan. Specialist in WordPress, Frontend, and Vibe Coding.

**TECHNICAL SKILLS:**
- WordPress (Themes, Elementor, WooCommerce, SEO).
- Frontend (HTML5, CSS3, JS, Bootstrap).
- Vibe Coding (AI-assisted development).

Politely redirect non-professional questions. Respond in English.`;

interface Message {
  role: "user" | "model";
  text: string;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", text: "Hello! Welcome to Muhammad Bilal Rasheed's portfolio. I’m here to help you explore his work and expertise. How can I assist you today?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          messages: messages.slice(1), // Exclude the initial welcome message from history
          systemInstruction: SYSTEM_INSTRUCTION
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get AI response");
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: "model", text: data.text || "I'm sorry, I couldn't process that." }]);
    } catch (error: any) {
      console.error("Chatbot error:", error);
      let errorMessage = "Sorry, I'm having some trouble connecting right now. Please try again later.";
      if (error.message?.includes("API key")) {
        errorMessage = "The Chatbot API key is not configured correctly on the server. Please add GEMINI_API_KEY to your environment variables.";
      }
      setMessages(prev => [...prev, { role: "model", text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? "64px" : "500px",
              width: "350px"
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-black border border-line rounded-3xl shadow-2xl overflow-hidden flex flex-col mb-4"
          >
            {/* Header */}
            <div className="p-4 bg-white/5 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-display uppercase tracking-wider">Professional Assistant</h4>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
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

            {/* Messages */}
            {!isMinimized && (
              <>
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
                      <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                        msg.role === "user" 
                          ? "bg-accent text-white rounded-tr-none" 
                          : "bg-white/5 text-secondary border border-line rounded-tl-none"
                      }`}>
                        <div className="markdown-body prose prose-invert prose-sm max-w-none">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 border border-line p-3 rounded-2xl rounded-tl-none flex gap-1">
                        <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-line bg-white/5">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ask about Bilal's skills or projects..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      className="w-full bg-black border border-line rounded-full py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50 disabled:scale-100"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className={`w-14 h-14 rounded-full bg-accent text-white shadow-2xl flex items-center justify-center transition-all ${
          isOpen ? "opacity-0 pointer-events-none scale-0" : "opacity-100 scale-100"
        }`}
      >
        <Bot size={28} />
      </motion.button>
    </div>
  );
}
