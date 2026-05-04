import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Trash2, Key, RotateCcw, ShieldCheck, AlertCircle, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  requestsThisMinute: number;
  requestsToday: number;
  status: 'active' | 'exhausted';
  priority: number;
  lastResetMinute?: any;
  lastResetDay?: any;
}

export default function KeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', rawKey: '', priority: 1 });
  const [encrypting, setEncrypting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'apiKeys'), orderBy('priority', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const keysData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApiKey));
      setKeys(keysData);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleAddKey = async () => {
    if (!newKey.name || !newKey.rawKey) {
      setError('Name and Key are required');
      return;
    }

    setEncrypting(true);
    setError('');

    try {
      // Step 1: Encrypt the key via server to keep secret hidden
      const response = await fetch('/api/admin/encrypt-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey.rawKey })
      });

      if (!response.ok) throw new Error('Encryption failed');
      const { encrypted } = await response.json();

      // Step 2: Save to Firestore
      await addDoc(collection(db, 'apiKeys'), {
        name: newKey.name,
        key: encrypted,
        priority: Number(newKey.priority),
        requestsThisMinute: 0,
        requestsToday: 0,
        status: 'active',
        lastResetMinute: serverTimestamp(),
        lastResetDay: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setNewKey({ name: '', rawKey: '', priority: (keys.length + 2) });
      setIsAdding(false);
    } catch (err: any) {
      setError(err.message || 'Failed to add key');
    } finally {
      setEncrypting(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (confirm('Are you sure you want to delete this API key?')) {
      await deleteDoc(doc(db, 'apiKeys', id));
    }
  };

  const toggleStatus = async (key: ApiKey) => {
    const newStatus = key.status === 'active' ? 'exhausted' : 'active';
    await updateDoc(doc(db, 'apiKeys', key.id), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
  };

  if (loading) return <div className="p-8 text-center animate-pulse font-mono text-xs uppercase tracking-widest text-secondary">Loading Quota System...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display uppercase tracking-wider text-white flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-accent" />
            API Key Rotation
          </h2>
          <p className="text-secondary font-mono text-[10px] uppercase tracking-widest mt-1">
            Managing {keys.length} Gemini Free Tier Keys
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent border border-accent/20 rounded-full font-mono text-[10px] uppercase tracking-widest hover:bg-accent hover:text-black transition-all"
        >
          <Plus className="w-4 h-4" />
          {isAdding ? 'Cancel' : 'Add New Key'}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass p-6 rounded-2xl border border-accent/20 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block font-mono text-[10px] uppercase text-secondary">Key Label</label>
                  <input
                    type="text"
                    value={newKey.name}
                    onChange={e => setNewKey({ ...newKey, name: e.target.value })}
                    placeholder="e.g. Gemini 1"
                    className="w-full bg-black border border-line rounded-lg px-4 py-2 text-sm focus:border-accent outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block font-mono text-[10px] uppercase text-secondary">API Key (Plain)</label>
                  <input
                    type="password"
                    value={newKey.rawKey}
                    onChange={e => setNewKey({ ...newKey, rawKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full bg-black border border-line rounded-lg px-4 py-2 text-sm focus:border-accent outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block font-mono text-[10px] uppercase text-secondary">Priority</label>
                  <input
                    type="number"
                    value={newKey.priority}
                    onChange={e => setNewKey({ ...newKey, priority: Number(e.target.value) })}
                    className="w-full bg-black border border-line rounded-lg px-4 py-2 text-sm focus:border-accent outline-none transition-all"
                  />
                </div>
              </div>
              
              {error && (
                <div className="flex items-center gap-2 text-red-500 font-mono text-[10px] py-1">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  disabled={encrypting}
                  onClick={handleAddKey}
                  className="px-6 py-2 bg-accent text-black rounded-lg font-mono text-[10px] uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  {encrypting ? 'Encrypting...' : <><ShieldCheck className="w-4 h-4" /> Secure & Register Key</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
        {keys.map((key, idx) => (
          <div key={key.id} className={`glass p-5 rounded-2xl border ${key.status === 'exhausted' ? 'border-red-500/20 opacity-60' : 'border-line'} hover:border-accent/30 transition-all group`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${key.status === 'active' ? 'bg-accent/10' : 'bg-red-500/10'}`}>
                  <Key className={`w-5 h-5 ${key.status === 'active' ? 'text-accent' : 'text-red-500'}`} />
                </div>
                <div>
                  <h3 className="font-display text-lg leading-none">{key.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-mono uppercase tracking-tighter text-secondary">Priority {key.priority}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-tighter ${key.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {key.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-12">
                <div className="text-center">
                  <div className="text-secondary font-mono text-[8px] uppercase tracking-widest mb-1">RPM (15)</div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${key.requestsThisMinute > 12 ? 'bg-red-500' : 'bg-accent'}`} 
                        style={{ width: `${Math.min((key.requestsThisMinute / 15) * 100, 100)}%` }} 
                      />
                    </div>
                    <span className="font-mono text-[10px] text-white underline underline-offset-4 decoration-accent/50">{key.requestsThisMinute}/15</span>
                  </div>
                </div>

                <div className="text-center hidden md:block">
                  <div className="text-secondary font-mono text-[8px] uppercase tracking-widest mb-1">RPD (1500)</div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${key.requestsToday > 1200 ? 'bg-red-500' : 'bg-accent'}`} 
                        style={{ width: `${Math.min((key.requestsToday / 1500) * 100, 100)}%` }} 
                      />
                    </div>
                    <span className="font-mono text-[10px] text-white">{key.requestsToday}/1500</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleStatus(key)}
                    className="p-2 hover:bg-white/5 rounded-lg text-secondary hover:text-white transition-all"
                    title={key.status === 'active' ? 'Force Exhaust' : 'Set Active'}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-secondary hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {keys.length === 0 && !isAdding && (
          <div className="glass p-12 rounded-2xl border border-dashed border-line text-center">
            <TrendingUp className="w-12 h-12 text-white/5 mx-auto mb-4" />
            <p className="text-secondary font-mono text-[10px] uppercase tracking-widest">No keys registered in rotation system.</p>
            <button 
              onClick={() => setIsAdding(true)}
              className="mt-4 text-accent font-mono text-[10px] uppercase tracking-widest hover:underline"
            >
              Add your first key
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
