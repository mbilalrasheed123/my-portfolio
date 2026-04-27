import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Save, X, LogIn, LogOut, LayoutDashboard, Settings as SettingsIcon, FolderKanban, MessageSquare, Send, CheckCircle, Clock, Users, Award, Upload, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import Auth from "./Auth";
import { api } from "../lib/api";
import { storage, ref, uploadBytes, getDownloadURL, deleteObject } from "../firebase";

const ADMIN_EMAIL = "muhammadbilalrasheed78@gmail.com";

const FileUpload = ({ onUpload, folder = "general", multiple = false }: { onUpload: (urls: string[]) => void, folder?: string, multiple?: boolean }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const urls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        urls.push(url);
      }
      onUpload(urls);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Please try again.");
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
  const [activeTab, setActiveTab] = useState<"projects" | "settings" | "queries" | "users" | "certificates">("projects");
  const [projects, setProjects] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [queries, setQueries] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const storedUser = localStorage.getItem("portfolio_user");
    if (storedUser) {
      const u = JSON.parse(storedUser);
      if (u.email === ADMIN_EMAIL) {
        setUser(u);
      }
    }
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [p, s, q, u, c] = await Promise.all([
        api.get("projects"),
        api.getSettings(),
        api.get("queries"),
        api.get("users"),
        api.get("certificates")
      ]);
      
      if (Array.isArray(p)) setProjects(p.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
      if (s) setSettings(s);
      if (Array.isArray(q)) setQueries(q.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      if (Array.isArray(u)) setUsers(u.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      if (Array.isArray(c)) setCertificates(c.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem("portfolio_user");
    setUser(null);
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
      await api.put("queries", queryId, {
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <Auth loginOnly={true} onSuccess={(u) => u.email === ADMIN_EMAIL && setUser(u)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-line bg-white/10 flex items-center justify-center">
              {user.photoURL ? <img src={user.photoURL} alt="Admin" /> : <LogIn size={20} />}
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
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-display uppercase">Manage Projects</h2>
              <button
                onClick={() => { setIsEditing("new"); setFormData({ order: projects.length, images: [] }); }}
                className="px-6 py-2 bg-accent text-white rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2"
              >
                <Plus size={14} /> Add Project
              </button>
            </div>

            {(isEditing === "new" || isEditing) && (
              <div className="glass p-8 rounded-2xl border-accent/30">
                <form onSubmit={handleSaveProject} className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <label className="font-mono text-[10px] uppercase text-secondary">Category</label>
                    <input
                      required
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.category || ""}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Description</label>
                    <textarea
                      required
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.description || ""}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Project Images</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                      {(formData.images || []).map((url: string, idx: number) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-line group">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              const newImages = [...formData.images];
                              newImages.splice(idx, 1);
                              setFormData({ ...formData, images: newImages });
                            }}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <div className="aspect-square flex items-center justify-center border border-dashed border-line rounded-lg hover:border-accent transition-colors">
                        <FileUpload 
                          multiple 
                          folder="projects" 
                          onUpload={(urls) => setFormData({ ...formData, images: [...(formData.images || []), ...urls] })} 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Tags (comma separated)</label>
                    <input
                      required
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.tags || ""}
                      onChange={e => setFormData({ ...formData, tags: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">GitHub URL</label>
                    <input
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.github || ""}
                      onChange={e => setFormData({ ...formData, github: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Demo URL</label>
                    <input
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent"
                      value={formData.demo || ""}
                      onChange={e => setFormData({ ...formData, demo: e.target.value })}
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
                      <Save size={14} /> Save Project
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div key={project.id} className="glass rounded-2xl overflow-hidden border-line group">
                  <div className="aspect-video relative">
                    <img src={project.images?.[0] || project.image} alt={project.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <button
                        onClick={() => { setIsEditing(project.id); setFormData(project); }}
                        className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-display uppercase mb-2">{project.title}</h3>
                    <p className="text-secondary text-xs line-clamp-2">{project.description}</p>
                  </div>
                </div>
              ))}
            </div>
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
                          From: {q.userName} ({q.userEmail}) • {q.createdAt?.toDate().toLocaleString()}
                        </p>
                      </div>
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
                            Sent on {q.repliedAt?.toDate().toLocaleString()}
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
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-line hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full" />
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
                        {u.lastLogin?.toDate().toLocaleString() || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-secondary">
                        {u.createdAt?.toDate().toLocaleDateString() || "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-mono text-secondary uppercase bg-white/5 px-2 py-1 rounded">
                          Encrypted
                        </span>
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
                      {formData.image && (
                        <div className="w-20 h-20 rounded-lg overflow-hidden border border-line">
                          <img src={formData.image} alt="" className="w-full h-full object-cover" />
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
                    <img src={cert.image} alt={cert.title} className="w-full h-full object-cover" />
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
          </div>
        )}
      </div>
    </div>
  );
}
