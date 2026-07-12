import React, { useState, useEffect } from "react";
import { Search, Filter, Mail, Eye, Calendar, User, Building, AlertCircle, X, ExternalLink } from "lucide-react";
import { db } from "../../firebase";
import { collection, query, onSnapshot, getDocs, doc } from "firebase/firestore";

interface AIEmailLogsProps {
  campaignId: string;
}

export default function AIEmailLogs({ campaignId }: AIEmailLogsProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "generated" | "sent" | "failed">("all");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    if (!campaignId) return;

    setLoading(true);
    const logsRef = collection(db, "aiCampaigns", campaignId, "logs");
    
    // Listen to real-time dispatches
    const unsubscribe = onSnapshot(
      logsRef,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort descending by sentAt/generatedAt
        list.sort((a: any, b: any) => {
          const tA = a.sentAt?.seconds ? a.sentAt.seconds * 1000 : (typeof a.sentAt === "string" ? new Date(a.sentAt).getTime() : 0);
          const tB = b.sentAt?.seconds ? b.sentAt.seconds * 1000 : (typeof b.sentAt === "string" ? new Date(b.sentAt).getTime() : 0);
          return tB - tA;
        });
        setLogs(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error reading campaign logs:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [campaignId]);

  // Filtering logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.emailContent?.subject?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "failed":
        return "bg-red-500/10 text-red-400 border border-red-500/20";
      case "generated":
        return "bg-[#2563eb]/10 text-blue-400 border border-blue-400/20";
      default:
        return "bg-white/10 text-secondary border border-white/5";
    }
  };

  const getSentDate = (ts: any) => {
    if (!ts) return "N/A";
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by email, name..."
            className="w-full bg-[#111317] border border-white/[0.06] focus:border-[#2563eb]/30 rounded-xl pl-9 pr-4 py-2 font-mono text-[10px] text-white outline-none placeholder:text-secondary uppercase tracking-wider"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {["all", "generated", "sent", "failed"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl font-mono text-[9px] uppercase tracking-widest border transition-all ${
                statusFilter === status
                  ? "bg-[#2563eb] border-[#2563eb] text-white font-bold"
                  : "bg-[#111317] border-white/[0.06] text-secondary hover:text-white"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-[#111317] border border-white/[0.06] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-t-transparent border-[#2563eb] rounded-full animate-spin mx-auto mb-3" />
            <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">Loading delivery metrics...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-secondary font-mono text-[10px] uppercase tracking-widest">
            No execution logs matching filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                  <th className="p-4 font-mono text-[9px] uppercase tracking-wider text-secondary">Lead Details</th>
                  <th className="p-4 font-mono text-[9px] uppercase tracking-wider text-secondary">Subject / Preview</th>
                  <th className="p-4 font-mono text-[9px] uppercase tracking-wider text-secondary">Batch</th>
                  <th className="p-4 font-mono text-[9px] uppercase tracking-wider text-secondary">Status</th>
                  <th className="p-4 font-mono text-[9px] uppercase tracking-wider text-secondary">Timestamp</th>
                  <th className="p-4 font-mono text-[9px] uppercase tracking-wider text-secondary text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.01] transition-all">
                    <td className="p-4">
                      <div className="font-sans font-bold text-xs text-white">{log.name}</div>
                      <div className="font-mono text-[9px] text-[#94a3b8] mt-0.5">{log.email}</div>
                    </td>
                    <td className="p-4 max-w-xs truncate">
                      <div className="font-sans text-xs text-white truncate font-medium">{log.emailContent?.subject || "No Subject"}</div>
                      <div className="font-sans text-[10px] text-secondary truncate mt-0.5">
                        {log.errorMessage ? `Error: ${log.errorMessage}` : (log.emailContent?.body?.replace(/<[^>]*>/g, "") || "No content")}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-[10px] text-white">
                      #{log.batchNumber || 1}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-mono uppercase font-bold tracking-widest ${getStatusBadge(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[9px] text-secondary">
                      {getSentDate(log.sentAt)}
                    </td>
                    <td className="p-4 text-right">
                      {log.status !== "failed" && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 hover:bg-white/[0.04] border border-transparent hover:border-white/[0.08] text-blue-400 hover:text-white rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider"
                          title="View generated sales copy with image preview"
                        >
                          <Eye size={12} /> View Copy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1014] border border-white/[0.08] w-full max-w-2xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#2563eb]">
                <Mail size={16} />
                <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Personalized Email Preview</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 bg-white/5 border border-white/10 hover:border-white/20 text-secondary hover:text-white rounded-lg transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* META INFO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl">
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-secondary uppercase tracking-wider flex items-center gap-1">
                    <User size={10} /> Recipient Name
                  </span>
                  <p className="text-xs font-sans font-bold text-white">{selectedLog.name}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-secondary uppercase tracking-wider flex items-center gap-1">
                    <Mail size={10} /> Recipient Email
                  </span>
                  <p className="text-xs font-sans font-bold text-[#2563eb]">{selectedLog.email}</p>
                </div>
              </div>

              {/* SUBJECT */}
              <div className="space-y-1 bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl">
                <span className="text-[8px] font-mono text-secondary uppercase tracking-wider">Subject Line</span>
                <p className="text-xs font-sans font-bold text-white mt-1">
                  {selectedLog.emailContent?.subject || "Personalized Offer"}
                </p>
              </div>

              {/* EMAIL BODY */}
              <div className="space-y-2 bg-white/[0.02] border border-white/[0.06] p-6 rounded-2xl">
                <span className="text-[8px] font-mono text-secondary uppercase tracking-wider block border-b border-white/[0.04] pb-2">HTML Sales Copy Content</span>
                <div 
                  className="text-xs text-[#94a3b8] leading-relaxed font-sans space-y-3"
                  dangerouslySetInnerHTML={{ __html: selectedLog.emailContent?.body || "" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
