import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit, AlertCircle, RefreshCw, CheckCircle, Code, Layout, Save, X } from "lucide-react";
import { auth } from "../../firebase";

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/email/templates", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTemplates(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load templates: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleOpenCreate = () => {
    setEditingTemplateId(null);
    setName("");
    setSubject("");
    setBodyHtml(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{subject}}</title>
</head>
<body style="font-family: sans-serif; background: #fafafa; padding: 40px; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #eeeeee;">
    <h2 style="color: #111111; margin-top: 0;">Muhammad Bilal Rasheed</h2>
    <div style="line-height: 1.6; font-size: 14px;">
      {{content}}
    </div>
    <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 30px 0;">
    <p style="font-size: 11px; color: #888888; text-align: center;">
      Best regards,<br>
      Muhammad Bilal Rasheed<br>
      muhammadbilalrasheed78@gmail.com
    </p>
  </div>
</body>
</html>`
    );
    setBodyText("Muhammad Bilal Rasheed\n\n{{content}}\n\nBest regards,\nMuhammad Bilal Rasheed\nmuhammadbilalrasheed78@gmail.com");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (tpl: any) => {
    setEditingTemplateId(tpl.id);
    setName(tpl.name || "");
    setSubject(tpl.subject || "");
    setBodyHtml(tpl.bodyHtml || "");
    setBodyText(tpl.bodyText || "");
    setIsFormOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !bodyHtml) {
      setError("Template name and bodyHtml wrapping content are required");
      return;
    }

    if (!bodyHtml.includes("{{content}}")) {
      setError("HTML template body MUST contain the {{content}} tag to specify where campaign text is injected.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const isEdit = !!editingTemplateId;
    const url = isEdit ? `/api/email/templates/${editingTemplateId}` : "/api/email/templates";
    const method = isEdit ? "PUT" : "POST";

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name, subject, bodyHtml, bodyText })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save template.");
      }

      setSuccess(`Template "${name}" saved successfully!`);
      setIsFormOpen(false);
      await fetchTemplates();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this template design?")) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/email/templates/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete template.");
      }

      setSuccess("Template deleted successfully");
      await fetchTemplates();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
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

      {/* HEADER CONTROL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#111] pb-4">
        <div>
          <h3 className="text-xs font-mono uppercase text-secondary tracking-widest font-bold">Designs & HTML Templates</h3>
          <p className="text-[9px] font-mono text-secondary uppercase mt-0.5">Customize layouts and visual newsletter wrapping blocks</p>
        </div>
        {!isFormOpen && (
          <button
            onClick={handleOpenCreate}
            className="px-5 py-2 bg-accent text-white font-mono text-[9px] uppercase tracking-wider font-bold rounded-full hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus size={12} /> Design Template
          </button>
        )}
      </div>

      {/* COMPOSER FORM (MODAL/FORM DRAWER STYLE) */}
      {isFormOpen && (
        <form onSubmit={handleSaveTemplate} className="glass p-8 rounded-3xl border border-line space-y-6 animate-in slide-in-from-top-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h4 className="text-xs font-mono uppercase text-white tracking-widest font-bold flex items-center gap-2">
              <Code size={14} className="text-accent" /> {editingTemplateId ? "Edit HTML Design layout" : "New Visual Template Design"}
            </h4>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-secondary hover:text-white p-1"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase text-secondary">Template Name</label>
              <input
                type="text"
                placeholder="e.g., Professional Elegant Minimalist"
                className="w-full bg-white/5 border border-line rounded-lg px-4 py-2.5 text-xs text-white outline-none focus:border-accent"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase text-secondary">Default Subject Prefix (Optional)</label>
              <input
                type="text"
                placeholder="e.g., [NEWSLETTER]"
                className="w-full bg-white/5 border border-line rounded-lg px-4 py-2.5 text-xs text-white outline-none focus:border-accent"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10px] uppercase text-secondary">HTML Document Layout wrapping</label>
                <span className="text-[8px] font-mono text-accent uppercase">Must contain {"{{content}}"} tag</span>
              </div>
              <textarea
                rows={12}
                placeholder="HTML Wrapper Code..."
                className="w-full bg-white/5 border border-line rounded-lg px-4 py-3 text-xs text-white outline-none focus:border-accent font-mono"
                value={bodyHtml}
                onChange={e => setBodyHtml(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="font-mono text-[10px] uppercase text-secondary">Plain Text Fallback Representation</label>
              <textarea
                rows={4}
                placeholder="Text layout representation..."
                className="w-full bg-white/5 border border-line rounded-lg px-4 py-3 text-xs text-white outline-none focus:border-accent font-mono"
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-line/30 pt-4">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-line text-secondary hover:text-white rounded-full font-mono text-[9px] uppercase tracking-wider cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-accent text-white font-mono text-[9px] uppercase tracking-wider font-bold rounded-full hover:scale-102 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={12} /> Save Template
            </button>
          </div>
        </form>
      )}

      {/* TEMPLATE GRID LIST */}
      {!isFormOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading && templates.length === 0 ? (
            <div className="col-span-2 flex items-center justify-center py-20">
              <RefreshCw size={18} className="animate-spin text-accent" />
              <span className="ml-2.5 text-xs font-mono uppercase text-secondary tracking-widest">Loading Template designs...</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="col-span-2 text-center py-20 glass rounded-3xl border border-line">
              <p className="text-secondary font-mono text-xs uppercase">No Custom Design Templates</p>
              <button
                onClick={handleOpenCreate}
                className="mt-4 px-6 py-2 border border-line text-white hover:border-accent text-[9px] font-mono uppercase tracking-widest rounded-full transition-all cursor-pointer"
              >
                Create First layout
              </button>
            </div>
          ) : (
            templates.map((tpl) => (
              <div 
                key={tpl.id} 
                className="glass p-6 rounded-3xl border border-line space-y-4 hover:border-line hover:bg-white/[0.01] transition-all relative group flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                      <Layout size={14} />
                    </div>
                    <h4 className="text-sm font-sans font-bold text-white">{tpl.name}</h4>
                  </div>
                  
                  <div className="text-[10px] font-mono text-secondary uppercase space-y-0.5">
                    <p>ID: {tpl.id}</p>
                    {tpl.subject && <p>Prefix: {tpl.subject}</p>}
                    <p>Created: {tpl.createdAt ? (typeof tpl.createdAt === 'string' ? new Date(tpl.createdAt).toLocaleDateString() : new Date(tpl.createdAt?.seconds * 1000).toLocaleDateString()) : "Recently"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-line/20 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(tpl)}
                    className="flex-1 py-1.5 border border-line hover:border-accent text-secondary hover:text-white rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 font-mono text-[9px] uppercase"
                  >
                    <Edit size={10} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="p-1.5 px-3 border border-line hover:border-rose-500 text-secondary hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
