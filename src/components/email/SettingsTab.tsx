import React, { useState, useEffect } from "react";
import { Save, AlertCircle, CheckCircle, RefreshCw, Mail, Sliders, Shield } from "lucide-react";
import { auth } from "../../firebase";

export default function SettingsTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Settings State
  const [dailyLimit, setDailyLimit] = useState(100);
  const [batchSize, setBatchSize] = useState(5);
  const [autoPause, setAutoPause] = useState(true);

  // Test Email State
  const [testTo, setTestTo] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testBody, setTestBody] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/settings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      setDailyLimit(data.dailyLimit || 100);
      setBatchSize(data.batchSize || 5);
      setAutoPause(data.autoPause ?? true);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch settings: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ dailyLimit, batchSize, autoPause })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update settings.");
      }

      setSuccess("Global campaign settings updated successfully!");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTo || !testSubject || !testBody) {
      setTestError("Please fill out all test email fields.");
      return;
    }

    setTestLoading(true);
    setTestError(null);
    setTestSuccess(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/settings/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ to: testTo, subject: testSubject, bodyHtml: testBody })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send test email.");
      }

      if (data.simulated) {
        setTestSuccess(`Sandbox simulation: ${data.message}`);
      } else {
        setTestSuccess("SMTP Handshake verified! Test email dispatched successfully.");
      }
      setTestTo("");
      setTestSubject("");
      setTestBody("");
    } catch (err: any) {
      console.error(err);
      setTestError(err?.message || String(err));
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
      {/* LEFT COLUMN: CAMPAIGN CONFIG */}
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-sans font-semibold text-white">Execution Error</h4>
              <p className="text-[10px] font-mono text-rose-300 uppercase mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
            <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-sans font-semibold text-white">Settings Status</h4>
              <p className="text-[10px] font-mono text-emerald-300 uppercase mt-1">{success}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="glass p-8 rounded-3xl border border-line space-y-6">
          <h3 className="text-xs font-mono uppercase text-white tracking-widest font-bold flex items-center gap-2">
            <Sliders size={14} className="text-accent" /> Campaign & Dispatch Controls
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase text-secondary">Daily Sending Quota / Limit</label>
              <input
                type="number"
                min={1}
                max={100}
                className="w-full bg-white/5 border border-line rounded-lg px-4 py-2.5 text-xs text-white outline-none focus:border-accent"
                value={dailyLimit}
                onChange={e => setDailyLimit(parseInt(e.target.value) || 100)}
              />
              <p className="text-[8px] font-mono text-secondary uppercase">Maximum allowed emails dispatched per 24 hours. Limit: 100.</p>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase text-secondary">Batch Throttling Size</label>
              <select
                className="w-full bg-[#111] border border-line rounded-lg px-4 py-2.5 text-xs text-white outline-none focus:border-accent appearance-none cursor-pointer"
                value={batchSize}
                onChange={e => setBatchSize(parseInt(e.target.value) || 5)}
              >
                <option value={1}>1 Email per Cron trigger (Extreme Safety)</option>
                <option value={2}>2 Emails per Cron trigger</option>
                <option value={3}>3 Emails per Cron trigger</option>
                <option value={4}>4 Emails per Cron trigger</option>
                <option value={5}>5 Emails per Cron trigger (Max Performance)</option>
              </select>
              <p className="text-[8px] font-mono text-secondary uppercase">Batch size limits dispatched emails per cron run to prevent server execution timeouts.</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-line rounded-2xl">
              <div className="space-y-0.5">
                <span className="text-xs font-sans font-bold text-white block">Auto-Pause Guard</span>
                <span className="text-[8px] font-mono text-secondary uppercase block">Automatically pause campaign upon a recipient send error</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={autoPause}
                  onChange={e => setAutoPause(e.target.checked)}
                />
                <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent text-white font-mono text-[9px] uppercase tracking-wider font-bold rounded-xl hover:scale-101 active:scale-99 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Save Settings
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: SMTP TEST DISPATCHER */}
      <div className="space-y-6">
        {testError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-sans font-semibold text-white">SMTP Handshake Error</h4>
              <p className="text-[10px] font-mono text-rose-300 uppercase mt-1">{testError}</p>
            </div>
          </div>
        )}

        {testSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
            <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-sans font-semibold text-white">SMTP Dispatch OK</h4>
              <p className="text-[10px] font-mono text-emerald-300 uppercase mt-1">{testSuccess}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSendTestEmail} className="glass p-8 rounded-3xl border border-line space-y-4">
          <h3 className="text-xs font-mono uppercase text-white tracking-widest font-bold flex items-center gap-2">
            <Mail size={14} className="text-accent" /> Manual SMTP Delivery Sandbox
          </h3>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="font-mono text-[9px] uppercase text-secondary">Test Recipient Email</label>
              <input
                type="email"
                placeholder="e.g., test-recipient@example.com"
                className="w-full bg-white/5 border border-line rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent"
                value={testTo}
                onChange={e => setTestTo(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-[9px] uppercase text-secondary">Test Subject Header</label>
              <input
                type="text"
                placeholder="SMTP verification check"
                className="w-full bg-white/5 border border-line rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent"
                value={testSubject}
                onChange={e => setTestSubject(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-[9px] uppercase text-secondary">Test Body Content (HTML)</label>
              <textarea
                rows={5}
                placeholder="<h1>Test Header</h1><p>My test message</p>"
                className="w-full bg-white/5 border border-line rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent font-mono"
                value={testBody}
                onChange={e => setTestBody(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={testLoading}
            className="w-full py-2.5 bg-white text-black font-mono text-[9px] uppercase tracking-wider font-bold rounded-xl hover:scale-101 active:scale-99 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {testLoading ? (
              <>
                <RefreshCw size={12} className="animate-spin" /> Verifying Connection...
              </>
            ) : (
              "Send Sandbox Email"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
