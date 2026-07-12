import React, { useState, useEffect } from "react";
import { 
  Sparkles, Plus, Play, Pause, Trash2, Eye, Cpu, 
  Layers, Send, AlertCircle, CheckCircle, FileText, Calendar 
} from "lucide-react";
import { db } from "../../firebase";
import { collection, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";

interface AICampaignsListProps {
  onSelectCampaign: (id: string) => void;
  onCreateNew: () => void;
}

export default function AICampaignsList({ onSelectCampaign, onCreateNew }: AICampaignsListProps) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const campaignsRef = collection(db, "aiCampaigns");
    
    const unsubscribe = onSnapshot(
      campaignsRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort descending by createdAt
        list.sort((a: any, b: any) => {
          const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() : 0);
          const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() : 0);
          return tB - tA;
        });
        setCampaigns(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error reading campaigns:", err);
        setError("Missing or insufficient permissions reading campaigns.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent select campaign trigger
    if (!window.confirm("Are you sure you want to permanently delete this AI campaign? All lead and delivery records will be cleared.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "aiCampaigns", id));
    } catch (err) {
      console.error("Failed to delete campaign:", err);
      alert("Error deleting campaign. Please try again.");
    }
  };

  const handlePause = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "aiCampaigns", id), {
        status: "paused",
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Pause fail:", err);
    }
  };

  const handleResume = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "aiCampaigns", id), {
        status: "active",
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Resume fail:", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "active":
        return "bg-[#2563eb]/10 text-blue-400 border border-blue-400/20 animate-pulse";
      case "paused":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "generating":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "ready-to-send":
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
      case "draft":
      default:
        return "bg-white/[0.06] text-secondary border border-white/[0.04]";
    }
  };

  const getModelLabel = (model: string) => {
    switch (model) {
      case "flash-lite": return "Gemini 3.1 Flash-Lite (15 RPM)";
      case "flash": return "Gemini 3.5 Flash (10 RPM)";
      case "2.5-flash": return "Gemini 2.5 Flash (10 RPM)";
      case "2.5-pro": return "Gemini 2.5 Pro (2 RPM)";
      default: return model || "flash-lite";
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-display uppercase tracking-tight text-white">AI Campaigns Registry</h3>
          <p className="text-[10px] font-mono text-secondary uppercase tracking-widest mt-0.5">
            Create and monitor targeted lead personalizations & SMTP dispatches
          </p>
        </div>

        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 active:scale-95 text-white rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(37,99,235,0.25)] font-bold self-start sm:self-auto"
        >
          <Plus size={12} /> Create Campaign
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-3">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 border-2 border-t-transparent border-[#2563eb] rounded-full animate-spin mx-auto mb-4" />
          <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">Polling campaigns registry node...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-[#111317] border border-white/[0.06] rounded-3xl p-12 text-center space-y-4">
          <div className="p-4 bg-white/5 rounded-full w-fit mx-auto border border-white/10 text-secondary">
            <Sparkles size={24} />
          </div>
          <div>
            <h4 className="text-sm font-sans font-bold text-white">No active AI Campaigns found</h4>
            <p className="text-xs text-secondary mt-1">
              Begin by creating a new draft campaign using the Wizard.
            </p>
          </div>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-mono text-[9px] uppercase tracking-widest font-bold transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            Launch Wizard <Plus size={10} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaigns.map((camp) => {
            const total = camp.totalLeads || 0;
            const sent = camp.sentCount || 0;
            const failed = camp.failedCount || 0;
            const progress = total > 0 ? Math.round((sent / total) * 100) : 0;

            return (
              <div
                key={camp.id}
                onClick={() => onSelectCampaign(camp.id)}
                className="bg-[#111317] border border-white/[0.06] hover:border-[#2563eb]/30 rounded-3xl p-6 shadow-xl space-y-6 cursor-pointer transition-all duration-300 relative group overflow-hidden"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2563eb]/20 to-transparent group-hover:from-[#2563eb] transition-all duration-500" />

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-sans font-bold text-base text-white truncate group-hover:text-[#2563eb] transition-colors">
                      {camp.title}
                    </h4>
                    <p className="text-[10px] text-secondary font-mono uppercase tracking-wider flex items-center gap-1">
                      <Cpu size={10} /> {getModelLabel(camp.geminiModel)}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-mono uppercase font-bold tracking-widest ${getStatusBadge(camp.status)}`}>
                    {camp.status}
                  </span>
                </div>

                {/* PROGRESS GRAPH */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] font-mono text-secondary">
                    <span>PROGRESS INDICATOR</span>
                    <span className="font-bold text-white">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500" 
                      style={{ width: `${total > 0 ? (sent / total) * 100 : 0}%` }} 
                    />
                    <div 
                      className="h-full bg-red-500 transition-all duration-500" 
                      style={{ width: `${total > 0 ? (failed / total) * 100 : 0}%` }} 
                    />
                  </div>
                  <div className="flex justify-between items-center text-[8px] font-mono text-secondary uppercase mt-1">
                    <span>{sent} SENT &bull; {failed} FAILED</span>
                    <span>{camp.remainingCount || 0} REMAINING</span>
                  </div>
                </div>

                {/* CARD ACTIONS PANEL */}
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.04] mt-auto">
                  <span className="text-[8px] font-mono text-secondary uppercase tracking-widest flex items-center gap-1">
                    <Calendar size={10} /> {camp.createdAt?.seconds ? new Date(camp.createdAt.seconds * 1000).toLocaleDateString() : "Draft"}
                  </span>

                  <div className="flex gap-2">
                    {camp.status === "active" ? (
                      <button
                        onClick={(e) => handlePause(camp.id, e)}
                        className="p-1.5 hover:bg-amber-500/15 border border-transparent hover:border-amber-500/20 text-amber-400 rounded-lg transition-all"
                        title="Pause campaign dispatching"
                      >
                        <Pause size={12} />
                      </button>
                    ) : camp.status === "paused" ? (
                      <button
                        onClick={(e) => handleResume(camp.id, e)}
                        className="p-1.5 hover:bg-[#2563eb]/15 border border-transparent hover:border-[#2563eb]/20 text-blue-400 rounded-lg transition-all"
                        title="Resume campaign"
                      >
                        <Play size={12} />
                      </button>
                    ) : null}

                    <button
                      onClick={(e) => handleDeleteCampaign(camp.id, e)}
                      className="p-1.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-red-400 rounded-lg transition-all"
                      title="Permanently delete campaign"
                    >
                      <Trash2 size={12} />
                    </button>

                    <button
                      className="p-1.5 bg-white/5 border border-white/10 hover:border-white/20 text-white rounded-lg transition-all flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider"
                      title="Open full campaign control panel"
                    >
                      <Eye size={12} /> Panel
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
