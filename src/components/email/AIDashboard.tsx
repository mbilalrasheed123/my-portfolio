import React, { useState, useEffect } from "react";
import { 
  Sparkles, Send, Play, Cpu, Server, CheckCircle, AlertTriangle, 
  BarChart2, Zap, ArrowUpRight, TrendingUp, RefreshCw 
} from "lucide-react";
import { db } from "../../firebase";
import { collection, onSnapshot, getDoc, doc } from "firebase/firestore";
import RateLimitStatus from "./RateLimitStatus";

export default function AIDashboard() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalSettings, setGlobalSettings] = useState<any>({
    emailsSentToday: 0,
    lastEmailSentDate: "",
    requestCountThisMinute: 0
  });

  useEffect(() => {
    // Listen to campaigns to compute live aggregate metrics
    const campaignsRef = collection(db, "aiCampaigns");
    const unsubscribeCamp = onSnapshot(campaignsRef, (snapshot) => {
      const list = snapshot.docs.map(d => d.data());
      setCampaigns(list);
      setLoading(false);
    });

    // Listen to global rate limits and quota settings
    const settingsRef = doc(db, "aiCampaignSettings", "global");
    const unsubscribeSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        setGlobalSettings(snap.data());
      }
    });

    return () => {
      unsubscribeCamp();
      unsubscribeSettings();
    };
  }, []);

  // Compute stats
  const activeCount = campaigns.filter(c => c.status === "active").length;
  const draftCount = campaigns.filter(c => c.status === "draft").length;
  const completedCount = campaigns.filter(c => c.status === "completed").length;
  
  const totalSentAllTime = campaigns.reduce((acc, c) => acc + (c.sentCount || 0), 0);
  const totalFailedAllTime = campaigns.reduce((acc, c) => acc + (c.failedCount || 0), 0);
  const totalLeadsImported = campaigns.reduce((acc, c) => acc + (c.totalLeads || 0), 0);

  // SMTP tracking: standard free tier maximum of 100 per day
  const dailyQuotaUsed = globalSettings.emailsSentToday || 0;
  const dailyQuotaRemaining = Math.max(0, 100 - dailyQuotaUsed);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER NODES */}
      <div>
        <h3 className="text-lg font-display uppercase tracking-tight text-white flex items-center gap-2">
          <Zap size={18} className="text-[#2563eb]" /> AI Campaign Command Center
        </h3>
        <p className="text-[10px] font-mono text-secondary uppercase tracking-widest mt-0.5">
          Real-time metrics, safety checkpoints, and SMTP queue controls
        </p>
      </div>

      {/* METRIC STRIP GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* 1. ACTIVE CAMPAIGNS */}
        <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-[#2563eb]/20 transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 bg-white/[0.02] text-[#2563eb]">
            <TrendingUp size={14} />
          </div>
          <span className="text-[8px] font-mono text-secondary uppercase tracking-widest font-bold">Active Campaigns</span>
          <p className="text-3xl font-mono font-bold text-white mt-2">
            {activeCount} <span className="text-xs text-secondary font-normal">running</span>
          </p>
          <div className="text-[8px] font-mono text-secondary uppercase mt-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            {draftCount} Drafts &bull; {completedCount} Completed
          </div>
        </div>

        {/* 2. CUMULATIVE EMAILS SENT */}
        <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 bg-white/[0.02] text-emerald-400">
            <CheckCircle size={14} />
          </div>
          <span className="text-[8px] font-mono text-secondary uppercase tracking-widest font-bold">Cumulative AI Sent</span>
          <p className="text-3xl font-mono font-bold text-white mt-2">
            {totalSentAllTime} <span className="text-xs text-secondary font-normal">delivered</span>
          </p>
          <div className="text-[8px] font-mono text-red-400 uppercase mt-3 flex items-center gap-1">
            <AlertTriangle size={10} /> {totalFailedAllTime} dispatches rejected
          </div>
        </div>

        {/* 3. DAILY SMTP QUOTA */}
        <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-white/[0.12] transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 bg-white/[0.02] text-amber-500">
            <Server size={14} />
          </div>
          <span className="text-[8px] font-mono text-secondary uppercase tracking-widest font-bold">Daily SMTP Quota</span>
          <p className="text-3xl font-mono font-bold text-white mt-2">
            {dailyQuotaRemaining} <span className="text-xs text-secondary font-normal">left</span>
          </p>
          <div className="text-[8px] font-mono text-secondary uppercase mt-3">
            {dailyQuotaUsed} / 100 dispatches sent today
          </div>
        </div>

        {/* 4. TOTAL QUEUE LEADS */}
        <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-5 shadow-xl relative overflow-hidden group hover:border-white/[0.12] transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 bg-white/[0.02] text-secondary">
            <BarChart2 size={14} />
          </div>
          <span className="text-[8px] font-mono text-secondary uppercase tracking-widest font-bold">Imported Leads</span>
          <p className="text-3xl font-mono font-bold text-white mt-2">
            {totalLeadsImported} <span className="text-xs text-secondary font-normal">total</span>
          </p>
          <div className="text-[8px] font-mono text-secondary uppercase mt-3">
            Across {campaigns.length} campaigns
          </div>
        </div>
      </div>

      {/* CORE DOUBLE CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CURRENT LIVE RATE LIMIT COMPONENT */}
        <div className="lg:col-span-2 space-y-6">
          <RateLimitStatus
            selectedModel="flash-lite"
            modelRPM={15}
            requestCountThisMinute={globalSettings.requestCountThisMinute || 0}
            timeUntilRateLimitReset="Continuous RPM Tracking Active"
          />

          {/* DYNAMIC SAFETY ANNOUNCEMENT CARD */}
          <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <h4 className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-bold">
              AI Campaign Safety Procedures
            </h4>
            <p className="text-xs text-secondary mt-3 leading-relaxed font-sans">
              To keep your execution within 100% free-tier compatibility and prevent HTTP timeout limits, we utilize a 2-step process. First, personalize all copies upfront using background generator routines, and second, call manual or automatic batched deliveries with built-in cooling throttles.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl font-mono text-[9px] text-secondary uppercase">
                <span className="text-emerald-400 font-bold block mb-1">✓ Automated Throttling</span>
                Injects 3s delays between batches, allowing SMTP connections to close and self-heal gracefully.
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl font-mono text-[9px] text-secondary uppercase">
                <span className="text-blue-400 font-bold block mb-1">✓ Smart Retry Buffer</span>
                Automatically tracks failed SMTP connections and offers single-click recycling controls.
              </div>
            </div>
          </div>
        </div>

        {/* CAMPAIGN OVERVIEW CHART LIST CARD */}
        <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-bold">
              Campaigns Summary
            </h4>
          </div>

          {loading ? (
            <div className="p-4 text-center">
              <div className="w-5 h-5 border-2 border-t-transparent border-[#2563eb] rounded-full animate-spin mx-auto" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-[10px] font-mono text-secondary uppercase tracking-widest text-center py-4">No data nodes recorded.</p>
          ) : (
            <div className="space-y-4">
              {campaigns.slice(0, 4).map((c, idx) => {
                const total = c.totalLeads || 1;
                const sent = c.sentCount || 0;
                const progress = Math.round((sent / total) * 100);

                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-sans">
                      <span className="text-white font-bold truncate pr-2">{c.title}</span>
                      <span className="font-mono text-secondary shrink-0">{progress}%</span>
                    </div>
                    <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full bg-[#2563eb]" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
