import React, { useState, useEffect } from "react";
import { Play, Activity, RefreshCw, AlertCircle, CheckCircle, Clock, Mail } from "lucide-react";
import { auth } from "../../firebase";

interface DashboardTabProps {
  onNavigateToCampaigns: () => void;
}

export default function DashboardTab({ onNavigateToCampaigns }: DashboardTabProps) {
  const [stats, setStats] = useState<any>({
    pendingCount: 0,
    activeCampaignsCount: 0,
    emailsSentToday: 0,
    dailyLimit: 100,
    recentLogs: []
  });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/settings/queue-status", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch dashboard statistics: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleTriggerQueue = async () => {
    setTriggering(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/settings/trigger-queue", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const report = data.report;
      
      setSuccessMsg(
        `Queue processed! ${report.processed} emails sent (${report.successes} Succeeded, ${report.failures} Failed).`
      );
      // Refresh stats
      fetchStats();
    } catch (err: any) {
      console.error(err);
      setError("Failed to process queue: " + (err?.message || String(err)));
    } finally {
      setTriggering(false);
    }
  };

  if (loading && stats.emailsSentToday === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-accent" />
        <span className="ml-3 text-xs font-mono uppercase tracking-widest text-secondary">Loading statistics...</span>
      </div>
    );
  }

  const quotaPercentage = Math.min(100, Math.round((stats.emailsSentToday / stats.dailyLimit) * 100)) || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* SUCCESS/ERROR NOTIFICATIONS */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
          <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-sans font-semibold text-white">Execution Error</h4>
            <p className="text-[10px] font-mono text-rose-300 uppercase mt-1">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
          <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-sans font-semibold text-white">Operation Succeeded</h4>
            <p className="text-[10px] font-mono text-emerald-300 uppercase mt-1">{successMsg}</p>
          </div>
        </div>
      )}

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* STAT 1: QUEUE STATUS */}
        <div className="glass p-6 rounded-3xl border border-line space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-secondary tracking-widest font-bold">Queue Backlog</span>
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
              <Mail size={12} />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-display uppercase font-bold text-white">{stats.pendingCount}</h3>
            <p className="text-[9px] font-mono text-secondary uppercase mt-1">Pending dispatch recipients</p>
          </div>
        </div>

        {/* STAT 2: ACTIVE CAMPAIGNS */}
        <div className="glass p-6 rounded-3xl border border-line space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-secondary tracking-widest font-bold">Active Engines</span>
            <div className="p-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
              <Activity size={12} />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-display uppercase font-bold text-white">{stats.activeCampaignsCount}</h3>
            <p className="text-[9px] font-mono text-secondary uppercase mt-1">Campaigns currently running (Max 3)</p>
          </div>
        </div>

        {/* STAT 3: DAILY LIMIT */}
        <div className="glass p-6 rounded-3xl border border-line space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-secondary tracking-widest font-bold">Daily Sent Quota</span>
            <span className="text-[9px] font-mono text-secondary font-bold">
              {stats.emailsSentToday}/{stats.dailyLimit}
            </span>
          </div>
          <div className="space-y-2">
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  quotaPercentage > 85 ? "bg-rose-500" : quotaPercentage > 50 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${quotaPercentage}%` }}
              />
            </div>
            <p className="text-[9px] font-mono text-secondary uppercase">
              {quotaPercentage}% consumed of standard free-tier limit
            </p>
          </div>
        </div>
      </div>

      {/* QUICK LAUNCH ENGINE AND ACTIONS */}
      <div className="glass p-6 rounded-3xl border border-line flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <h4 className="text-xs font-sans font-semibold text-white">Manual Dispatch Engine Trigger</h4>
          <p className="text-[9px] font-mono text-secondary uppercase leading-relaxed">
            Forces a single execution pass of the email sender queue. Processes 5 pending emails instantly.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <button
            onClick={fetchStats}
            className="flex-1 md:flex-initial px-4 py-2 border border-line hover:border-white/20 text-white rounded-full font-mono text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer hover:bg-white/[0.02]"
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          
          <button
            onClick={handleTriggerQueue}
            disabled={triggering || stats.pendingCount === 0}
            className="flex-1 md:flex-initial px-6 py-2 bg-accent text-white font-mono text-[9px] uppercase tracking-wider font-bold rounded-full hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {triggering ? (
              <>
                <RefreshCw size={10} className="animate-spin" /> Triggering...
              </>
            ) : (
              <>
                <Play size={10} /> Launch Run
              </>
            )}
          </button>
        </div>
      </div>

      {/* LOGS TABLE LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#111] pb-3">
          <h3 className="text-xs font-mono uppercase text-white tracking-widest font-bold">Recent Dispatches (SMTP / Sandbox)</h3>
          <span className="text-[8px] font-mono uppercase text-secondary">Last 50 Events</span>
        </div>

        <div className="glass rounded-2xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-white/5 font-mono text-[9px] uppercase text-secondary">
                  <th className="px-6 py-3 font-semibold">Recipient Email</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Campaign ID</th>
                  <th className="px-6 py-3 font-semibold">Mode</th>
                  <th className="px-6 py-3 font-semibold">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats.recentLogs && stats.recentLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-3 text-xs text-white font-medium">{log.recipientEmail}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wide border ${
                        log.status === "sent" 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-[10px] font-mono text-secondary uppercase truncate max-w-[120px]">
                      {log.campaignId}
                    </td>
                    <td className="px-6 py-3 text-[9px] font-mono text-secondary uppercase">
                      {log.smtpUsed || "SMTP"}
                    </td>
                    <td className="px-6 py-3 text-[10px] font-mono text-secondary">
                      {log.sentAt ? (
                        typeof log.sentAt === 'string' 
                          ? new Date(log.sentAt).toLocaleString() 
                          : new Date(log.sentAt?.seconds * 1000).toLocaleString()
                      ) : "Recently"}
                    </td>
                  </tr>
                ))}

                {(!stats.recentLogs || stats.recentLogs.length === 0) && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-[9px] font-mono uppercase text-secondary">
                      No emails sent yet. Select campaigns and build recipient lists to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
