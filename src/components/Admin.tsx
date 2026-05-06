import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Save, X, LogIn, LogOut, LayoutDashboard, Settings as SettingsIcon, FolderKanban, MessageSquare, Send, CheckCircle, Clock, Users, Award, Upload, Image as ImageIcon, ChevronLeft, ChevronRight, Bot, AlertCircle, ExternalLink, Menu, RotateCcw } from "lucide-react";
import Auth from "./Auth";
import { api } from "../lib/api";
import AdminProjectManager from "./AdminProjectManager";
import { FileUpload } from "./FileUpload";
import KeyManager from "./KeyManager";
import { auth, storage, ref, uploadBytes, getDownloadURL, deleteObject, onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "../firebase";

const ADMIN_EMAIL = "muhammadbilalrasheed78@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "mypass";

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"projects" | "settings" | "queries" | "users" | "certificates" | "leads" | "chatHistory" | "about" | "knowledgeBase" | "apiKeys">("projects");
  const [projects, setProjects] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [queries, setQueries] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [kbFilter, setKbFilter] = useState({ category: "all", status: "all" });
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [adminPassData, setAdminPassData] = useState({ current: "", new: "" });
  const [adminPassStatus, setAdminPassStatus] = useState({ error: "", success: "" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const isSuperAdmin = user?.email === ADMIN_EMAIL;

  const fetchData = async () => {
    if (!user) return;
    try {
      const fetchActions = [
        api.get("projects", user.uid),
        // If super admin, edit global settings so they reflect on homepage
        api.getSettings(isSuperAdmin ? "global" : user.uid),
        // Super admins see all queries and leads, normal users see only theirs
        api.get("contactMessages", isSuperAdmin ? undefined : user.uid),
        api.get("certificates", user.uid),
        isSuperAdmin ? api.fetchUsers() : Promise.resolve([]),
        api.get("leads", isSuperAdmin ? undefined : user.uid),
        api.fetchChatSessions(isSuperAdmin ? undefined : user.uid),
        api.fetchKnowledgeBase(user.uid)
      ];
      
      const [p, s, q, c, u, l, cs, kb] = await Promise.all(fetchActions);
      
      if (Array.isArray(p)) setProjects(p.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
      if (s) setSettings(s);
      if (Array.isArray(q)) setQueries(q.sort((a: any, b: any) => {
        const getTime = (ts: any) => {
          if (ts?.seconds) return ts.seconds * 1000;
          if (ts?.toDate) return ts.toDate().getTime();
          if (typeof ts === 'string') return new Date(ts).getTime();
          return 0;
        };
        return getTime(b.timestamp || b.createdAt) - getTime(a.timestamp || a.createdAt);
      }));
      if (Array.isArray(c)) setCertificates(c.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
      if (Array.isArray(u)) setUsers(u.sort((a: any, b: any) => {
        const getTime = (ts: any) => {
          if (ts?.seconds) return ts.seconds * 1000;
          if (ts?.toDate) return ts.toDate().getTime();
          if (typeof ts === 'string') return new Date(ts).getTime();
          return 0;
        };
        return getTime(b.lastLogin || b.createdAt) - getTime(a.lastLogin || a.createdAt);
      }));
      if (Array.isArray(l)) setLeads(l.sort((a: any, b: any) => {
        const getTime = (ts: any) => {
          if (ts?.seconds) return ts.seconds * 1000;
          if (ts?.toDate) return ts.toDate().getTime();
          if (typeof ts === 'string') return new Date(ts).getTime();
          return 0;
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      }));
      if (Array.isArray(cs)) setChatSessions(cs.sort((a: any, b: any) => {
        const getTime = (ts: any) => {
          if (ts?.seconds) return ts.seconds * 1000;
          if (ts?.toDate) return ts.toDate().getTime();
          if (typeof ts === 'string') return new Date(ts).getTime();
          return 0;
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      }));
      if (Array.isArray(kb)) setKnowledgeBase(kb.sort((a: any, b: any) => {
        const getTime = (ts: any) => {
          if (ts?.seconds) return ts.seconds * 1000;
          if (ts?.toDate) return ts.toDate().getTime();
          if (typeof ts === 'string') return new Date(ts).getTime();
          return 0;
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      }));
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const projectData = {
        ...formData,
        tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((t: string) => t.trim()) : formData.tags,
        images: Array.isArray(formData.images) ? formData.images : [formData.image].filter(Boolean),
        order: Number(formData.order) || 0
      };
      // Remove legacy image field if it exists
      delete projectData.image;

      if (isEditing === "new") {
        await api.post("projects", projectData, user.uid);
      } else if (isEditing) {
        await api.put("projects", isEditing, projectData);
      }
      
      setIsEditing(null);
      setFormData({});
      fetchData();
    } catch (error) {
      console.error("Failed to save project:", error);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.saveSettings(settings, user.uid);
      // Also save to global if super admin so it reflects on homepage
      if (isSuperAdmin) {
        await api.saveSettings(settings, "global");
      }
      alert("Success: About Me / Profile information updated!");
      fetchData();
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Error: Failed to save settings. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPassStatus({ error: "", success: "" });
    
    if (!auth.currentUser) return;

    try {
      const credential = EmailAuthProvider.credential(user.email, adminPassData.current);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, adminPassData.new);
      
      setAdminPassStatus({ error: "", success: "Admin password updated successfully!" });
      setAdminPassData({ current: "", new: "" });
    } catch (err: any) {
      console.error("Password update error:", err);
      setAdminPassStatus({ error: err.message || "Failed to update password.", success: "" });
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (window.confirm("Delete this project?")) {
      try {
        await api.delete("projects", id);
        fetchData();
      } catch (error) {
        console.error("Failed to delete project:", error);
      }
    }
  };

  const handleSaveCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const certData = {
        ...formData,
        order: Number(formData.order) || 0
      };

      if (isEditing === "new_cert") {
        await api.post("certificates", certData, user.uid);
      } else if (isEditing) {
        await api.put("certificates", isEditing, certData);
      }

      setIsEditing(null);
      setFormData({});
      fetchData();
    } catch (error) {
      console.error("Failed to save certificate:", error);
    }
  };

  const handleDeleteCertificate = async (id: string) => {
    if (window.confirm("Delete this certificate?")) {
      try {
        await api.delete("certificates", id);
        fetchData();
      } catch (error) {
        console.error("Failed to delete certificate:", error);
      }
    }
  };

  const handleReply = async (queryId: string, userEmail: string, subject: string) => {
    const text = replyText[queryId];
    if (!text) return;

    try {
      await api.put("contactMessages", queryId, {
        reply: text,
        status: "replied",
        repliedAt: new Date().toISOString()
      });

      await api.sendEmail(
        userEmail,
        `Reply to your query: ${subject}`,
        `Hello,\n\nAdmin has replied to your query "${subject}":\n\n"${text}"\n\nBest regards,\nPortfolio Team`,
        `<div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #000;">Reply to your query</h2>
          <p><strong>Subject:</strong> ${subject}</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
            ${text.replace(/\n/g, '<br/>')}
          </div>
          <p>Best regards,<br/><strong>Bilal Rasheed Portfolio Team</strong></p>
        </div>`
      );

      setReplyText({ ...replyText, [queryId]: "" });
      alert("Reply sent and user notified via email!");
      fetchData();
    } catch (error) {
      console.error("Failed to reply:", error);
    }
  };

  const handleDeleteQuery = async (id: string) => {
    if (window.confirm("Delete this query?")) {
      try {
        await api.delete("contactMessages", id);
        fetchData();
      } catch (error) {
        console.error("Failed to delete query:", error);
      }
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === user.uid) {
      alert("You cannot delete yourself (the active admin).");
      return;
    }
    if (window.confirm("Delete this user profile from database? Note: This will NOT delete their Firebase Auth account.")) {
      try {
        await api.delete("users", id);
        fetchData();
      } catch (error) {
        console.error("Failed to delete user:", error);
      }
    }
  };

  const handleSaveKnowledgeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((t: string) => t.trim()) : formData.tags,
        isEnabled: formData.isEnabled ?? true
      };

      await api.saveKnowledgeEntry(data, user.uid);
      setIsEditing(null);
      setFormData({});
      fetchData();
    } catch (error) {
      console.error("Failed to save knowledge entry:", error);
    }
  };

  const handleDeleteKnowledgeEntry = async (id: string) => {
    if (window.confirm("Delete this knowledge entry?")) {
      try {
        await api.deleteKnowledgeEntry(id);
        fetchData();
      } catch (error) {
        console.error("Failed to delete knowledge entry:", error);
      }
    }
  };

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6">
        {user && user.email !== ADMIN_EMAIL && (
          <div className="mb-8 p-6 glass border border-red-500/30 rounded-2xl max-w-md text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-display uppercase mb-2">Unauthorized Access</h3>
            <p className="text-secondary font-mono text-[10px] uppercase tracking-widest leading-relaxed">
              The account <strong>{user.email}</strong> is not authorized to access the admin panel. 
              Please sign in with the administrator account.
            </p>
            <button 
              onClick={handleLogout}
              className="mt-6 px-8 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full font-mono text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
            >
              Sign Out & Try Again
            </button>
          </div>
        )}
        
        {(!user || user.email !== ADMIN_EMAIL) && (
          <Auth loginOnly={true} onSuccess={(u) => {
            if (u.email === ADMIN_EMAIL) {
              setUser(u);
            }
          }} />
        )}
      </div>
    );
  }

  const kbCategories = ["all", ...new Set(knowledgeBase.map(kb => kb.category).filter(Boolean))];

  const filteredKb = knowledgeBase.filter(kb => {
    const matchesCategory = kbFilter.category === "all" || kb.category === kbFilter.category;
    const matchesStatus = kbFilter.status === "all" || 
                         (kbFilter.status === "enabled" && kb.isEnabled !== false) || 
                         (kbFilter.status === "disabled" && kb.isEnabled === false);
    return matchesCategory && matchesStatus;
  });

  return (
    <div className="container mx-auto px-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-line bg-white/10 flex items-center justify-center">
              {user.photoURL ? <img src={user.photoURL} alt="Admin" referrerPolicy="no-referrer" /> : <LogIn size={20} />}
            </div>
            <div>
              <h1 className="text-2xl font-display uppercase">Dashboard</h1>
              <p className="text-xs font-mono text-secondary uppercase tracking-widest">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setActiveTab("projects")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'projects' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <FolderKanban size={14} className="inline mr-2" /> Projects
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'about' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <Users size={14} className="inline mr-2" /> About Me
            </button>
            <button
              onClick={() => setActiveTab("certificates")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'certificates' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <Award size={14} className="inline mr-2" /> Certificates
            </button>
            <button
              onClick={() => setActiveTab("queries")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'queries' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <MessageSquare size={14} className="inline mr-2" /> {isSuperAdmin ? "All Queries" : "My Queries"}
              {queries.filter(q => q.status === 'pending').length > 0 && (
                <span className="ml-2 bg-accent text-white px-2 py-0.5 rounded-full text-[8px]">
                  {queries.filter(q => q.status === 'pending').length}
                </span>
              )}
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab("users")}
                className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
              >
                <Users size={14} className="inline mr-2" /> Users
              </button>
            )}
            <button
              onClick={() => setActiveTab("leads")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'leads' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <CheckCircle size={14} className="inline mr-2" /> {isSuperAdmin ? "Global Leads" : "My Leads"}
              {leads.length > 0 && <span className="ml-2 bg-accent text-white px-2 py-0.5 rounded-full text-[8px]">{leads.length}</span>}
            </button>
            <button
              onClick={() => setActiveTab("chatHistory")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'chatHistory' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <Bot size={14} className="inline mr-2" /> Chat History
            </button>
            <button
              onClick={() => setActiveTab("knowledgeBase")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'knowledgeBase' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <Users size={14} className="inline mr-2" /> Knowledge Base
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <SettingsIcon size={14} className="inline mr-2" /> Settings
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab("apiKeys")}
                className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'apiKeys' ? 'bg-[#00ffa3] text-black border-[#00ffa3]/30' : 'border border-line text-secondary hover:text-white'}`}
              >
                <RotateCcw size={14} className="inline mr-2" /> Rotation
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-6 py-2 border border-line rounded-full font-mono text-[10px] uppercase tracking-widest text-secondary hover:bg-red-500/10 hover:text-red-500 transition-all"
            >
              <LogOut size={14} className="inline mr-2" /> Logout
            </button>
            <div className="md:ml-auto pt-4 md:pt-0">
              <a 
                href={`/u/${user.uid}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2 bg-accent/10 border border-accent/20 text-accent rounded-full font-mono text-[10px] uppercase tracking-widest hover:bg-accent hover:text-white transition-all shadow-[0_0_20px_rgba(0,255,163,0.1)] hover:shadow-[0_0_25px_rgba(0,255,163,0.3)]"
              >
                View My Portfolio <ExternalLink size={14} className="animate-pulse" />
              </a>
            </div>
          </div>
        </div>

        {activeTab === "projects" && (
          <AdminProjectManager userId={user.uid} />
        )}

        {activeTab === "about" && (
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl font-display uppercase">About Me Section</h2>
            <form onSubmit={handleSaveSettings} className="glass p-8 rounded-2xl space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Profile Image</label>
                  <div className="flex items-center gap-6">
                    <div className="w-32 h-32 rounded-2xl overflow-hidden border border-line bg-white/5">
                      {settings.aboutImage ? (
                        <div className="relative group">
                          <img src={settings.aboutImage} alt="About" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={() => setSettings({ ...settings, aboutImage: "" })}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="text-secondary opacity-20" size={32} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <FileUpload 
                        folder="profile" 
                        onUpload={(urls) => setSettings({ ...settings, aboutImage: urls[0] })} 
                        label="Upload Profile Image"
                      />
                      <div className="space-y-2">
                        <label className="font-mono text-[8px] uppercase text-secondary">Or paste image URL</label>
                        <input
                          placeholder="https://example.com/profile.jpg"
                          className="w-full bg-white/5 border border-line rounded px-3 py-1.5 text-[10px] outline-none focus:border-accent"
                          value={settings.aboutImage || ""}
                          onChange={e => setSettings({ ...settings, aboutImage: e.target.value })}
                        />
                      </div>
                      <p className="text-[8px] font-mono text-secondary/60 uppercase tracking-tighter">Recommended: Square image, max 500KB</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Display Name & Hero Title</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      placeholder="Your Full Name"
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={settings.name || ""}
                      onChange={e => setSettings({ ...settings, name: e.target.value })}
                    />
                    <input
                      placeholder="Title (e.g. Full Stack Developer)"
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={settings.title || ""}
                      onChange={e => setSettings({ ...settings, title: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Hero Subtitle</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.subtitle || ""}
                    onChange={e => setSettings({ ...settings, subtitle: e.target.value })}
                    placeholder="Short description for the hero section..."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">About Title</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.aboutTitle || "Full Stack Developer & UI Designer"}
                    onChange={e => setSettings({ ...settings, aboutTitle: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">About Description (Full Text)</label>
                  <textarea
                    rows={8}
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-3 outline-none focus:border-accent text-sm leading-relaxed"
                    value={settings.aboutText || ""}
                    onChange={e => setSettings({ ...settings, aboutText: e.target.value })}
                    placeholder="Tell your story..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Experience Level</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.experienceYears || "3+ Years"}
                    onChange={e => setSettings({ ...settings, experienceYears: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Education</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.education || ""}
                    onChange={e => setSettings({ ...settings, education: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Location</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.location || "Remote / Global"}
                    onChange={e => setSettings({ ...settings, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="px-12 py-3 bg-white text-black rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
                >
                  <Save size={14} /> Update Profile Info
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "queries" && (
          <div className="space-y-8">
            <h2 className="text-3xl font-display uppercase">User Queries</h2>
            <div className="grid grid-cols-1 gap-6">
              {queries.length === 0 ? (
                <div className="text-center py-20 glass rounded-3xl border border-line">
                  <p className="text-secondary font-mono text-xs uppercase">No queries received yet</p>
                </div>
              ) : (
                queries.map((q) => (
                  <div key={q.id} className="glass p-8 rounded-2xl border-line">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest ${q.status === 'replied' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                            {q.status}
                          </span>
                          <h3 className="text-xl font-display uppercase">{q.subject}</h3>
                        </div>
                        <p className="text-xs font-mono text-secondary uppercase tracking-widest">
                          From: {q.userName} ({q.userEmail}) • {(() => {
                            const ts = q.timestamp || q.createdAt;
                            if (ts?.toDate) return ts.toDate().toLocaleString();
                            if (typeof ts === 'string') return new Date(ts).toLocaleString();
                            return 'Unknown Date';
                          })()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteQuery(q.id)}
                        className="p-2 text-secondary hover:text-red-500 transition-colors"
                        title="Delete Query"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    
                    <div className="bg-white/5 p-6 rounded-xl border border-line mb-6">
                      <p className="text-secondary text-sm leading-relaxed">{q.message}</p>
                    </div>

                    {q.reply ? (
                      <div className="bg-green-500/5 p-6 rounded-xl border border-green-500/20">
                        <div className="flex items-center gap-2 mb-2 text-green-500">
                          <CheckCircle size={16} />
                          <span className="text-[10px] font-mono uppercase tracking-widest">Your Reply</span>
                        </div>
                        <p className="text-white text-sm leading-relaxed">{q.reply}</p>
                        {q.repliedAt && (
                          <p className="text-[10px] font-mono text-secondary uppercase mt-4">
                            Sent on {typeof q.repliedAt === 'string' ? new Date(q.repliedAt).toLocaleString() : q.repliedAt?.toDate?.()?.toLocaleString() || 'N/A'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <textarea
                          placeholder="Write your reply..."
                          className="w-full bg-white/5 border border-line rounded-xl px-4 py-3 outline-none focus:border-accent text-sm resize-none"
                          rows={4}
                          value={replyText[q.id] || ""}
                          onChange={(e) => setReplyText({ ...replyText, [q.id]: e.target.value })}
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleReply(q.id, q.userEmail, q.subject)}
                            className="px-8 py-2 bg-accent text-white rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
                          >
                            <Send size={14} /> Send Reply & Notify
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-8">
            <h2 className="text-3xl font-display uppercase">Registered Users</h2>
            <div className="glass rounded-2xl border border-line overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line bg-white/5">
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Name</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Email</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Last Login</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Registered</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Status</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-line hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs">
                              {u.displayName?.charAt(0) || u.email?.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="text-sm block">{u.displayName}</span>
                            {u.emailVerified ? (
                              <span className="text-[8px] text-green-500 font-mono uppercase flex items-center gap-1">
                                <CheckCircle size={8} /> Verified
                              </span>
                            ) : (
                              <span className="text-[8px] text-yellow-500 font-mono uppercase flex items-center gap-1">
                                <AlertCircle size={8} /> Unverified
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary">{u.email}</td>
                      <td className="px-6 py-4 text-xs font-mono text-secondary">
                        {(() => {
                          const ts = u.lastLogin;
                          if (ts?.toDate) return ts.toDate().toLocaleString();
                          if (typeof ts === 'string') return new Date(ts).toLocaleString();
                          return "N/A";
                        })()}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-secondary">
                        {(() => {
                          const ts = u.createdAt;
                          if (ts?.toDate) return ts.toDate().toLocaleDateString();
                          if (typeof ts === 'string') return new Date(ts).toLocaleDateString();
                          return "N/A";
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-mono text-secondary uppercase bg-white/5 px-2 py-1 rounded">
                          Encrypted
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2 text-secondary hover:text-red-500 transition-colors"
                          title="Delete User Data"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-secondary font-mono text-xs uppercase">No users found</p>
                </div>
              )}
            </div>
            <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl">
              <p className="text-[10px] font-mono text-accent uppercase tracking-widest leading-relaxed">
                Note: For security reasons, account passwords are encrypted by Firebase Auth and are not accessible. 
                Users can reset their passwords via the "Forgot Password" flow if implemented.
              </p>
            </div>
          </div>
        )}

        {activeTab === "certificates" && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-display uppercase">Manage Certificates</h2>
              <button
                onClick={() => { setIsEditing("new_cert"); setFormData({ order: certificates.length }); }}
                className="px-6 py-2 bg-accent text-white rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2"
              >
                <Plus size={14} /> Add Certificate
              </button>
            </div>

            {(isEditing === "new_cert" || (isEditing && activeTab === "certificates")) && (
              <div className="glass p-8 rounded-2xl border-accent/30">
                <form onSubmit={handleSaveCertificate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Title</label>
                    <input
                      required
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.title || ""}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Issuer</label>
                    <input
                      required
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.issuer || ""}
                      onChange={e => setFormData({ ...formData, issuer: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Date</label>
                    <input
                      required
                      placeholder="e.g., Oct 2023"
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.date || ""}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Certificate Image</label>
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 rounded-lg overflow-hidden border border-line bg-white/5 relative group">
                        {formData.image ? (
                          <>
                            <img src={formData.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                type="button"
                                onClick={() => setFormData({ ...formData, image: "" })}
                                className="p-2 border border-white/20 rounded-full hover:bg-red-500/20 text-red-500 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center opacity-30">
                            <ImageIcon size={24} className="mb-1" />
                            <span className="text-[8px] font-mono uppercase">Empty</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <FileUpload 
                          folder="certificates"
                          onUpload={(urls) => {
                            console.log("Certificate uploaded:", urls[0]);
                            setFormData({ ...formData, image: urls[0] });
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <input 
                            placeholder="Or paste URL..."
                            className="bg-white/5 border border-line rounded px-2 py-1 text-[10px] outline-none w-32 focus:border-accent"
                            value={formData.image || ""}
                            onChange={e => setFormData({ ...formData, image: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Verification Link (Optional)</label>
                    <input
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.verify || ""}
                      onChange={e => setFormData({ ...formData, verify: e.target.value })}
                    />
                    <p className="text-[8px] font-mono text-secondary uppercase">If empty, "Verify Certificate" button will not show on main page.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">External Link (Optional)</label>
                    <input
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.link || ""}
                      onChange={e => setFormData({ ...formData, link: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Description / About Certificate</label>
                    <textarea
                      rows={4}
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.description || ""}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Display Order</label>
                    <input
                      type="number"
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.order ?? ""}
                      onChange={e => setFormData({ ...formData, order: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => { setIsEditing(null); setFormData({}); }}
                      className="px-6 py-2 border border-line rounded-full font-mono text-[10px] uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-2 bg-white text-black rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2"
                    >
                      <Save size={14} /> Save Certificate
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {certificates.map((cert) => (
                <div key={cert.id} className="glass rounded-2xl overflow-hidden border-line group">
                  <div className="aspect-[4/3] relative">
                    {cert.image ? (
                      <img src={cert.image} alt={cert.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center">
                        <span className="text-[10px] font-mono text-secondary uppercase">No Image</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <button
                        onClick={() => { setIsEditing(cert.id); setFormData(cert); }}
                        className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteCertificate(cert.id)}
                        className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-display uppercase mb-1">{cert.title}</h3>
                    <p className="text-accent text-[10px] font-mono uppercase tracking-widest mb-2">{cert.issuer}</p>
                    <p className="text-secondary text-xs">{cert.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display uppercase mb-8">Site Settings</h2>
            <form onSubmit={handleSaveSettings} className="glass p-8 rounded-2xl space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4 md:col-span-2 border-b border-line pb-8 mb-4">
                  <h3 className="text-lg font-display uppercase">Logo Customization</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="font-mono text-[10px] uppercase text-secondary">Logo Type</label>
                      <select 
                        className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent text-white"
                        value={settings.logoType || "text"}
                        onChange={e => setSettings({ ...settings, logoType: e.target.value })}
                      >
                        <option value="text">Text Logo (Default)</option>
                        <option value="image">Image Logo</option>
                      </select>
                    </div>
                    {settings.logoType === "image" ? (
                      <div className="space-y-2">
                        <label className="font-mono text-[10px] uppercase text-secondary">Logo Image</label>
                        <div className="flex items-center gap-4">
                          {settings.logoUrl && (
                            <img src={settings.logoUrl} alt="Logo Preview" className="h-10 w-auto object-contain bg-white/5 p-1 rounded" referrerPolicy="no-referrer" />
                          )}
                          <FileUpload 
                            folder="branding" 
                            onUpload={(urls) => setSettings({ ...settings, logoUrl: urls[0] })} 
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="font-mono text-[10px] uppercase text-secondary">Logo Text</label>
                        <input
                          className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                          value={settings.logoText || "Bilal"}
                          onChange={e => setSettings({ ...settings, logoText: e.target.value })}
                          placeholder="e.g. BILAL"
                        />
                      </div>
                    )}
                    <div className="space-y-2 md:col-span-2">
                      <label className="font-mono text-[10px] uppercase text-secondary">Logo Alt Text (Accessibility)</label>
                      <input
                        className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                        value={settings.logoAlt || "Bilal Rasheed Logo"}
                        onChange={e => setSettings({ ...settings, logoAlt: e.target.value })}
                        placeholder="e.g. Bilal Rasheed - Web Portfolio"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Display Name</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.name || ""}
                    onChange={e => setSettings({ ...settings, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Hero Title</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.title || ""}
                    onChange={e => setSettings({ ...settings, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Hero Subtitle</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.subtitle || ""}
                    onChange={e => setSettings({ ...settings, subtitle: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">About Text</label>
                  <textarea
                    rows={6}
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.aboutText || ""}
                    onChange={e => setSettings({ ...settings, aboutText: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Experience Years</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.experienceYears || ""}
                    onChange={e => setSettings({ ...settings, experienceYears: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Education</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.education || ""}
                    onChange={e => setSettings({ ...settings, education: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Location</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.location || ""}
                    onChange={e => setSettings({ ...settings, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Email</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.email || ""}
                    onChange={e => setSettings({ ...settings, email: e.target.value })}
                  />
                  <p className="text-[8px] font-mono text-secondary/60 uppercase">Note: Email notifications require SMTP config in environment variables.</p>
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Phone</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.phone || ""}
                    onChange={e => setSettings({ ...settings, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">GitHub URL</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.githubUrl || ""}
                    onChange={e => setSettings({ ...settings, githubUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">LinkedIn URL</label>
                  <input
                    className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                    value={settings.linkedinUrl || ""}
                    onChange={e => setSettings({ ...settings, linkedinUrl: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="px-12 py-3 bg-white text-black rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
                >
                  <Save size={14} /> Save All Settings
                </button>
              </div>
            </form>

            <div className="mt-12 pt-12 border-t border-line">
              <h2 className="text-3xl font-display uppercase mb-8">Admin Security</h2>
              <form onSubmit={handleUpdateAdminPassword} className="glass p-8 rounded-2xl space-y-6">
                {adminPassStatus.error && <p className="text-red-500 text-xs font-mono uppercase">{adminPassStatus.error}</p>}
                {adminPassStatus.success && <p className="text-green-500 text-xs font-mono uppercase">{adminPassStatus.success}</p>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Current Password</label>
                    <input
                      type="password"
                      required
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={adminPassData.current}
                      onChange={e => setAdminPassData({ ...adminPassData, current: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">New Password</label>
                    <input
                      type="password"
                      required
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={adminPassData.new}
                      onChange={e => setAdminPassData({ ...adminPassData, new: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-8 py-2 bg-red-500/20 text-red-500 border border-red-500/30 rounded-full font-mono text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                  >
                    Change Admin Password
                  </button>
                </div>
                <p className="text-[8px] font-mono text-secondary uppercase tracking-widest">
                  Initial password is: <span className="text-white">{DEFAULT_ADMIN_PASSWORD}</span>. Please change it immediately for safety.
                </p>
              </form>
            </div>
          </div>
        )}
        {activeTab === "leads" && (
          <div className="space-y-8">
            <h2 className="text-3xl font-display uppercase">Generated Leads</h2>
            <div className="glass rounded-2xl border border-line overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line bg-white/5">
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Contact</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Email/Phone</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Project Description</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b border-line hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium">{l.name}</span>
                        <div className="text-[10px] font-mono text-accent uppercase">{l.source}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">{l.email}</div>
                        <div className="text-xs text-secondary">{l.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-secondary line-clamp-2 max-w-xs">{l.description}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-secondary">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-secondary font-mono text-xs uppercase">No leads found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "chatHistory" && (
          <div className="space-y-8">
            <h2 className="text-3xl font-display uppercase">Chat History</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {chatSessions.map((s) => (
                <div key={s.id} className="glass p-6 rounded-2xl border-line flex flex-col h-[400px]">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-sm font-display uppercase">{s.userName}</h4>
                      <span className="text-[10px] font-mono text-secondary uppercase">
                        {s.isGuest ? "Guest" : "Registered User"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-accent uppercase">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                    {s.messages.map((m: any, idx: number) => (
                      <div key={idx} className={`p-2 rounded-lg text-[10px] ${m.role === 'user' ? 'bg-accent/10 border border-accent/20 ml-4' : 'bg-white/5 border border-line mr-4'}`}>
                        <div className="font-mono uppercase opacity-50 mb-1">{m.role}</div>
                        <div className="text-secondary leading-relaxed">{m.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {chatSessions.length === 0 && (
              <div className="text-center py-20 glass rounded-3xl border border-line">
                <p className="text-secondary font-mono text-xs uppercase">No chat sessions found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "knowledgeBase" && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-3xl font-display uppercase">AI Knowledge Base</h2>
                <p className="text-xs font-mono text-secondary uppercase tracking-widest mt-1">
                  Manage info for the Smart Assistant
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-white/5 border border-line rounded-full px-4 py-1.5">
                  <span className="text-[9px] font-mono text-secondary uppercase">Category</span>
                  <select 
                    className="bg-transparent text-[10px] font-mono uppercase outline-none focus:text-[#00ffa3]"
                    value={kbFilter.category}
                    onChange={(e) => setKbFilter({ ...kbFilter, category: e.target.value })}
                  >
                    {kbCategories.map(cat => <option key={cat} value={cat} className="bg-black">{cat}</option>)}
                  </select>
                </div>
                
                <div className="flex items-center gap-2 bg-white/5 border border-line rounded-full px-4 py-1.5">
                  <span className="text-[9px] font-mono text-secondary uppercase">Status</span>
                  <select 
                    className="bg-transparent text-[10px] font-mono uppercase outline-none focus:text-[#00ffa3]"
                    value={kbFilter.status}
                    onChange={(e) => setKbFilter({ ...kbFilter, status: e.target.value })}
                  >
                    <option value="all" className="bg-black">All</option>
                    <option value="enabled" className="bg-black">Enabled</option>
                    <option value="disabled" className="bg-black">Disabled</option>
                  </select>
                </div>

                <button
                  onClick={() => { setIsEditing("new_kb"); setFormData({ isEnabled: true, tags: "" }); }}
                  className="px-6 py-2 bg-[#00ffa3] text-black rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
                >
                  <Plus size={14} /> Add Info
                </button>
              </div>
            </div>

            {(isEditing === "new_kb" || (isEditing && activeTab === "knowledgeBase")) && (
              <div className="glass p-8 rounded-2xl border-[#00ffa3]/30">
                <form onSubmit={handleSaveKnowledgeEntry} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Category</label>
                    <select
                      required
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-[#00ffa3] text-white"
                      value={formData.category || ""}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      <option value="Basic Info">Basic Info</option>
                      <option value="Preferences">Preferences</option>
                      <option value="Business Info">Business Info</option>
                      <option value="Custom Notes">Custom Notes</option>
                      <option value="FAQs">FAQs</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Title / Question</label>
                    <input
                      required
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-[#00ffa3]"
                      value={formData.title || ""}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Content / Answer</label>
                    <textarea
                      required
                      rows={6}
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-[#00ffa3]"
                      value={formData.content || ""}
                      onChange={e => setFormData({ ...formData, content: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Tags (comma separated)</label>
                    <input
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-[#00ffa3]"
                      value={formData.tags || ""}
                      onChange={e => setFormData({ ...formData, tags: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <input
                      type="checkbox"
                      id="isEnabled"
                      checked={formData.isEnabled ?? true}
                      onChange={e => setFormData({ ...formData, isEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-line bg-white/5 text-[#00ffa3] focus:ring-[#00ffa3]"
                    />
                    <label htmlFor="isEnabled" className="font-mono text-[10px] uppercase text-secondary cursor-pointer">
                      Enable for AI use
                    </label>
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => { setIsEditing(null); setFormData({}); }}
                      className="px-6 py-2 border border-line rounded-full font-mono text-[10px] uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-2 bg-white text-black rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2"
                    >
                      <Save size={14} /> Save Entry
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredKb.length === 0 ? (
                <div className="col-span-full text-center py-20 glass rounded-3xl border border-line">
                  <p className="text-secondary font-mono text-xs uppercase">No entries match your search</p>
                </div>
              ) : (
                filteredKb.map((kb) => (
                  <div key={kb.id} className={`glass p-6 rounded-2xl border-line group relative transition-all hover:border-[#00ffa3]/30 ${!kb.isEnabled ? 'opacity-50 grayscale' : ''}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-white/5 border border-line rounded text-[8px] font-mono uppercase text-[#00ffa3] tracking-wider">
                            {kb.category}
                          </span>
                          {!kb.isEnabled && <span className="text-[8px] font-mono text-red-500 uppercase tracking-widest">[Disabled]</span>}
                        </div>
                        <h3 className="text-lg font-display uppercase leading-tight line-clamp-2">{kb.title}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setIsEditing(kb.id); setFormData(kb); }}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-secondary hover:text-white"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteKnowledgeEntry(kb.id)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-secondary hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-secondary line-clamp-4 leading-relaxed font-light mb-4 italic">"{kb.content}"</p>
                    <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-1">
                      {(Array.isArray(kb.tags) ? kb.tags : (kb.tags || "").split(',').filter(Boolean)).map((tag: string, i: number) => (
                        <span key={i} className="text-[8px] font-mono text-secondary/60 uppercase bg-white/5 px-1.5 py-0.5 rounded">
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            {knowledgeBase.length === 0 && (
              <div className="text-center py-20 glass rounded-3xl border border-line">
                <p className="text-secondary font-mono text-xs uppercase">Your Knowledge Base is empty</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "apiKeys" && isSuperAdmin && (
          <KeyManager />
        )}
      </div>
  );
}
