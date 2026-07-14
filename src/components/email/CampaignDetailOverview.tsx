import React, { useState, useEffect } from "react";
import { AlertCircle, RefreshCw, History, Eye, X, Mail, CheckCircle, Clock, Trash2 } from "lucide-react";
import { auth } from "../../firebase";

interface CampaignDetailOverviewProps {
  campaign: any;
  onCampaignUpdated: () => void;
}

export default function CampaignDetailOverview({ campaign, onCampaignUpdated }: CampaignDetailOverviewProps) {
  const [failedRecipients, setFailedRecipients] = useState<any[]>([]);
  const [historyRuns, setHistoryRuns] = useState<any[]>([]);
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<any | null>(null);
  
  const [loadingFailed, setLoadingFailed] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [retryAllLoading, setRetryAllLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getAuthToken = async () => {
    return await auth.currentUser?.getIdToken();
  };

  const fetchFailedRecipients = async () => {
    setLoadingFailed(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/email/campaigns/${campaign.id}/failed-recipients`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setFailedRecipients(data.failedRecipients || []);
      }
    } catch (err) {
      console.error("Error fetching failed recipients:", err);
    } finally {
      setLoadingFailed(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/email/campaigns/${campaign.id}/history`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryRuns(data.historyRuns || []);
      }
    } catch (err) {
      console.error("Error fetching campaign run history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchFailedRecipients();
    fetchHistory();
  }, [campaign.id, campaign.status, campaign.sentCount]);

  const handleRetryRecipient = async (recId: string) => {
    setActionLoading(recId);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/email/campaigns/${campaign.id}/retry-recipient/${recId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to retry email recipient");
      }
      setSuccess("Recipient status reset to pending. It will be sent in the next batch run.");
      await fetchFailedRecipients();
      onCampaignUpdated();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryAllFailed = async () => {
    if (!window.confirm("Are you sure you want to retry all failed emails?")) {
      return;
    }
    setRetryAllLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/email/campaigns/${campaign.id}/retry-failed`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to retry failed emails");
      }
      setSuccess(data.message || "All failed recipients successfully reset to pending!");
      await fetchFailedRecipients();
      onCampaignUpdated();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setRetryAllLoading(false);
    }
  };

  const handleReactivateCampaign = async () => {
    if (!window.confirm("Are you sure you want to reactivate and re-run this campaign? This will archive your current campaign metrics & recipients to run history, reset current sent metrics, set all active recipients to pending, and reset status back to draft so you can customize your message and start a new run.")) {
      return;
    }
    setReactivateLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/email/campaigns/${campaign.id}/reactivate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reactivate campaign.");
      }
      setSuccess(data.message || "Campaign reactivated! Status reset to draft. You can now edit the message details.");
      onCampaignUpdated();
      fetchFailedRecipients();
      fetchHistory();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setReactivateLoading(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-line/30 space-y-6 w-full text-left animate-in fade-in slide-in-from-top-3 duration-300">
      
      {/* LOCAL MESSAGES */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5">
          <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-[10px] font-mono text-rose-300 uppercase">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
          <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[10px] font-mono text-emerald-300 uppercase">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CURRENT MESSAGE PREVIEW */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-line/30 pb-2">
            <h5 className="text-[10px] font-mono uppercase text-secondary tracking-wider font-bold">Active Campaign Setup Overview</h5>
            {campaign.status === "completed" && (
              <button
                onClick={handleReactivateCampaign}
                disabled={reactivateLoading}
                className="px-3 py-1 bg-accent/20 border border-accent hover:bg-accent text-white font-mono text-[8px] uppercase tracking-wider font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                {reactivateLoading ? <RefreshCw size={10} className="animate-spin" /> : "Reactivate & Re-Run"}
              </button>
            )}
          </div>

          <div className="bg-white/[0.01] border border-line p-4 rounded-2xl space-y-3 font-sans">
            <div>
              <span className="text-[9px] font-mono uppercase text-secondary block">Email Subject</span>
              <p className="text-xs text-white font-semibold mt-0.5">{campaign.subject || "No subject defined"}</p>
            </div>
            
            {campaign.templateId && (
              <div>
                <span className="text-[9px] font-mono uppercase text-secondary block">Design Template Wrapper</span>
                <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-mono text-blue-400">
                  Using Wrapped Template
                </span>
              </div>
            )}

            <div>
              <span className="text-[9px] font-mono uppercase text-secondary block">Email Body Message</span>
              <div className="max-h-48 overflow-y-auto mt-1 p-3 bg-black/20 border border-line/50 rounded-xl text-[11px] text-secondary font-mono whitespace-pre-wrap leading-relaxed">
                {campaign.content || "Empty content"}
              </div>
            </div>
          </div>
        </div>

        {/* RECIPIENTS OVERVIEW / RETRY PORTAL */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-line/30 pb-2">
            <div className="flex items-center gap-2">
              <h5 className="text-[10px] font-mono uppercase text-secondary tracking-wider font-bold">Failed Recipients Summary</h5>
              <span className="px-2 py-0.2 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-mono rounded-full">
                {campaign.failedCount || failedRecipients.length} Failed
              </span>
            </div>
            
            {failedRecipients.length > 0 && (
              <button
                onClick={handleRetryAllFailed}
                disabled={retryAllLoading}
                className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 text-rose-400 font-mono text-[8px] uppercase tracking-wider font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                {retryAllLoading ? <RefreshCw size={10} className="animate-spin" /> : "Retry All Failed"}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {loadingFailed ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={12} className="animate-spin text-accent" />
                <span className="ml-1.5 text-[10px] font-mono uppercase text-secondary">Fetching failed list...</span>
              </div>
            ) : failedRecipients.length === 0 ? (
              <div className="text-center py-10 bg-white/[0.01] border border-line/40 rounded-2xl">
                <p className="text-secondary font-mono text-[9px] uppercase">No failed email records for this campaign run</p>
                <p className="text-emerald-400/80 font-mono text-[8px] uppercase mt-1">Excellent delivery health! All systems operational</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {failedRecipients.map((rec) => (
                  <div key={rec.id} className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl flex items-center justify-between gap-3 text-left">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-sans">
                        <span className="text-xs text-white font-semibold truncate">{rec.name || "Subscriber"}</span>
                        <span className="text-[10px] text-secondary truncate">({rec.email})</span>
                      </div>
                      <p className="text-[8px] font-mono text-rose-300 uppercase leading-normal">
                        Error: {rec.errorMessage || "SMTP Error / Timed out"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRetryRecipient(rec.id)}
                      disabled={actionLoading === rec.id}
                      className="px-2.5 py-1 bg-white/5 border border-line/50 hover:border-accent text-white text-[8px] font-mono uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {actionLoading === rec.id ? <RefreshCw size={9} className="animate-spin" /> : "Retry"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RUN HISTORY LIST */}
      <div className="space-y-4 pt-4 border-t border-line/20">
        <h5 className="text-[10px] font-mono uppercase text-secondary tracking-wider font-bold">Campaign Run History / Executions Archive</h5>
        
        {loadingHistory ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw size={12} className="animate-spin text-accent" />
            <span className="ml-1.5 text-[10px] font-mono uppercase text-secondary">Loading execution logs...</span>
          </div>
        ) : historyRuns.length === 0 ? (
          <p className="text-[9px] font-mono text-secondary uppercase italic">This campaign is running for the first time. No historic runs archived yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {historyRuns.map((run, index) => (
              <div key={run.id} className="p-4 bg-white/[0.01] border border-line rounded-2xl flex flex-col justify-between gap-4">
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-white/5 text-white text-[8px] font-mono rounded font-bold uppercase">
                      Run #{historyRuns.length - index}
                    </span>
                    <span className="text-[9px] font-mono text-secondary">
                      {run.timestamp ? (
                        typeof run.timestamp === 'string'
                          ? new Date(run.timestamp).toLocaleDateString()
                          : new Date(run.timestamp.seconds * 1000).toLocaleDateString()
                      ) : "Recently"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-white font-sans font-semibold truncate">Subject: {run.subject || "Plain plain message"}</p>
                    <p className="text-[9px] font-mono text-secondary uppercase">
                      Delivered: <span className="text-emerald-400 font-bold">{run.sentCount}</span> / {run.totalRecipients || 0} Emails
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedHistoryRun(run)}
                  className="w-full text-center py-1.5 bg-white/5 border border-line hover:border-white/20 text-white font-mono text-[8px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VIEW HISTORIC RUN MODAL */}
      {selectedHistoryRun && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1014] border border-line w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-line flex items-center justify-between">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-accent">Archived Execution Ledger</span>
                <h3 className="text-base font-sans font-semibold text-white mt-0.5">
                  Run Details: {selectedHistoryRun.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedHistoryRun(null)}
                className="p-1.5 border border-line hover:border-white/20 text-secondary hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/[0.01] border border-line rounded-xl">
                  <span className="text-[8px] font-mono uppercase text-secondary">Run Date / Timestamp</span>
                  <p className="text-xs text-white font-sans font-semibold mt-1">
                    {selectedHistoryRun.timestamp ? (
                      typeof selectedHistoryRun.timestamp === 'string'
                        ? new Date(selectedHistoryRun.timestamp).toLocaleString()
                        : new Date(selectedHistoryRun.timestamp.seconds * 1000).toLocaleString()
                    ) : "Recently"}
                  </p>
                </div>
                <div className="p-3 bg-white/[0.01] border border-line rounded-xl">
                  <span className="text-[8px] font-mono uppercase text-secondary">Delivery Scorecard</span>
                  <p className="text-xs text-white font-sans font-semibold mt-1">
                    <span className="text-emerald-400 font-bold">{selectedHistoryRun.sentCount}</span> / {selectedHistoryRun.totalRecipients || 0} Delivered successfully
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 font-sans">
                <span className="text-[8px] font-mono uppercase text-secondary">Archived Email Subject</span>
                <div className="p-3 bg-white/[0.02] border border-line/60 rounded-xl text-xs text-white font-semibold">
                  {selectedHistoryRun.subject || "No subject recorded"}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[8px] font-mono uppercase text-secondary">Archived Email Message Content</span>
                <div className="p-4 bg-black/45 border border-line rounded-xl text-xs text-secondary font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                  {selectedHistoryRun.content || "No message content recorded"}
                </div>
              </div>

              {selectedHistoryRun.recipients && selectedHistoryRun.recipients.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[8px] font-mono uppercase text-secondary font-bold block">Recipient Dispatch Log ({selectedHistoryRun.recipients.length})</span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {selectedHistoryRun.recipients.map((rec: any) => (
                      <div key={rec.id} className="p-2 border border-line/40 rounded-lg flex items-center justify-between gap-3 text-left">
                        <div className="min-w-0 flex-1 flex items-center gap-1.5 text-[10px]">
                          <span className="text-white font-sans font-medium truncate">{rec.name || "Subscriber"}</span>
                          <span className="text-secondary font-mono truncate">({rec.email})</span>
                        </div>
                        <span className={`px-1.5 py-0.2 text-[8px] font-mono uppercase rounded border font-bold ${
                          rec.status === "sent" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {rec.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-line flex justify-end">
              <button
                onClick={() => setSelectedHistoryRun(null)}
                className="px-5 py-2 border border-line hover:border-white/20 hover:bg-white/5 text-white font-mono text-[9px] uppercase tracking-wider rounded-full transition-all cursor-pointer"
              >
                Close Run Logs
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
