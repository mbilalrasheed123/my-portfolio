import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Save, Trash2, UserPlus, Upload, FileText, CheckCircle, AlertCircle, RefreshCw, Layers } from "lucide-react";
import { auth } from "../../firebase";

interface CreateCampaignWizardProps {
  editingCampaign: any | null;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export default function CreateCampaignWizard({ editingCampaign, onClose, onSaveSuccess }: CreateCampaignWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Campaign Form State
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [templateId, setTemplateId] = useState("");

  // Lists & Choices
  const [templates, setTemplates] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);
  
  // Recipient entry
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Templates
  const fetchTemplates = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/templates", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch recipients for active campaignId
  const fetchRecipients = async (id: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/email/recipients/campaign/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setRecipients(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTemplates();
    if (editingCampaign) {
      setCampaignId(editingCampaign.id);
      setTitle(editingCampaign.title || "");
      setSubject(editingCampaign.subject || "");
      setContent(editingCampaign.content || "");
      setTemplateId(editingCampaign.templateId || "");
      fetchRecipients(editingCampaign.id);
    }
  }, [editingCampaign]);

  const handleSaveDetails = async () => {
    if (!title) {
      setError("Campaign Title is required");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const isEdit = !!campaignId;
    const url = isEdit ? `/api/email/campaigns/${campaignId}` : "/api/email/campaigns";
    const method = isEdit ? "PUT" : "POST";

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ title, subject, content, templateId: templateId || null })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save campaign details.");
      }

      if (!campaignId && data.campaign?.id) {
        setCampaignId(data.campaign.id);
        fetchRecipients(data.campaign.id);
      }

      setSuccess("Campaign details saved successfully!");
      setStep(2); // Move to Recipients tab
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddSingleRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId) {
      setError("Please save campaign details before adding recipients.");
      return;
    }

    if (!manualEmail) {
      setError("Recipient email is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/recipients/single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ campaignId, email: manualEmail, name: manualName })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add recipient.");
      }

      setSuccess("Recipient added successfully!");
      setManualEmail("");
      setManualName("");
      fetchRecipients(campaignId);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async () => {
    if (!campaignId) {
      setError("Please save campaign details first.");
      return;
    }

    if (!csvContent) {
      setError("CSV content is empty.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/recipients/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ campaignId, csvContent })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload CSV.");
      }

      setSuccess(`CSV uploaded! Added ${data.addedCount} new recipients. (${data.duplicatesIgnored} duplicates ignored)`);
      setCsvContent("");
      fetchRecipients(campaignId);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleDeleteRecipient = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/email/recipients/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      fetchRecipients(campaignId!);
    } catch (err: any) {
      console.error(err);
      setError("Failed to delete recipient: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleClearRecipients = async () => {
    if (!window.confirm("Are you sure you want to clear the entire recipient list for this campaign?")) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/email/recipients/campaign/${campaignId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      fetchRecipients(campaignId!);
    } catch (err: any) {
      console.error(err);
      setError("Failed to clear recipient list: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ERROR / SUCCESS NOTIFICATIONS */}
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
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
          <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-sans font-semibold text-white">Wizard Status Update</h4>
            <p className="text-[10px] font-mono text-emerald-300 uppercase mt-1">{success}</p>
          </div>
        </div>
      )}

      {/* TOP WIZARD CONTROLS */}
      <div className="flex items-center justify-between border-b border-[#111] pb-4">
        <button
          onClick={onClose}
          className="p-2 border border-line hover:border-white/20 text-[#94a3b8] hover:text-white rounded-xl transition-all flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft size={12} /> Back to dashboard
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${step === 1 ? "bg-accent text-white" : "bg-white/10 text-secondary"}`}>1</span>
            <span className={step === 1 ? "text-accent font-bold" : "text-secondary"}>Details</span>
          </div>
          <div className="h-px w-6 bg-line" />
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${step === 2 ? "bg-accent text-white" : "bg-white/10 text-secondary"}`}>2</span>
            <span className={step === 2 ? "text-accent font-bold" : "text-secondary"}>Recipients</span>
          </div>
          <div className="h-px w-6 bg-line" />
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${step === 3 ? "bg-accent text-white" : "bg-white/10 text-secondary"}`}>3</span>
            <span className={step === 3 ? "text-accent font-bold" : "text-secondary"}>Review</span>
          </div>
        </div>
      </div>

      {/* STEP 1: CAMPAIGN DETAILS FORM */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="glass p-8 rounded-3xl border border-line space-y-6">
            <h3 className="text-xs font-mono uppercase text-white tracking-widest font-bold">Step 1: Campaign Configuration Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="font-mono text-[10px] uppercase text-secondary">Campaign Internal Name / Title</label>
                <input
                  type="text"
                  placeholder="e.g., Summer Product Launch Newsletter"
                  className="w-full bg-white/5 border border-line rounded-lg px-4 py-2.5 text-xs text-white outline-none focus:border-accent"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
                <p className="text-[8px] font-mono text-secondary uppercase">Only visible inside the administrative portal</p>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase text-secondary">Email Subject Line</label>
                <input
                  type="text"
                  placeholder="e.g., Discover our latest features, {{name}}! 🚀"
                  className="w-full bg-white/5 border border-line rounded-lg px-4 py-2.5 text-xs text-white outline-none focus:border-accent"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
                <p className="text-[8px] font-mono text-secondary uppercase">Supports placeholders like {"{{name}}"}</p>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase text-secondary">Email Design Template wrapping</label>
                <select
                  className="w-full bg-[#111] border border-line rounded-lg px-4 py-2.5 text-xs text-white outline-none focus:border-accent appearance-none cursor-pointer"
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                >
                  <option value="">No Template (Plain raw body text only)</option>
                  {templates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>
                <p className="text-[8px] font-mono text-secondary uppercase">Reusable templates are designed in the "Templates" tab</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="font-mono text-[10px] uppercase text-secondary">Campaign Body Content (HTML or Plain Text)</label>
                <textarea
                  rows={8}
                  placeholder="Write your email body or HTML markdowns here. Supports {{name}} and {{email}} placeholders."
                  className="w-full bg-white/5 border border-line rounded-lg px-4 py-3 text-xs text-white outline-none focus:border-accent font-mono"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleSaveDetails}
              disabled={loading}
              className="px-6 py-2 bg-accent text-white font-mono text-[9px] uppercase tracking-wider font-bold rounded-full hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Next: Recipients <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: RECIPIENT MANAGEMENT */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* LEFT COLUMN: MANUAL ENTRY & BULK CSV UPLOAD */}
            <div className="space-y-6">
              {/* BULK CSV */}
              <div className="glass p-6 rounded-3xl border border-line space-y-4">
                <h4 className="text-xs font-mono uppercase text-white tracking-widest font-bold flex items-center gap-2">
                  <Upload size={14} className="text-accent" /> Bulk Recipient CSV Upload
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white/5 border border-line hover:border-white/20 text-white rounded-xl font-mono text-[9px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload size={10} /> Choose CSV File
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <span className="text-[8px] font-mono text-secondary uppercase">
                      Expects columns: name, email
                    </span>
                  </div>

                  <textarea
                    rows={4}
                    placeholder="Or paste comma-separated lines manually, e.g.:
john@example.com, John Doe
mary@example.com, Mary Smith"
                    className="w-full bg-white/5 border border-line rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent font-mono"
                    value={csvContent}
                    onChange={e => setCsvContent(e.target.value)}
                  />

                  <button
                    onClick={handleCSVUpload}
                    disabled={loading || !csvContent}
                    className="w-full py-2 bg-white text-black font-mono text-[9px] uppercase tracking-widest font-bold rounded-xl hover:scale-101 active:scale-99 transition-all cursor-pointer"
                  >
                    Upload Recipients List
                  </button>
                </div>
              </div>

              {/* MANUAL SINGLE ENTRY */}
              <div className="glass p-6 rounded-3xl border border-line space-y-4">
                <h4 className="text-xs font-mono uppercase text-white tracking-widest font-bold flex items-center gap-2">
                  <UserPlus size={14} className="text-accent" /> Add Single Recipient Manually
                </h4>
                
                <form onSubmit={handleAddSingleRecipient} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Subscriber Name"
                      className="bg-white/5 border border-line rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent"
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                    />
                    <input
                      type="email"
                      placeholder="Subscriber Email"
                      className="bg-white/5 border border-line rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent"
                      value={manualEmail}
                      onChange={e => setManualEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-white/5 border border-line hover:border-accent text-white font-mono text-[9px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                  >
                    Add Individual
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT COLUMN: ACTIVE RECIPIENTS LIST */}
            <div className="glass p-6 rounded-3xl border border-line space-y-4 flex flex-col h-[400px]">
              <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">
                <div>
                  <h4 className="text-xs font-mono uppercase text-white tracking-widest font-bold">Configured Contacts</h4>
                  <span className="text-[8px] font-mono text-secondary uppercase">{recipients.length} / 500 Added</span>
                </div>
                {recipients.length > 0 && (
                  <button
                    onClick={handleClearRecipients}
                    className="p-1.5 border border-rose-500/30 text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg text-[8px] font-mono uppercase cursor-pointer transition-all"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="overflow-y-auto flex-1 pr-1 space-y-2">
                {recipients.map((rec) => (
                  <div key={rec.id} className="p-3 bg-white/[0.02] border border-[#111] hover:border-line rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{rec.name || rec.email.split("@")[0]}</p>
                      <p className="text-[9px] font-mono text-secondary truncate">{rec.email}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteRecipient(rec.id)}
                      className="text-secondary/60 hover:text-red-500 p-1 cursor-pointer transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}

                {recipients.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20 text-secondary opacity-40">
                    <FileText size={24} />
                    <p className="text-[9px] font-mono uppercase tracking-widest mt-2">Recipient list is empty.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-line text-secondary hover:text-white rounded-full font-mono text-[9px] uppercase tracking-wider cursor-pointer"
            >
              Previous Step
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2 bg-accent text-white font-mono text-[9px] uppercase tracking-wider font-bold rounded-full hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Review Campaign <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW AND SAVE */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="glass p-8 rounded-3xl border border-line space-y-6">
            <h3 className="text-xs font-mono uppercase text-white tracking-widest font-bold">Step 3: Review Configuration</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="p-4 bg-white/[0.02] border border-line rounded-2xl space-y-2">
                  <span className="text-[8px] font-mono text-secondary uppercase block">Subject Header</span>
                  <p className="text-sm text-white font-semibold font-sans">{subject || "(No Subject line set)"}</p>
                </div>

                <div className="p-4 bg-white/[0.02] border border-line rounded-2xl space-y-2">
                  <span className="text-[8px] font-mono text-secondary uppercase block">Message body content</span>
                  <div className="p-3 bg-white/5 border border-line rounded-lg font-mono text-[11px] leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                    {content || "(Empty message content)"}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white/[0.02] border border-line rounded-2xl space-y-2">
                  <span className="text-[8px] font-mono text-secondary uppercase block">Campaign Title (Internal)</span>
                  <p className="text-xs font-sans text-white font-bold">{title}</p>
                </div>

                <div className="p-4 bg-white/[0.02] border border-line rounded-2xl space-y-2 flex items-center gap-3">
                  <div className="p-2 bg-accent/10 border border-accent/20 rounded-xl text-accent">
                    <Layers size={14} />
                  </div>
                  <div>
                    <span className="text-[8px] font-mono text-secondary uppercase block">Selected Wrapping Template</span>
                    <span className="text-xs text-white font-bold block">
                      {templates.find(t => t.id === templateId)?.name || "Plain text (no styling wrapper)"}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-[#2563eb]/5 border border-[#2563eb]/15 rounded-2xl space-y-2">
                  <span className="text-[8px] font-mono text-secondary uppercase block">Recipient Summary</span>
                  <p className="text-base text-white font-bold font-sans">{recipients.length} Subscribed Contacts</p>
                  <p className="text-[8px] font-mono text-secondary/60 uppercase">Max limit per campaign is 500</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-line text-secondary hover:text-white rounded-full font-mono text-[9px] uppercase tracking-wider cursor-pointer"
            >
              Previous Step
            </button>
            <button
              onClick={onSaveSuccess}
              className="px-8 py-2 bg-accent text-white font-mono text-[9px] uppercase tracking-wider font-bold rounded-full hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save size={12} /> Finalize & Return to Campaigns
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
