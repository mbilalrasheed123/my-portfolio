import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, RefreshCw, Send, Play, Pause, AlertTriangle, 
  CheckCircle, Clock, Sparkles, AlertCircle, FileText, Ban, Trash2, Cpu, Image as ImageIcon, X
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

  // New features state
  const [failedLeads, setFailedLeads] = useState<any[]>([]);
  const [historyRuns, setHistoryRuns] = useState<any[]>([]);
  const [tempInstructions, setTempInstructions] = useState<string>("");
  const [isReactivating, setIsReactivating] = useState(false);
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [retryingLeads, setRetryingLeads] = useState<Record<string, boolean>>({});
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<any | null>(null);
  const [instructionsInitialized, setInstructionsInitialized] = useState(false);

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

  const fetchFailedLeads = async () => {
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/email/ai-campaigns/${campaignId}/failed-leads`, { headers });
      const data = await resp.json();
      if (resp.ok) {
        setFailedLeads(data.failedLeads || []);
      }
    } catch (err) {
      console.error("Failed to fetch failed leads:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/email/ai-campaigns/${campaignId}/history`, { headers });
      const data = await resp.json();
      if (resp.ok) {
        setHistoryRuns(data.historyRuns || []);
      }
    } catch (err) {
      console.error("Failed to fetch campaign history:", err);
    }
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
        if (metrics.failedCount > 0) {
          fetchFailedLeads();
        } else {
          setFailedLeads([]);
        }
      }

      // Fetch config
      const docResp = await fetch(`/api/email/ai-campaigns/${campaignId}/config`, { headers });
      const config = await docResp.json();
      if (docResp.ok) {
        setCampaign(config);
        if (!instructionsInitialized) {
          setTempInstructions(config.instructions || "");
          setInstructionsInitialized(true);
        }
      }
    } catch (err) {
      console.error("Failed to poll status metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndCampaign();
    fetchHistory();
    // Poll stats every 4 seconds to get background copy generation updates
    const interval = setInterval(fetchStatusAndCampaign, 4000);
    return () => clearInterval(interval);
  }, [campaignId]);

  // Handle Save updated instructions/prompt when in draft state
  const handleSaveInstructions = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsSavingInstructions(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const resp = await fetch(`/api/email/ai-campaigns/${campaignId}/update-config`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          instructions: tempInstructions
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to update instructions.");
      }
      setSuccessMsg("Instructions updated successfully! You can now generate copies with the new message prompt.");
      fetchStatusAndCampaign();
    } catch (err: any) {
      setError(err?.message || "Failed to save instructions.");
    } finally {
      setIsSavingInstructions(false);
    }
  };

  // Handle retry single lead send
  const handleRetrySingleLead = async (leadId: string) => {
    setError(null);
    setSuccessMsg(null);
    setRetryingLeads(prev => ({ ...prev, [leadId]: true }));
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/email/ai-campaigns/${campaignId}/retry-lead/${leadId}`, {
        method: "POST",
        headers
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to retry lead.");
      }
      setSuccessMsg(`Lead reset to ready copy state successfully.`);
      fetchStatusAndCampaign();
    } catch (err: any) {
      setError(err?.message || "Failed to retry lead.");
    } finally {
      setRetryingLeads(prev => ({ ...prev, [leadId]: false }));
    }
  };

  // Handle reactivate completed campaign
  const handleReactivate = async () => {
    if (!window.confirm("Are you sure you want to reactivate this campaign? This will archive your current campaign statistics and leads to the run history, reset active counts and leads to pending, and set status back to draft so you can customize your message and start a new run.")) {
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setIsReactivating(true);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/email/ai-campaigns/${campaignId}/reactivate`, {
        method: "POST",
        headers
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to reactivate campaign.");
      }
      setSuccessMsg(data.message || "Campaign reactivated successfully! Status is reset to draft. You can now edit instructions.");
      setInstructionsInitialized(false); // force re-sync with new instructions
      fetchStatusAndCampaign();
      fetchHistory();
    } catch (err: any) {
      setError(err?.message || "Failed to reactivate campaign.");
    } finally {
      setIsReactivating(false);
    }
  };

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

          {statusMetrics.campaignStatus === "completed" && (
            <button
              onClick={handleReactivate}
              disabled={isReactivating}
              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-mono text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer font-bold disabled:opacity-50"
            >
              <RefreshCw size={12} className={isReactivating ? "animate-spin" : ""} /> Reactivate Campaign
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

          {/* EDIT MESSAGE PROMPT (Only in draft mode) */}
          {statusMetrics.campaignStatus === "draft" && (
            <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-sans font-bold text-white uppercase tracking-wider">Customize Campaign Message Prompt</h4>
                <button
                  disabled={isSavingInstructions}
                  onClick={handleSaveInstructions}
                  className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white font-mono text-[9px] uppercase tracking-widest font-bold rounded-xl transition-all cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
                >
                  {isSavingInstructions ? "Saving..." : "Save Message Prompt"}
                </button>
              </div>
              <p className="text-[10px] text-secondary">
                Customize the copy generation instructions used by the AI model. This message prompt guides how Gemini structures and personalizes your outbound emails.
              </p>
              <textarea
                value={tempInstructions}
                onChange={(e) => setTempInstructions(e.target.value)}
                placeholder="Enter custom instructions or message content to guide the copy generation..."
                rows={5}
                className="w-full bg-[#0a0b0d] border border-white/[0.08] focus:border-[#2563eb]/30 rounded-xl p-4 font-sans text-xs text-white outline-none placeholder:text-secondary"
              />
            </div>
          )}

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

          {/* FAILED EMAIL DELIVERIES SUMMARY & INDIVIDUAL RETRY */}
          {failedLeads.length > 0 && (
            <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                <div>
                  <h4 className="text-sm font-sans font-bold text-white uppercase tracking-wider">Failed Email Deliveries</h4>
                  <p className="text-[10px] text-secondary mt-0.5">Review failed email deliveries and retry them individually or altogether.</p>
                </div>
                <button
                  onClick={handleRetryFailed}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-mono text-[9px] uppercase tracking-widest font-bold rounded-xl transition-all cursor-pointer"
                >
                  Retry All Failed
                </button>
              </div>
              <div className="divide-y divide-white/[0.04] max-h-80 overflow-y-auto pr-1">
                {failedLeads.map((lead) => (
                  <div key={lead.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans">
                    <div className="space-y-0.5">
                      <div className="text-white font-bold">{lead.name} <span className="text-secondary font-normal font-mono text-[10px]">({lead.email})</span></div>
                      <div className="text-red-400 text-[10px] italic flex items-center gap-1.5">
                        <AlertCircle size={10} />
                        <span>Error: {lead.errorMessage || "SMTP transmission failed"}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRetrySingleLead(lead.id)}
                      disabled={retryingLeads[lead.id]}
                      className="shrink-0 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-mono text-[9px] uppercase tracking-widest font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {retryingLeads[lead.id] ? (
                        <div className="w-3 h-3 border-2 border-t-transparent border-red-400 rounded-full animate-spin" />
                      ) : (
                        "Retry Lead"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              <div className="pt-4 border-t border-white/[0.06] space-y-4 bg-[#10b981]/5 p-4 rounded-xl border border-[#10b981]/10">
                <div>
                  <p className="text-[10px] font-mono text-[#10b981] uppercase tracking-widest font-bold">Campaign Summary</p>
                  <ul className="text-[10px] font-mono text-secondary space-y-1 mt-1">
                    <li>├─ Total leads: {statusMetrics.totalLeads}</li>
                    <li>├─ Successfully sent: {statusMetrics.sentCount}</li>
                    <li>├─ Failed: {statusMetrics.failedCount}</li>
                    <li>├─ Remaining: 0</li>
                    <li>├─ Model used: {modelLabel}</li>
                    <li>├─ Image strategy: {statusMetrics.imageStrategy === "option1-keyword" ? "Keyword-based" : "Direct URL"}</li>
                    <li>└─ Status: ✅ Completed</li>
                  </ul>
                </div>
                <button
                  disabled={isReactivating}
                  onClick={handleReactivate}
                  className="w-full py-2 bg-[#10b981] hover:bg-emerald-600 disabled:opacity-50 text-white font-mono text-[9px] uppercase tracking-widest font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.25)]"
                >
                  <RefreshCw size={12} className={isReactivating ? "animate-spin" : ""} /> Reactivate & Run Again
                </button>
              </div>
            )}
          </div>

          {/* CAMPAIGN RUN HISTORY */}
          {historyRuns.length > 0 && (
            <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-6 shadow-xl space-y-4">
              <h4 className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-bold">Run History ({historyRuns.length})</h4>
              <p className="text-[10px] text-secondary leading-normal">
                Review past iterations, delivery outcomes, and custom prompts used.
              </p>
              <div className="divide-y divide-white/[0.04] space-y-3 max-h-72 overflow-y-auto pr-1">
                {historyRuns.map((run, idx) => (
                  <div key={run.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-white font-bold">Run #{historyRuns.length - idx}</span>
                      <span className="font-mono text-secondary">
                        {run.timestamp ? new Date(run.timestamp.seconds * 1000).toLocaleDateString() : "Recent"}
                      </span>
                    </div>
                    <div className="text-[10px] text-secondary space-y-1 bg-white/[0.01] border border-white/[0.04] p-2.5 rounded-lg font-mono">
                      <div>Sent: <span className="text-emerald-400 font-bold">{run.sentCount}</span> | Failed: <span className="text-red-400 font-bold">{run.failedCount}</span></div>
                      <div className="truncate text-[9px] text-[#94a3b8] italic">Prompt: "{run.instructions}"</div>
                    </div>
                    <button
                      onClick={() => setSelectedHistoryRun(run)}
                      className="w-full text-center py-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-mono text-[8px] uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                    >
                      View Archived Run
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* REAL-TIME DELIVERY LOG PANEL */}
      <div className="pt-4 border-t border-white/[0.04]">
        <h3 className="text-lg font-display uppercase tracking-tight text-white mb-6">Delivery Logs & Metrics Audit</h3>
        <AIEmailLogs campaignId={campaignId} />
      </div>

      {/* HISTORY RUN DETAIL MODAL */}
      {selectedHistoryRun && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1014] border border-white/[0.08] w-full max-w-4xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-[#2563eb]">Archived Campaign Run Data</span>
                <h3 className="text-lg font-display uppercase tracking-tight text-white font-bold mt-1">
                  {selectedHistoryRun.title} - Run Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedHistoryRun(null)}
                className="p-1.5 bg-white/5 border border-white/10 hover:border-white/20 text-secondary hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* SUMMARY METRICS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl">
                  <span className="text-[8px] font-mono text-secondary uppercase">Run Date</span>
                  <p className="text-xs font-sans font-bold text-white mt-1">
                    {selectedHistoryRun.timestamp ? new Date(selectedHistoryRun.timestamp.seconds * 1000).toLocaleString() : "Recent"}
                  </p>
                </div>
                <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl">
                  <span className="text-[8px] font-mono text-secondary uppercase">Total Leads</span>
                  <p className="text-xs font-sans font-bold text-white mt-1">{selectedHistoryRun.totalLeads}</p>
                </div>
                <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl">
                  <span className="text-[8px] font-mono text-emerald-400 uppercase font-bold">Sent successfully</span>
                  <p className="text-xs font-sans font-bold text-emerald-400 mt-1">{selectedHistoryRun.sentCount}</p>
                </div>
                <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl">
                  <span className="text-[8px] font-mono text-red-400 uppercase font-bold">Failed deliveries</span>
                  <p className="text-xs font-sans font-bold text-red-400 mt-1">{selectedHistoryRun.failedCount}</p>
                </div>
              </div>

              {/* PROMPT USED */}
              <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl space-y-1">
                <span className="text-[8px] font-mono text-secondary uppercase font-bold">Custom Instructions/Message Prompt Used</span>
                <p className="text-xs font-sans text-white mt-1 whitespace-pre-wrap italic">
                  "{selectedHistoryRun.instructions || "No custom instructions defined"}"
                </p>
              </div>

              {/* ARCHIVED LEADS & LOGS */}
              <div className="space-y-3">
                <h4 className="text-sm font-sans font-bold text-white uppercase tracking-wider">Archived Deliveries</h4>
                <div className="bg-[#111317] border border-white/[0.06] rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.04] bg-white/[0.02] text-[9px] font-mono uppercase text-secondary">
                        <th className="p-3">Recipient</th>
                        <th className="p-3">Subject</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Sent At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-xs font-sans">
                      {selectedHistoryRun.leads?.map((lead: any) => (
                        <tr key={lead.id} className="hover:bg-white/[0.01]">
                          <td className="p-3">
                            <div className="text-white font-bold">{lead.name}</div>
                            <div className="text-[10px] text-secondary font-mono">{lead.email}</div>
                          </td>
                          <td className="p-3 max-w-xs truncate text-[#94a3b8]">
                            {lead.status === "failed" ? (
                              <span className="text-red-400 italic">Error: {lead.errorMessage}</span>
                            ) : (
                              "Personalized offer"
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-mono uppercase font-bold ${
                              lead.status === "sent" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              lead.status === "failed" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                              "bg-white/10 text-secondary"
                            }`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="p-3 text-[10px] text-secondary font-mono">
                            {lead.sentAt ? new Date(lead.sentAt.seconds ? lead.sentAt.seconds * 1000 : lead.sentAt).toLocaleString() : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
