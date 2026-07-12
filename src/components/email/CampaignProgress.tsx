import React from "react";
import { CheckCircle, AlertTriangle, Clock, Sparkles } from "lucide-react";

interface CampaignProgressProps {
  totalLeads: number;
  sentCount: number;
  failedCount: number;
  generatedCount: number;
  status: string;
}

export default function CampaignProgress({
  totalLeads = 0,
  sentCount = 0,
  failedCount = 0,
  generatedCount = 0,
  status = "draft"
}: CampaignProgressProps) {
  // Safe denominators
  const total = totalLeads || 1;
  const sentPercentage = Math.min(100, Math.round((sentCount / total) * 100));
  const failedPercentage = Math.min(100, Math.round((failedCount / total) * 100));
  const generatedPercentage = Math.min(
    100,
    Math.round((Math.max(0, generatedCount - sentCount - failedCount) / total) * 100)
  );

  const pendingPercentage = Math.max(
    0,
    100 - sentPercentage - failedPercentage - generatedPercentage
  );

  return (
    <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono text-secondary uppercase tracking-widest block font-semibold">Campaign Metrics</span>
          <h4 className="text-sm font-sans font-bold text-white mt-1">Real-time Batch Sending Status</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-mono uppercase font-bold tracking-widest ${
            status === "completed" 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
              : status === "active" 
                ? "bg-[#2563eb]/10 text-blue-400 border border-blue-400/20 animate-pulse" 
                : status === "paused"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-white/[0.06] text-secondary border border-white/[0.04]"
          }`}>
            {status}
          </span>
        </div>
      </div>

      {/* MULTI-STATUS PROGRESS BAR */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-secondary">
          <span>{sentCount} / {totalLeads} DISPATCHED</span>
          <span>{Math.round((sentCount / total) * 100)}%</span>
        </div>

        <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden flex">
          {/* Sent Bar (Emerald) */}
          <div 
            className="h-full bg-emerald-500 transition-all duration-500" 
            style={{ width: `${sentPercentage}%` }} 
            title={`Sent: ${sentCount}`}
          />
          {/* Failed Bar (Red) */}
          <div 
            className="h-full bg-red-500 transition-all duration-500" 
            style={{ width: `${failedPercentage}%` }} 
            title={`Failed: ${failedCount}`}
          />
          {/* Generated/Ready Bar (Blue) */}
          <div 
            className="h-full bg-[#2563eb] transition-all duration-500" 
            style={{ width: `${generatedPercentage}%` }} 
            title={`Generated: ${generatedCount - sentCount - failedCount}`}
          />
          {/* Pending Bar (Dark Gray) */}
          <div 
            className="h-full bg-white/10 transition-all duration-500" 
            style={{ width: `${pendingPercentage}%` }} 
            title="Pending Generation"
          />
        </div>
      </div>

      {/* STATS COUNT GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* 1. SENT */}
        <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle size={14} />
          </div>
          <div>
            <span className="text-[8px] font-mono text-secondary uppercase tracking-wider block">Sent</span>
            <p className="text-base font-sans font-bold text-white mt-0.5">{sentCount}</p>
          </div>
        </div>

        {/* 2. FAILED */}
        <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
            <AlertTriangle size={14} />
          </div>
          <div>
            <span className="text-[8px] font-mono text-secondary uppercase tracking-wider block">Failed</span>
            <p className="text-base font-sans font-bold text-white mt-0.5">{failedCount}</p>
          </div>
        </div>

        {/* 3. READY TO SEND */}
        <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#2563eb]/10 text-blue-400">
            <Sparkles size={14} />
          </div>
          <div>
            <span className="text-[8px] font-mono text-secondary uppercase tracking-wider block">Ready</span>
            <p className="text-base font-sans font-bold text-white mt-0.5">
              {Math.max(0, generatedCount - sentCount - failedCount)}
            </p>
          </div>
        </div>

        {/* 4. TOTAL LEADS */}
        <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/[0.06] text-[#94a3b8]">
            <Clock size={14} />
          </div>
          <div>
            <span className="text-[8px] font-mono text-secondary uppercase tracking-wider block">Total Leads</span>
            <p className="text-base font-sans font-bold text-white mt-0.5">{totalLeads}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
