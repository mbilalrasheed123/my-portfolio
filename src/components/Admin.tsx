import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Save, X, LogIn, LogOut, LayoutDashboard, Settings as SettingsIcon, FolderKanban, MessageSquare, Send, CheckCircle, Clock, Users, Award, Upload, Image as ImageIcon, ChevronLeft, ChevronRight, Bot } from "lucide-react";
import Auth from "./Auth";
import { api } from "../lib/api";
import AdminProjectManager from "./AdminProjectManager";
import { auth, storage, ref, uploadBytes, getDownloadURL, deleteObject, onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "../firebase";

const ADMIN_EMAIL = "muhammadbilalrasheed78@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "mypass";

const FileUpload = ({ onUpload, folder = "general", multiple = false }: { onUpload: (urls: string[]) => void, folder?: string, multiple?: boolean }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    console.log(`Starting upload for ${files.length} files to folder: ${folder}`);
    setUploading(true);
    const urls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Uploading file: ${file.name}, size: ${file.size} bytes`);
        const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        console.log(`Upload successful for ${file.name}. URL: ${url}`);
        urls.push(url);
      }
      onUpload(urls);
    } catch (error: any) {
      console.error("Upload failed details:", error);
      alert(`Upload failed: ${error.message || "Unknown error"}. Check console for details.`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        multiple={multiple}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        ref={fileInputRef}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-line rounded-lg hover:bg-white/20 transition-all disabled:opacity-50"
      >
        {uploading ? <Clock className="animate-spin" size={16} /> : <Upload size={16} />}
        <span className="font-mono text-[10px] uppercase tracking-widest">
          {uploading ? "Uploading..." : multiple ? "Upload Images" : "Upload Image"}
        </span>
      </button>
    </div>
  );
};

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"projects" | "settings" | "queries" | "users" | "certificates" | "leads" | "chatHistory" | "knowledgeBase">("projects");
  const [projects, setProjects] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [queries, setQueries] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [adminPassData, setAdminPassData] = useState({ current: "", new: "" });
  const [adminPassStatus, setAdminPassStatus] = useState({ error: "", success: "" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u && u.email === ADMIN_EMAIL) {
        setUser(u);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [p, s, q, c, u, l, cs, kb] = await Promise.all([
        api.get("projects"),
        api.getSettings(),
        api.get("contactMessages"),
        api.get("certificates"),
        api.fetchUsers(),
        api.get("leads"),
        api.fetchChatSessions("all"),
        api.fetchKnowledgeBase()
      ]);
      
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
        await api.post("projects", projectData);
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
    try {
      await api.saveSettings(settings);
      alert("Settings saved!");
      fetchData();
    } catch (error) {
      console.error("Failed to save settings:", error);
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
        await api.post("certificates", certData);
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

      await api.notify({
        to: userEmail,
        subject: `Reply to your query: ${subject}`,
        text: `Hello,\n\nAdmin has replied to your query "${subject}":\n\n"${text}"\n\nBest regards,\nPortfolio Team`
      });

      setReplyText({ ...replyText, [queryId]: "" });
      alert("Reply sent and user notified!");
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

      await api.saveKnowledgeEntry(data);
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

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Auth loginOnly={true} onSuccess={(u) => {
          if (u.email === ADMIN_EMAIL) {
            setUser(u);
          } else {
            alert("This account is not authorized as an administrator.");
            signOut(auth);
          }
        }} />
      </div>
    );
  }

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
              onClick={() => setActiveTab("certificates")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'certificates' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <Award size={14} className="inline mr-2" /> Certificates
            </button>
            <button
              onClick={() => setActiveTab("queries")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'queries' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <MessageSquare size={14} className="inline mr-2" /> Queries
              {queries.filter(q => q.status === 'pending').length > 0 && (
                <span className="ml-2 bg-accent text-white px-2 py-0.5 rounded-full text-[8px]">
                  {queries.filter(q => q.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <Users size={14} className="inline mr-2" /> Users
            </button>
            <button
              onClick={() => setActiveTab("leads")}
              className={`px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${activeTab === 'leads' ? 'bg-white text-black' : 'border border-line text-secondary hover:text-white'}`}
            >
              <CheckCircle size={14} className="inline mr-2" /> Leads
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
            <button
              onClick={handleLogout}
              className="px-6 py-2 border border-line rounded-full font-mono text-[10px] uppercase tracking-widest text-secondary hover:bg-red-500/10 hover:text-red-500 transition-all"
            >
              <LogOut size={14} className="inline mr-2" /> Logout
            </button>
          </div>
        </div>

        {activeTab === "projects" && (
          <AdminProjectManager />
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
                    <th className="px-6 py-4 font-mono text-[10px] uppercase text-secondary">Password</th>
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
                          <span className="text-sm">{u.displayName}</span>
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
                    <div className="flex items-center gap-4">
                      {formData.image ? (
                        <div className="w-20 h-20 rounded-lg overflow-hidden border border-line">
                          <img src={formData.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg border border-line border-dashed flex items-center justify-center p-2 text-center">
                          <span className="text-[8px] font-mono text-secondary uppercase">No Image Selected</span>
                        </div>
                      )}
                      <FileUpload folder="certificates" onUpload={(urls) => setFormData({ ...formData, image: urls[0] })} />
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
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-display uppercase">AI Knowledge Base</h2>
              <button
                onClick={() => { setIsEditing("new_kb"); setFormData({ isEnabled: true, tags: "" }); }}
                className="px-6 py-2 bg-[#00ffa3] text-black rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <Plus size={14} /> Add Info
              </button>
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
              {knowledgeBase.map((kb) => (
                <div key={kb.id} className={`glass p-6 rounded-2xl border-line group relative ${!kb.isEnabled ? 'opacity-50 grayscale' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="px-2 py-0.5 bg-white/5 border border-line rounded text-[8px] font-mono uppercase text-secondary mb-2 inline-block">
                        {kb.category}
                      </span>
                      <h3 className="text-lg font-display uppercase leading-tight">{kb.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
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
                  <p className="text-xs text-secondary line-clamp-4 leading-relaxed italic">"{kb.content}"</p>
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-1">
                    {(kb.tags || []).map((tag: string, i: number) => (
                      <span key={i} className="text-[8px] font-mono text-secondary uppercase bg-white/5 px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {knowledgeBase.length === 0 && (
              <div className="text-center py-20 glass rounded-3xl border border-line">
                <p className="text-secondary font-mono text-xs uppercase">Your Knowledge Base is empty</p>
              </div>
            )}
          </div>
        )}
      </div>
  );
}
