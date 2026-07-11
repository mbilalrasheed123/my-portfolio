import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, query, orderBy, limit, onSnapshot, getDocs } from "firebase/firestore";
import { AlertCircle, CheckCircle, Search, Clock, RefreshCw, Layers } from "lucide-react";

export default function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    setLoading(true);
    // Realtime subscription to the emailLogs collection
    const q = query(
      collection(db, "emailLogs"),
      orderBy("sentAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to email logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.recipientEmail?.toLowerCase().includes(search.toLowerCase()) || 
                          log.campaignId?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* FILTER & SEARCH CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#111] pb-4">
        <div>
          <h3 className="text-xs font-mono uppercase text-secondary tracking-widest font-bold">Dispatches & Event Log Trace</h3>
          <p className="text-[9px] font-mono text-secondary uppercase mt-0.5">Chronological records of all outbound newsletter emails</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative shrink-0 w-full sm:w-auto">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              placeholder="Search by email..."
              className="w-full sm:w-48 bg-white/5 border border-line rounded-full pl-8 pr-4 py-1.5 text-[10px] text-white outline-none focus:border-accent font-mono uppercase"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="bg-[#111] border border-line rounded-full px-4 py-1.5 text-[10px] text-white outline-none focus:border-accent font-mono uppercase cursor-pointer appearance-none shrink-0"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Logs</option>
            <option value="sent">Succeeded</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* EVENT LOG TABLE */}
      <div className="glass rounded-3xl border border-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/5 font-mono text-[9px] uppercase text-secondary">
                <th className="px-6 py-4 font-semibold">Recipient Contact</th>
                <th className="px-6 py-4 font-semibold">Campaign ID Reference</th>
                <th className="px-6 py-4 font-semibold">Dispatch status</th>
                <th className="px-6 py-4 font-semibold">Method</th>
                <th className="px-6 py-4 font-semibold">Dispatched Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredLogs.map((log) => (
                <tr 
                  key={log.id} 
                  className="hover:bg-white/[0.01] transition-colors cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <td className="px-6 py-3.5 text-xs text-white font-medium">{log.recipientEmail}</td>
                  <td className="px-6 py-3.5 text-[10px] font-mono text-secondary uppercase truncate max-w-[150px]">{log.campaignId}</td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2 py-0.5 border rounded text-[8px] font-mono uppercase tracking-wide flex items-center gap-1 w-fit ${
                      log.status === "sent" 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}>
                      {log.status === "sent" ? (
                        <>
                          <CheckCircle size={8} /> Sent
                        </>
                      ) : (
                        <>
                          <AlertCircle size={8} /> Failed
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-[10px] font-mono text-secondary uppercase">
                    {log.smtpUsed || "SMTP"}
                  </td>
                  <td className="px-6 py-3.5 text-[10px] font-mono text-secondary">
                    {log.sentAt ? (
                      log.sentAt.toDate 
                        ? log.sentAt.toDate().toLocaleString() 
                        : new Date(log.sentAt?.seconds * 1000).toLocaleString()
                    ) : "Recently"}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-[9px] font-mono uppercase text-secondary">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw size={12} className="animate-spin text-accent" /> Loading Logs...
                      </div>
                    ) : "No log events correspond to current filters"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL FOR CLICKED LOGS (ESPECIALLY USEFUL FOR ERROR DETAILS) */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="glass max-w-lg w-full rounded-3xl border border-line p-6 space-y-6 animate-in zoom-in-95 duration-200 relative">
            <div className="flex items-start justify-between border-b border-line pb-3">
              <div>
                <h4 className="text-xs font-mono uppercase text-white tracking-widest font-bold">Log Details Trace</h4>
                <p className="text-[9px] font-mono text-secondary uppercase mt-0.5">Event reference: {selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-secondary hover:text-white font-mono text-[9px] uppercase cursor-pointer border border-line rounded-lg px-2 py-1"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-secondary uppercase block">Recipient Contact</span>
                  <span className="text-white font-semibold">{selectedLog.recipientEmail}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-secondary uppercase block">Campaign ID</span>
                  <span className="text-white font-mono break-all">{selectedLog.campaignId}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-secondary uppercase block">Dispatch Status</span>
                  <span className={`px-1.5 py-0.5 border rounded text-[8px] font-mono uppercase tracking-wide w-fit block ${
                    selectedLog.status === "sent" 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  }`}>
                    {selectedLog.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-secondary uppercase block">SMTP Server User</span>
                  <span className="text-white font-mono truncate block">{selectedLog.smtpUsed || "SMTP Sandbox"}</span>
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl space-y-2">
                  <span className="text-[8px] font-mono text-rose-400 uppercase tracking-widest font-bold block">Error trace message</span>
                  <div className="p-3 bg-black/30 border border-[#222] rounded-xl font-mono text-[10px] text-rose-300 select-all overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}

              {selectedLog.status === "sent" && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl flex items-center gap-3">
                  <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                  <div>
                    <h5 className="text-[10px] font-sans font-bold text-white">Dispatched successfully</h5>
                    <p className="text-[9px] font-mono text-secondary uppercase mt-0.5">Nodemailer successfully delivered the package to the upstream SMTP gateway.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
