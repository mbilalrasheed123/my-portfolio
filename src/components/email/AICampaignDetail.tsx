import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, RefreshCw, Send, Play, Pause, AlertTriangle, 
  CheckCircle, Clock, Sparkles, AlertCircle, FileText, Ban, Trash2, Cpu, Image as ImageIcon 
} from "lucide-react";
import { auth } from "../../firebase";
import CampaignProgress from "./CampaignProgress";
import RateLimitStatus from "./RateLimitStatus";
import AIEmailLogs from "./AIEmailLogs";

interface AICampaignDetailProps {
  campaignId: string;
  onBack: () => void;
}

export default function AICampaignDetail({ campaignId, onBack }: AICampaignDetailProps) {
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live action/sending states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [cooldownTime, setCooldownTime] = useState<number>(0);
  const [isAutoSending, setIsAutoSending] = useState(false);

  // Status metrics
  const [statusMetrics, setStatusMetrics] = useState<any>({
    campaignStatus: "draft",
    totalLeads: 0,
    generatedCount: 0,
    sentCount: 0,
    failedCount: 0,
    remainingCount: 0,
    requestCountThisMinute: 0,
    selectedModel: "flash-lite",
    modelRPM: 15,
    imageStrategy: "option1-keyword"
  });

  const getAuthHeaders = async (additionalHeaders: Record<string, string> = {}) => {
    const token = await auth.currentUser?.getIdToken();
    return {
      "Authorization": `Bearer ${token}`,
      ...additionalHeaders
    };
  };

  const fetchStatusAndCampaign = async () => {
    if (!campaignId) return;
    try {
      const headers = await getAuthHeaders();
      // Fetch details
      const confResp = await fetch(`/api/email/ai-campaigns/${campaignId}/status`, { headers });
      const metrics = await confResp.json();
      if (confResp.ok) {
        setStatusMetrics(metrics);
        setIsGenerating(metrics.campaignStatus === "generating");
      }

      // Fetch config
      const docResp = await fetch(`/api/email/ai-campaigns/${campaignId}/config`, { headers });
      const config = await docResp.json();
      if (docResp.ok) {
        setCampaign(config);
      }
    } catch (err) {
      console.error("Failed to poll status metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndCampaign();
    // Poll stats every 4 seconds to get background copy generation updates
    const interval = setInterval(fetchStatusAndCampaign, 4000);
    return () => clearInterval(interval);
  }, [campaignId]);

  // Handle Generate All Copies upfront
  const handleGenerateAll = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsGenerating(true);
    setDispatchStatus("Initiating background copy generator...");

    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/email/ai-campaigns/${campaignId}/generate-all`, {
        method: "POST",
        headers
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to trigger AI copy generation.");
      }
      setSuccessMsg("AI content generator started in the background. Polling for progress...");
      fetchStatusAndCampaign();
    } catch (err: any) {
      setError(err?.message || "Generation initialization exception.");
      setIsGenerating(false);
    }
  };

  // Helper for countdown delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Dispatch a single batch of 5 emails
  const dispatchNextBatch = async (): Promise<boolean> => {
    setError(null);
    setIsDispatching(true);
    setDispatchStatus("Request 1/20 to Gemini... Generating...");

    await delay(1000);
    setDispatchStatus("Sending emails... Delivering to recipients...");

    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/email/ai-campaigns/${campaignId}/send-batch`, {
        method: "POST",
        headers
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Batch dispatch error.");
      }

      setDispatchStatus(`Sent ${data.sent}/5 successfully!`);
      await fetchStatusAndCampaign();
      setIsDispatching(false);

      // Return true if there are more remaining
      return data.continueProcessing && data.remaining > 0;
    } catch (err: any) {
      setError(err?.message || "Delivery error occurred during batch dispatch.");
      setIsDispatching(false);
      setIsAutoSending(false);
      return false;
    }
  };

  // Automated dispatcher loop
  const handleAutoDispatch = async () => {
    setIsAutoSending(true);
    let hasMore = true;

    // Direct resume command if campaign was paused
    if (statusMetrics.campaignStatus === "paused") {
      await handleResume();
    }

    while (hasMore && isAutoSending) {
      const more = await dispatchNextBatch();
      if (!more) {
        setIsAutoSending(false);
        break;
      }

      // Check if paused during active sending loop
      const headers = await getAuthHeaders();
      const checkStatus = await fetch(`/api/email/ai-campaigns/${campaignId}/status`, { headers });
      const latestMetrics = await checkStatus.json();
      if (latestMetrics.campaignStatus === "paused") {
        setIsAutoSending(false);
        setDispatchStatus("Loop halted. Campaign paused.");
        break;
      }

      // Countdown throttle for Unsplash and rate limit safety
      setDispatchStatus("Auto-wait 3 seconds... Throttling...");
      for (let i = 3; i > 0; i--) {
        setCooldownTime(i);
        await delay(1000);
      }
      setCooldownTime(0);
    }
    setIsAutoSending(false);
  };

  // Pause campaign dispatches
  const handlePause = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsAutoSending(false);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/email/ai-campaigns/${campaignId}/pause`, {
        method: "POST",
        headers
      });
      const data = await resp.json();
      if (resp.ok) {
        setSuccessMsg(`Campaign paused successfully at sent count: ${data.sentCount}`);
        setDispatchStatus(`Campaign paused.`);
        fetchStatusAndCampaign();
      }
    } catch (err) {
      console.error("Pause failure:", err);
    }
  };

  // Resume campaign
  const handleResume = async () => {
    setError(null);
    setSuccessMsg(null);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/email/ai-campaigns/${campaignId}/resume`, {
        method: "POST",
        headers
      });
      if (resp.ok) {
        setSuccessMsg("Campaign status active. Dispatch resumed.");
        fetchStatusAndCampaign();
      }
    } catch (err) {
      console.error("Resume failure:", err);
    }
  };

  // Recycle failed leads back to generated copy state
  const handleRetryFailed = async () => {
    setError(null);
    setSuccessMsg(null);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/email/ai-campaigns/${campaignId}/retry-failed`, {
        method: "POST",
        headers
      });
      const data = await resp.json();
      if (resp.ok) {
        setSuccessMsg(data.message || "Failed dispatches successfully recycled.");
        fetchStatusAndCampaign();
      }
    } catch (err) {
      console.error("Retry failed failure:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-2 border-t-transparent border-[#2563eb] rounded-full animate-spin mx-auto mb-4" />
        <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">Polling Campaign Data node...</span>
      </div>
    );
  }

  const modelLabel = (() => {
    switch (statusMetrics.selectedModel) {
      case "flash-lite": return "Gemini 3.1 Flash-Lite";
      case "flash": return "Gemini 3.5 Flash";
      case "2.5-flash": return "Gemini 2.5 Flash";
      case "2.5-pro": return "Gemini 2.5 Pro";
      default: return statusMetrics.selectedModel;
    }
  })();

  const isGeneratingProgress = statusMetrics.campaignStatus === "generating";
  const isDraft = statusMetrics.campaignStatus === "draft";
  const isReadyToSend = statusMetrics.campaignStatus === "ready-to-send" || statusMetrics.campaignStatus === "paused" || statusMetrics.campaignStatus === "active";
  const isCompleted = statusMetrics.campaignStatus === "completed";

  return (
    <div className="space-y-8">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[9px] font-mono text-secondary hover:text-white uppercase tracking-widest mb-2 transition-all cursor-pointer"
          >
            <ArrowLeft size={10} /> Back to Campaigns
          </button>
          <h2 className="text-2xl font-display font-medium uppercase text-white flex items-center gap-2">
            {campaign?.title || "AI Sales Campaign Control"}
          </h2>
          <p className="text-[10px] font-mono text-secondary uppercase tracking-widest mt-1">
            Campaign Panel Node &bull; {modelLabel} &bull; {statusMetrics.imageStrategy === "option1-keyword" ? "Keyword Images" : "URL Images"}
          </p>
        </div>

        {/* STATUS ACTIONS BUTTONS */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatusAndCampaign}
            className="p-2 hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] text-secondary hover:text-white rounded-xl transition-all cursor-pointer"
            title="Refresh statistics"
          >
            <RefreshCw size={14} className={(isGeneratingProgress || isDispatching) ? "animate-spin" : ""} />
          </button>

          {/* Action toggle pause / resume */}
          {statusMetrics.campaignStatus === "active" && (
            <button
              onClick={handlePause}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl font-mono text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer font-bold"
            >
              <Pause size={12} /> Pause Campaign
            </button>
          )}

          {statusMetrics.campaignStatus === "paused" && (
            <button
              onClick={handleResume}
              className="px-4 py-2 bg-[#2563eb]/10 hover:bg-[#2563eb]/20 text-blue-400 border border-blue-400/20 rounded-xl font-mono text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer font-bold"
            >
              <Play size={12} /> Resume Campaign
            </button>
          )}
        </div>
      </div>

      {/* FLASH MESSAGES */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-3">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-3">
          <CheckCircle size={14} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* CORE CONTROL AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* PROGRESS & RATE LIMIT DETAILS */}
        <div className="lg:col-span-2 space-y-8">
          <CampaignProgress
            totalLeads={statusMetrics.totalLeads}
            sentCount={statusMetrics.sentCount}
            failedCount={statusMetrics.failedCount}
            generatedCount={statusMetrics.generatedCount}
            status={statusMetrics.campaignStatus}
          />

          {/* ACTION SHELF: GENERATE & AUTOMATE */}
          <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-6 shadow-xl space-y-6">
            <h4 className="text-sm font-sans font-bold text-white uppercase tracking-wider">AI Execution Dashboard</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* STEP 1: GENERATE ALL */}
              <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[8px] font-mono text-secondary uppercase tracking-widest font-bold">Step 1: Content Setup</span>
                  <h5 className="text-xs font-sans font-bold text-white mt-1">Generate AI Personalizations</h5>
                  <p className="text-[10px] text-secondary mt-1 leading-relaxed">
                    Personalize and generate custom copy for all leads upfront via Gemini. Required before dispatch.
                  </p>
                </div>
                <button
                  disabled={isGenerating || isCompleted || isGeneratingProgress}
                  onClick={handleGenerateAll}
                  className="mt-4 w-full py-2 bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white font-mono text-[9px] uppercase tracking-widest font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
                >
                  {isGeneratingProgress ? (
                    <>
                      <div className="w-3 h-3 border-2 border-t-transparent border-white rounded-full animate-spin" />
                      Generating Copies...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} /> Generate All with AI
                    </>
                  )}
                </button>
              </div>

              {/* STEP 2: DISPATCH CAMPAIGN */}
              <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[8px] font-mono text-secondary uppercase tracking-widest font-bold">Step 2: Delivery Control</span>
                  <h5 className="text-xs font-sans font-bold text-white mt-1">Manual & Auto-Dispatch</h5>
                  <p className="text-[10px] text-secondary mt-1 leading-relaxed">
                    Trigger dispatches of pre-generated emails in safe batches of 5, preserving SMTP delivery health.
                  </p>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    disabled={isDispatching || isGeneratingProgress || isDraft || statusMetrics.generatedCount - statusMetrics.sentCount - statusMetrics.failedCount === 0}
                    onClick={() => dispatchNextBatch()}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-mono text-[9px] uppercase tracking-widest font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isDispatching ? (
                      <>
                        <div className="w-3 h-3 border-2 border-t-transparent border-white rounded-full animate-spin" />
                        Delivering...
                      </>
                    ) : (
                      <>
                        <Send size={12} /> Send Next Batch
                      </>
                    )}
                  </button>

                  <button
                    disabled={isAutoSending || isGeneratingProgress || isDraft || statusMetrics.generatedCount - statusMetrics.sentCount - statusMetrics.failedCount === 0}
                    onClick={handleAutoDispatch}
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-[9px] uppercase tracking-widest font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play size={12} /> Auto-Dispatch
                  </button>
                </div>
              </div>
            </div>

            {/* LIVE FEEDBACK LOG AREA */}
            {(dispatchStatus || cooldownTime > 0) && (
              <div className="p-4 bg-[#0a0b0d] border border-white/[0.06] rounded-xl flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                  <span className="text-[#94a3b8]">{dispatchStatus || "Waiting for cycle reset..."}</span>
                </div>
                {cooldownTime > 0 && (
                  <span className="text-amber-400 font-bold">
                    Cooldown Countdown: {cooldownTime}s
                  </span>
                )}
              </div>
            )}

            {/* RECYCLE FAILED ACTION */}
            {statusMetrics.failedCount > 0 && (
              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5" />
                  <div className="leading-tight">
                    <span className="text-xs font-sans font-bold text-white">Found {statusMetrics.failedCount} Failed Deliveries</span>
                    <p className="text-[10px] text-secondary mt-0.5">Recycle failed leads back to 'generated' copy state for redelivery.</p>
                  </div>
                </div>
                <button
                  onClick={handleRetryFailed}
                  className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-mono text-[8px] uppercase tracking-widest font-bold transition-all cursor-pointer"
                >
                  Recycle Failed Leads
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SIDE BAR DETAILS & LIVE RPM */}
        <div className="space-y-8">
          <RateLimitStatus
            selectedModel={statusMetrics.selectedModel}
            modelRPM={statusMetrics.modelRPM}
            requestCountThisMinute={statusMetrics.requestCountThisMinute}
            timeUntilRateLimitReset="Dynamic Reset Enabled"
          />

          {/* CAMPAIGN METRIC PREVIEW */}
          <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-6 shadow-xl space-y-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-bold">Campaign Configuration</h4>
            
            <div className="divide-y divide-white/[0.04] text-xs font-sans text-secondary">
              <div className="py-2.5 flex items-center justify-between">
                <span>Selected Model</span>
                <span className="font-mono text-white text-[10px]">{modelLabel}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span>Image Personalization</span>
                <span className="text-white">
                  {statusMetrics.imageStrategy === "option1-keyword" ? "Keyword Ingestion" : "Direct URLs"}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span>Total Lead Queue</span>
                <span className="font-mono text-white font-bold">{statusMetrics.totalLeads}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span>Current Status</span>
                <span className="font-mono font-bold text-blue-400 uppercase tracking-widest text-[10px]">
                  {statusMetrics.campaignStatus}
                </span>
              </div>
            </div>

            {/* Campaign Summary Display Requirement */}
            {statusMetrics.campaignStatus === "completed" && (
              <div className="pt-4 border-t border-white/[0.06] space-y-2 bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">Campaign Summary</p>
                <ul className="text-[10px] font-mono text-secondary space-y-1">
                  <li>├─ Total leads: {statusMetrics.totalLeads}</li>
                  <li>├─ Successfully sent: {statusMetrics.sentCount}</li>
                  <li>├─ Failed: {statusMetrics.failedCount}</li>
                  <li>├─ Remaining: 0</li>
                  <li>├─ Model used: {modelLabel}</li>
                  <li>├─ Image strategy: {statusMetrics.imageStrategy === "option1-keyword" ? "Keyword-based" : "Direct URL"}</li>
                  <li>└─ Status: ✅ Completed</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* REAL-TIME DELIVERY LOG PANEL */}
      <div className="pt-4 border-t border-white/[0.04]">
        <h3 className="text-lg font-display uppercase tracking-tight text-white mb-6">Delivery Logs & Metrics Audit</h3>
        <AIEmailLogs campaignId={campaignId} />
      </div>
    </div>
  );
}
