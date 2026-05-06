import React, { useState, useEffect } from "react";
import { Plus, Trash2, Shield, AlertCircle, CheckCircle, Clock, RefreshCcw, Lock, Key as KeyIcon, Eye, EyeOff, BarChart3, Bot, RotateCcw } from "lucide-react";
import { db } from "../firebase";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";

interface ApiKeyDoc {
  id: string;
  name: string;
  key: string;
  quota: {
    rpmUsed: number;
    rpdUsed: number;
    lastUsed: Timestamp;
  };
  status: 'active' | 'exhausted' | 'disabled';
  priority: number;
  updatedAt: Timestamp;
}

export default function KeyManager() {
  const [keys, setKeys] = useState<ApiKeyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showRawKeys, setShowRawKeys] = useState<Record<string, boolean>>({});

  // Form states
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newPriority, setNewPriority] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "apiKeys"), orderBy("priority", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const keysData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ApiKeyDoc[];
      setKeys(keysData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newKey) return;
    setIsSubmitting(true);

    try {
      // 1. Encrypt key via backend helper
      const encryptRes = await fetch("/api/admin/encrypt-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey })
      });
      const { encrypted } = await encryptRes.json();

      // 2. Save to Firestore
      await addDoc(collection(db, "apiKeys"), {
        name: newName,
        key: encrypted,
        status: "active",
        priority: Number(newPriority),
        quota: {
          rpmUsed: 0,
          rpdUsed: 0,
          lastUsed: serverTimestamp()
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setNewName("");
      setNewKey("");
      setNewPriority(1);
      setIsAdding(false);
    } catch (error) {
      console.error("Failed to add key:", error);
      alert("Failed to add key. Check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (key: ApiKeyDoc) => {
    const newStatus = key.status === "disabled" ? "active" : "disabled";
    await updateDoc(doc(db, "apiKeys", key.id), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this API key? Rotation will be affected.")) {
      await deleteDoc(doc(db, "apiKeys", id));
    }
  };

  const handleResetUsage = async (id: string) => {
    await updateDoc(doc(db, "apiKeys", id), {
      "quota.rpmUsed": 0,
      "quota.rpdUsed": 0,
      "quota.lastUsed": serverTimestamp(),
      status: "active",
      updatedAt: serverTimestamp()
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><CheckCircle size={10} /> Active</span>;
      case "exhausted":
        return <span className="px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><AlertCircle size={10} /> Exhausted</span>;
      case "disabled":
        return <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><Shield size={10} /> Disabled</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-2 border-[#00ffa3] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-secondary font-mono text-sm uppercase tracking-widest">Loading Rotation State...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-3xl font-sans font-bold tracking-tight text-white mb-2">API Key Rotation</h2>
          <p className="text-secondary font-mono text-xs uppercase tracking-widest leading-relaxed">
            Manage your Google AI Studio keys. Serverless rotation happens every 15 RPM.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-2 bg-[#00ffa3] text-black rounded-full font-mono text-[10px] uppercase font-bold tracking-widest hover:scale-105 transition-all"
        >
          <Plus size={14} /> Add Key
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-12 p-8 border border-[#00ffa3]/20 bg-black/40 backdrop-blur-xl rounded-2xl"
          >
            <form onSubmit={handleAddKey} className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#00ffa3] mb-2">Key Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Gemini Pro Key 1"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00ffa3] outline-none transition-all"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#00ffa3] mb-2">API Key (Plaintext)</label>
                <div className="relative">
                  <input
                    type="password"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00ffa3] outline-none transition-all font-mono"
                    required
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                </div>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#00ffa3] mb-2">Priority</label>
                <input
                  type="number"
                  value={newPriority}
                  onChange={(e) => setNewPriority(Number(e.target.value))}
                  min="1"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00ffa3] outline-none transition-all"
                  required
                />
              </div>
              <div className="md:col-span-4 flex justify-end gap-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-2 border border-white/10 text-secondary rounded-full font-mono text-[10px] uppercase font-bold tracking-widest hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2 bg-white text-black rounded-full font-mono text-[10px] uppercase font-bold tracking-widest hover:scale-105 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? "Encrypting..." : "Add to Rotation"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6">
        {keys.map((key) => {
          const quota = key.quota || { rpmUsed: 0, rpdUsed: 0, lastUsed: null };
          const rpmUsed = quota.rpmUsed || 0;
          const rpdUsed = quota.rpdUsed || 0;
          const rpmPercent = Math.min((rpmUsed / 15) * 100, 100);
          const rpdPercent = Math.min((rpdUsed / 1500) * 100, 100);
          const lastUsed = quota.lastUsed ? (quota.lastUsed as any).toDate?.().toLocaleString() : null;

          return (
            <motion.div
              layout
              key={key.id}
              className="p-6 border border-white/10 bg-black/20 rounded-2xl group hover:border-[#00ffa3]/30 transition-all"
            >
              <div className="flex flex-wrap justify-between items-start gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <h3 className="text-xl font-sans font-bold text-white uppercase tracking-tight">{key.name}</h3>
                    {getStatusBadge(key.status)}
                    <span className="font-mono text-[9px] text-zinc-500 uppercase">Priority: {key.priority}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 font-mono text-[11px] text-secondary mb-6 bg-white/5 p-3 rounded-xl">
                    <KeyIcon size={14} className="text-[#00ffa3]" />
                    <span className="truncate max-w-[200px]">{showRawKeys[key.id] ? "Decryption happens on server only" : "••••••••••••••••••••••••"}</span>
                    <button onClick={() => setShowRawKeys(prev => ({ ...prev, [key.id]: !prev[key.id] }))}>
                      {showRawKeys[key.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-secondary flex items-center gap-2">
                          <RefreshCcw size={10} /> RPM Usage (15)
                        </span>
                        <span className="font-mono text-[10px] text-white">{rpmUsed}/15</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${rpmPercent}%` }}
                          className={`h-full ${rpmPercent > 80 ? 'bg-orange-500' : 'bg-[#00ffa3]'}`}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-secondary flex items-center gap-2">
                          <BarChart3 size={10} /> RPD Usage (1500)
                        </span>
                        <span className="font-mono text-[10px] text-white">{rpdUsed}/1500</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${rpdPercent}%` }}
                          className={`h-full ${rpdPercent > 80 ? 'bg-orange-500' : 'bg-white'}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between gap-6">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResetUsage(key.id)}
                      className="p-3 bg-white/5 rounded-xl hover:bg-white/10 text-secondary hover:text-white transition-all"
                      title="Reset Usage"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      onClick={() => toggleStatus(key)}
                      className={`p-3 rounded-xl transition-all ${key.status === 'disabled' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}
                      title={key.status === 'disabled' ? 'Enable' : 'Disable'}
                    >
                      <Shield size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(key.id)}
                      className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"
                      title="Delete Key"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[9px] text-zinc-600 uppercase tracking-tighter">Last used:</p>
                    <p className="font-mono text-[10px] text-secondary">{lastUsed || "Never"}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {keys.length === 0 && !loading && (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
            <Bot size={40} className="mx-auto text-zinc-700 mb-4" />
            <p className="text-secondary font-mono text-sm uppercase tracking-widest">No API Keys Configured</p>
            <p className="text-zinc-600 font-mono text-[10px] mt-2">Add your first Gemini API key to start rotation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
