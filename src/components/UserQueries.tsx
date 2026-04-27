import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api";
import { MessageSquare, Send, Clock, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { auth, onAuthStateChanged } from "../firebase";
import Auth from "./Auth";

interface Query {
  id: string;
  subject: string;
  message: string;
  read: boolean;
  reply?: string;
  timestamp: string;
  repliedAt?: string;
  userEmail: string;
}

export default function UserQueries() {
  const [user, setUser] = useState<any>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const fetchQueries = async (email: string) => {
    try {
      const data = await api.get("contactMessages");
      if (data) {
        const userQueries = data.filter((q: any) => q.userEmail === email);
        setQueries(userQueries.sort((a: any, b: any) => {
          const tsA = a.timestamp as any;
          const tsB = b.timestamp as any;
          const timeA = tsA?.seconds ? tsA.seconds * 1000 : new Date(a.timestamp || 0).getTime();
          const timeB = tsB?.seconds ? tsB.seconds * 1000 : new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
        }));
      }
    } catch (error) {
      console.error("Failed to fetch queries:", error);
    }
  };

  useEffect(() => {
    if (!user?.email) return;
    fetchQueries(user.email);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await api.post("contactMessages", {
        userId: user.uid,
        userName: user.displayName || user.email.split("@")[0],
        userEmail: user.email,
        subject,
        message,
        read: false,
        timestamp: new Date().toISOString()
      });
      setSubject("");
      setMessage("");
      
      if (user.email) await fetchQueries(user.email);
    } catch (error) {
      console.error("Failed to submit query:", error);
    } finally {
      setLoading(false);
    }
  };


  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Auth />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-4xl font-display uppercase mb-4">Your Queries</h2>
        <p className="text-secondary font-mono text-xs uppercase tracking-widest">
          Submit a query or view your conversation history
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Submit Query Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass p-8 rounded-3xl border border-line h-fit"
        >
          <h3 className="text-xl font-display uppercase mb-6 flex items-center gap-3">
            <MessageSquare size={20} className="text-accent" /> New Query
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono text-secondary uppercase tracking-widest mb-2">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What is your query about?"
                className="w-full bg-white/5 border border-line rounded-xl py-3 px-4 focus:outline-none focus:border-accent transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-secondary uppercase tracking-widest mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your query in detail..."
                rows={5}
                className="w-full bg-white/5 border border-line rounded-xl py-3 px-4 focus:outline-none focus:border-accent transition-colors resize-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-white text-black font-display uppercase tracking-widest text-sm rounded-xl hover:bg-accent hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Sending..." : (
                <>
                  Send Query <Send size={16} />
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Query History */}
        <div className="space-y-4">
          <h3 className="text-xl font-display uppercase mb-6 px-2">History</h3>
          {queries.length === 0 ? (
            <div className="text-center py-12 glass rounded-3xl border border-line">
              <p className="text-secondary font-mono text-xs uppercase">No queries found</p>
            </div>
          ) : (
            queries.map((q) => (
              <motion.div
                key={q.id}
                layout
                className={`glass rounded-2xl border border-line overflow-hidden transition-all ${expandedId === q.id ? 'ring-1 ring-accent' : ''}`}
              >
                <div 
                  className="p-6 cursor-pointer flex items-center justify-between"
                  onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${q.reply ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                      {q.reply ? <CheckCircle size={20} /> : <Clock size={20} />}
                    </div>
                    <div>
                      <h4 className="font-display uppercase text-sm">{q.subject}</h4>
                      <p className="text-[10px] font-mono text-secondary uppercase tracking-widest">
                        {(() => {
                          const ts = q.timestamp as any;
                          if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
                          return new Date(q.timestamp || 0).toLocaleDateString();
                        })()}
                      </p>
                    </div>
                  </div>
                  {expandedId === q.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                <AnimatePresence>
                  {expandedId === q.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-6 pb-6 border-t border-line pt-6"
                    >
                      <div className="mb-6">
                        <span className="text-[10px] font-mono text-accent uppercase tracking-widest block mb-2">Your Message</span>
                        <p className="text-secondary text-sm leading-relaxed">{q.message}</p>
                      </div>

                      {q.reply && (
                        <div className="bg-white/5 p-4 rounded-xl border border-line">
                          <span className="text-[10px] font-mono text-green-500 uppercase tracking-widest block mb-2">Admin Reply</span>
                          <p className="text-white text-sm leading-relaxed">{q.reply}</p>
                          {q.repliedAt && (
                            <span className="text-[10px] font-mono text-secondary uppercase mt-4 block">
                              Replied on {new Date(q.repliedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
