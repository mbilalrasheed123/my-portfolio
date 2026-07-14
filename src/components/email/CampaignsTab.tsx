import React, { useState, useEffect } from "react";
import { Plus, Play, Pause, Trash2, Edit, AlertCircle, RefreshCw, CheckCircle, Clock, Users, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { auth } from "../../firebase";
import CampaignDetailOverview from "./CampaignDetailOverview";

interface CampaignsTabProps {
  onEditCampaign: (campaign: any) => void;
  onCreateNew: () => void;
}

export default function CampaignsTab({ onEditCampaign, onCreateNew }: CampaignsTabProps) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/campaigns", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCampaigns(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load campaigns: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    setError(null);
    setSuccess(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/email/campaigns/${id}/toggle`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle campaign status.");
      }
      
      setSuccess(`Campaign successfully moved to: ${data.status}`);
      await fetchCampaigns();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm("Are you absolutely sure you want to delete this campaign? All recipient records will be deleted as well.")) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [id]: true }));
    setError(null);
    setSuccess(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/email/campaigns/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(await res.text());
      
      setSuccess("Campaign deleted successfully");
      await fetchCampaigns();
    } catch (err: any) {
      console.error(err);
      setError("Failed to delete campaign: " + (err?.message || String(err)));
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleSendCampaignNow = async (id: string) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    setError(null);
    setSuccess(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/send-now", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ campaignId: id })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      if (data.processed === 0) {
        setError("No pending emails found for this campaign to send.");
      } else {
        setSuccess(`Sent ${data.successes} emails successfully for this campaign!`);
      }
      await fetchCampaigns();
    } catch (err: any) {
      console.error(err);
      setError("Failed to send campaign emails: " + (err?.message || String(err)));
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "paused":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "draft":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "completed":
        return "bg-[#2563eb]/10 text-white/90 border-[#2563eb]/20";
      case "failed":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-white/5 text-secondary border-white/10";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* NOTIFICATIONS */}
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
            <h4 className="text-xs font-sans font-semibold text-white">Action Completed</h4>
            <p className="text-[10px] font-mono text-emerald-300 uppercase mt-1">{success}</p>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#111] pb-4">
        <div>
          <h3 className="text-xs font-mono uppercase text-secondary tracking-widest font-bold">Campaigns Control Panel</h3>
          <p className="text-[9px] font-mono text-secondary uppercase mt-0.5">Define, configure and activate targeted marketing newsletters</p>
        </div>
        <button
          onClick={onCreateNew}
          className="px-5 py-2 bg-accent text-white font-mono text-[9px] uppercase tracking-wider font-bold rounded-full hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus size={12} /> Create Campaign
        </button>
      </div>

      {/* CAMPAIGN LIST CARDS */}
      <div className="grid grid-cols-1 gap-6">
        {loading && campaigns.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={18} className="animate-spin text-accent" />
            <span className="ml-2.5 text-xs font-mono uppercase text-secondary tracking-widest">Fetching Campaigns...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl border border-line">
            <p className="text-secondary font-mono text-xs uppercase">No Campaigns Created Yet</p>
            <button
              onClick={onCreateNew}
              className="mt-4 px-6 py-2 border border-line text-white hover:border-accent text-[9px] font-mono uppercase tracking-widest rounded-full transition-all cursor-pointer"
            >
              Get Started
            </button>
          </div>
        ) : (
          campaigns.map((campaign) => {
            const isToggling = actionLoading[campaign.id] || false;
            const isExpanded = expandedCampaignId === campaign.id;
            return (
              <div 
                key={campaign.id} 
                className="glass p-6 rounded-3xl border border-line flex flex-col gap-6 hover:border-line hover:bg-white/[0.01] transition-all relative group overflow-hidden"
              >
                {/* TOP MAIN ROW */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 w-full">
                  {/* CAMPAIGN METADATA */}
                  <div className="space-y-3 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-2.5 py-0.5 border rounded-full text-[8px] font-mono uppercase tracking-widest font-bold ${getStatusBadgeClass(campaign.status)}`}>
                        {campaign.status}
                      </span>
                      <h4 className="text-base font-sans font-semibold text-white truncate">{campaign.title}</h4>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs text-secondary font-medium font-sans block truncate">
                        Subject: <span className="text-white font-semibold">{campaign.subject || "Not configured"}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-mono text-secondary uppercase">
                        <span>Created By: {campaign.createdBy?.split("@")[0] || "admin"}</span>
                        <span>•</span>
                        <span>
                          Created: {campaign.createdAt ? (
                            typeof campaign.createdAt === 'string' 
                              ? new Date(campaign.createdAt).toLocaleDateString() 
                              : new Date(campaign.createdAt?.seconds * 1000).toLocaleDateString()
                          ) : "Recently"}
                        </span>
                        {campaign.lastSentAt && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400">
                              Last Sent: {
                                typeof campaign.lastSentAt === 'string'
                                  ? new Date(campaign.lastSentAt).toLocaleString()
                                  : new Date(campaign.lastSentAt?.seconds * 1000).toLocaleString()
                              }
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {campaign.errorMessage && (
                      <p className="p-2 bg-rose-500/5 border border-rose-500/10 text-[9px] font-mono text-rose-400 uppercase rounded-lg">
                        Error: {campaign.errorMessage}
                      </p>
                    )}
                  </div>

                  {/* PROGRESS COUNTERS */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    <div className="flex items-center gap-4 border border-line/50 p-3 bg-white/[0.01] rounded-2xl">
                      <div className="p-2 bg-white/5 border border-line rounded-xl text-accent">
                        <Users size={14} />
                      </div>
                      <div>
                        <span className="text-[9px] font-mono uppercase text-secondary tracking-wider block">Sent</span>
                        <span className="text-xs font-sans text-white font-bold block mt-0.5">
                          {campaign.sentCount} / {campaign.totalRecipients || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 border border-line/50 p-3 bg-white/[0.01] rounded-2xl">
                      <div className="p-2 bg-white/5 border border-line rounded-xl text-amber-400">
                        <Clock size={14} />
                      </div>
                      <div>
                        <span className="text-[9px] font-mono uppercase text-secondary tracking-wider block">Pending</span>
                        <span className="text-xs font-sans text-amber-400 font-bold block mt-0.5">
                          {campaign.pendingCount ?? 0} emails
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto border-t border-line/30 pt-4 md:border-none md:pt-0">
                    {/* EXPAND/COLLAPSE OVERVIEW */}
                    <button
                      onClick={() => setExpandedCampaignId(isExpanded ? null : campaign.id)}
                      className={`p-2 px-3 border rounded-xl transition-all cursor-pointer flex items-center gap-1 font-mono text-[9px] uppercase ${
                        isExpanded
                          ? "bg-accent/20 border-accent text-white"
                          : "border-line hover:border-accent text-white hover:text-accent"
                      }`}
                      title="View Campaign Overview & Failed Recipient Retry"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={11} /> Hide Overview
                        </>
                      ) : (
                        <>
                          <ChevronDown size={11} /> View Overview
                        </>
                      )}
                    </button>

                    {/* SEND CAMPAIGN PENDING EMAILS NOW */}
                    {(campaign.pendingCount ?? 0) > 0 && (
                      <button
                        onClick={() => handleSendCampaignNow(campaign.id)}
                        disabled={isToggling}
                        className="p-2 px-4 rounded-xl border border-accent hover:bg-accent hover:text-white text-accent font-mono text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                        title="Send this campaign's pending emails now"
                      >
                        {isToggling ? (
                          <RefreshCw size={11} className="animate-spin" />
                        ) : (
                          <>
                            <Play size={11} /> Send Pending
                          </>
                        )}
                      </button>
                    )}

                    {/* PLAY/PAUSE */}
                    {(campaign.status === "draft" || campaign.status === "paused" || campaign.status === "active" || campaign.status === "failed") && (
                      <button
                        onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                        disabled={isToggling}
                        className={`p-2 px-4 rounded-xl border font-mono text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          campaign.status === "active"
                            ? "border-amber-500/20 hover:border-amber-500/40 text-amber-400 bg-amber-500/5"
                            : "border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                        }`}
                        title={campaign.status === "active" ? "Pause Campaign" : "Activate Campaign"}
                      >
                        {isToggling ? (
                          <RefreshCw size={11} className="animate-spin" />
                        ) : campaign.status === "active" ? (
                          <>
                            <Pause size={11} /> Pause
                          </>
                        ) : (
                          <>
                            <Play size={11} /> Activate
                          </>
                        )}
                      </button>
                    )}

                    {/* EDIT */}
                    {(campaign.status === "draft" || campaign.status === "paused") && (
                      <button
                        onClick={() => onEditCampaign(campaign)}
                        disabled={isToggling}
                        className="p-2 px-3 border border-line hover:border-accent text-white hover:text-accent rounded-xl transition-all cursor-pointer flex items-center gap-1 font-mono text-[9px] uppercase"
                        title="Edit Campaign"
                      >
                        <Edit size={11} /> Edit
                      </button>
                    )}

                    {/* DELETE */}
                    {campaign.status === "draft" && (
                      <button
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        disabled={isToggling}
                        className="p-2 border border-line hover:border-rose-500 text-secondary hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                        title="Delete Campaign"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* EXPANDABLE CAMPAIGN LEVEL OVERVIEW */}
                {isExpanded && (
                  <CampaignDetailOverview 
                    campaign={campaign} 
                    onCampaignUpdated={fetchCampaigns} 
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
