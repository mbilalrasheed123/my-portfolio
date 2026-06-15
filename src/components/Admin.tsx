import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Save, X, LogIn, LogOut, LayoutDashboard, Settings as SettingsIcon, FolderKanban, MessageSquare, Send, CheckCircle, Clock, Users, Award, Upload, Image as ImageIcon, ChevronLeft, ChevronRight, Bot, AlertCircle, ExternalLink, Menu, RotateCcw, Star, Sparkles, BookOpen, Activity, ArrowUpRight, Search } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Auth from "./Auth";
import { api } from "../lib/api";
import AdminProjectManager from "./AdminProjectManager";
import { FileUpload } from "./FileUpload";
import KeyManager from "./KeyManager";
import { auth, storage, ref, uploadBytes, getDownloadURL, deleteObject, onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, db, collection, onSnapshot, query, where } from "../firebase";

const ADMIN_EMAIL = "muhammadbilalrasheed78@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "mypass";

import ChatHistoryManager from "./ChatHistoryManager";

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "projects" | "settings" | "queries" | "users" | "certificates" | "leads" | "chatHistory" | "about" | "knowledgeBase" | "apiKeys" | "testimonials">("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("admin_theme");
    return (saved as any) || "dark";
  });

  useEffect(() => {
    localStorage.setItem("admin_theme", theme);
  }, [theme]);

  const [sidebarStyle, setSidebarStyle] = useState<"hover-collapse" | "expanded" | "floating-dock">(() => {
    const saved = localStorage.getItem("admin_sidebar_style");
    return (saved as any) || "hover-collapse";
  });

  useEffect(() => {
    localStorage.setItem("admin_sidebar_style", sidebarStyle);
  }, [sidebarStyle]);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const isSidebarCollapsed = 
    sidebarStyle === "expanded" ? false :
    sidebarStyle === "floating-dock" ? (!isSidebarHovered && !mobileSidebarOpen) :
    (!isPinned && !isSidebarHovered && !mobileSidebarOpen);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [toasts, setToasts] = useState<{ id: string; title: string; message: string; type: "lead" | "query" }[]>([]);

  const addToast = (title: string, message: string, type: "lead" | "query") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const [projects, setProjects] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [queries, setQueries] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [kbFilter, setKbFilter] = useState({ category: "all", status: "all" });
  const [queriesFilter, setQueriesFilter] = useState({ search: "", status: "all" });
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [draftingIds, setDraftingIds] = useState<{ [key: string]: boolean }>({});
  const [adminPassData, setAdminPassData] = useState({ current: "", new: "" });
  const [adminPassStatus, setAdminPassStatus] = useState({ error: "", success: "" });

  // Direct Handshake SMTP Diagnostic States
  const [smtpTestSteps, setSmtpTestSteps] = useState<string[]>([]);
  const [smtpTestLoading, setSmtpTestLoading] = useState(false);
  const [smtpTestError, setSmtpTestError] = useState<string | null>(null);
  const [smtpTestSuccess, setSmtpTestSuccess] = useState(false);

  // Gemini AI Generation Diagnostic States
  const [aiTestSteps, setAiTestSteps] = useState<string[]>([]);
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiTestError, setAiTestError] = useState<string | null>(null);
  const [aiTestSuccess, setAiTestSuccess] = useState(false);
  const [aiTestResultText, setAiTestResultText] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const isSuperAdmin = user?.email === ADMIN_EMAIL;
  const targetId = isSuperAdmin ? "global" : (user?.uid || "");

  const filteredQueries = queries.filter(q => {
    const matchesSearch = 
      !queriesFilter.search ||
      q.subject?.toLowerCase().includes(queriesFilter.search.toLowerCase()) ||
      q.userName?.toLowerCase().includes(queriesFilter.search.toLowerCase()) ||
      q.userEmail?.toLowerCase().includes(queriesFilter.search.toLowerCase()) ||
      q.message?.toLowerCase().includes(queriesFilter.search.toLowerCase()) ||
      (q.reply && q.reply.toLowerCase().includes(queriesFilter.search.toLowerCase())) ||
      (q.aiReplyText && q.aiReplyText.toLowerCase().includes(queriesFilter.search.toLowerCase())) ||
      (q.autoReplyText && q.autoReplyText.toLowerCase().includes(queriesFilter.search.toLowerCase()));

    const matchesStatus = queriesFilter.status === "all" || q.status === queriesFilter.status;

    return matchesSearch && matchesStatus;
  });

  // Dynamic computation of Lead Growth and Query Volume trends over the past 30 days
  const getChartData = () => {
    const data = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      
      const dayLeads = leads.filter(l => {
        const ts = l.createdAt;
        if (!ts) return false;
        let dateOfLead;
        if (ts.seconds) dateOfLead = new Date(ts.seconds * 1000);
        else if (ts.toDate) dateOfLead = ts.toDate();
        else dateOfLead = new Date(ts);
        return dateOfLead.toDateString() === d.toDateString();
      }).length;

      const dayQueries = queries.filter(q => {
        const ts = q.timestamp || q.createdAt;
        if (!ts) return false;
        let dateOfQuery;
        if (ts.seconds) dateOfQuery = new Date(ts.seconds * 1000);
        else if (ts.toDate) dateOfQuery = ts.toDate();
        else dateOfQuery = new Date(ts);
        return dateOfQuery.toDateString() === d.toDateString();
      }).length;

      data.push({
        date: dateStr,
        Leads: dayLeads,
        Queries: dayQueries
      });
    }
    
    const hasActualData = leads.length > 0 || queries.length > 0;
    if (!hasActualData) {
      return Array.from({ length: 30 }).map((_, i) => {
        const d = new Date();
        d.setDate(now.getDate() - (29 - i));
        const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const seedLeads = Math.floor(Math.sin(i * 0.3) * 2 + 4 + (i % 2));
        const seedQueries = Math.floor(Math.cos(i * 0.25) * 3 + 6 + (i % 3));
        return {
          date: dateStr,
          "Lead Growth": seedLeads,
          "Query Volume": seedQueries
        };
      });
    } else {
      let cumulativeLeads = 0;
      return data.map((item) => {
        cumulativeLeads += item.Leads;
        return {
          date: item.date,
          "Lead Growth": cumulativeLeads,
          "Query Volume": item.Queries
        };
      });
    }
  };

  const chartData = getChartData();

  const downloadLeadsCSV = () => {
    if (leads.length === 0) {
      alert("No leads data available to export.");
      return;
    }
    const headers = ["ID", "Name", "Email", "Phone", "Interest", "Message", "Created At"];
    const rows = leads.map(l => {
      const createdAtDate = l.createdAt?.seconds 
        ? new Date(l.createdAt.seconds * 1000).toLocaleString() 
        : l.createdAt?.toDate 
          ? l.createdAt.toDate().toLocaleString() 
          : typeof l.createdAt === 'string' 
            ? new Date(l.createdAt).toLocaleString() 
            : 'Unknown';
      return [
        l.id || "",
        l.name ? `"${l.name.replace(/"/g, '""')}"` : "",
        l.email || "",
        l.phone || "",
        l.interest ? `"${l.interest.replace(/"/g, '""')}"` : "",
        l.message ? `"${l.message.replace(/"/g, '""')}"` : "",
        createdAtDate
      ];
    });

    const csvString = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `admin_leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadQueriesCSV = () => {
    if (queries.length === 0) {
      alert("No inquiries data available to export.");
      return;
    }
    const headers = ["ID", "Name", "Email", "Subject", "Message", "Status", "AI Reply", "Timestamp"];
    const rows = queries.map(q => {
      const ts = q.timestamp || q.createdAt;
      const tsDate = ts?.seconds 
        ? new Date(ts.seconds * 1000).toLocaleString() 
        : ts?.toDate 
          ? ts.toDate().toLocaleString() 
          : typeof ts === 'string' 
            ? new Date(ts).toLocaleString() 
            : 'Unknown';
      return [
        q.id || "",
        q.userName ? `"${q.userName.replace(/"/g, '""')}"` : "",
        q.userEmail || "",
        q.subject ? `"${q.subject.replace(/"/g, '""')}"` : "",
        q.message ? `"${q.message.replace(/"/g, '""')}"` : "",
        q.status || "",
        q.aiReplyText || q.autoReplyText ? `"${(q.aiReplyText || q.autoReplyText).replace(/"/g, '""')}"` : "",
        tsDate
      ];
    });

    const csvString = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `admin_queries_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchData = async () => {
    if (!user) return;
    try {
      const fetchActions = [
        api.get("projects", targetId),
        // If super admin, edit global settings so they reflect on homepage
        api.getSettings(targetId),
        // Super admins see all queries and leads, normal users see only theirs
        api.get("contactMessages", isSuperAdmin ? undefined : targetId),
        api.get("certificates", targetId),
        isSuperAdmin ? api.fetchUsers() : Promise.resolve([]),
        api.get("leads", isSuperAdmin ? undefined : targetId),
        api.fetchChatSessions(isSuperAdmin ? undefined : targetId),
        api.fetchKnowledgeBase(targetId),
        api.get("testimonials", targetId)
      ];
      
      const [p, s, q, c, u, l, cs, kb, t] = await Promise.all(fetchActions);
      
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
      if (Array.isArray(t)) setTestimonials(t.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  useEffect(() => {
    fetchData();

    if (user) {
      // 1. Chat Sessions Listener
      const qChat = isSuperAdmin 
        ? collection(db, "chatSessions") 
        : query(collection(db, "chatSessions"), where("userId", "==", user.uid));
        
      const unsubscribeChat = onSnapshot(qChat, (snapshot: any) => {
        const sessions = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        setChatSessions(sessions.sort((a: any, b: any) => {
          const getT = (ts: any) => {
            const time = ts?.toDate ? ts.toDate().getTime() : (typeof ts === 'string' ? new Date(ts).getTime() : 0);
            return time;
          };
          return getT(b.createdAt || b.lastUpdated || b.lastActivity) - getT(a.createdAt || a.lastUpdated || a.lastActivity);
        }));
      });

      // 2. Real-time Queries Listener
      const qQueries = isSuperAdmin
        ? collection(db, "contactMessages")
        : query(collection(db, "contactMessages"), where("userUid", "==", user.uid));

      let isInitialQueries = true;
      const unsubscribeQueries = onSnapshot(qQueries, (snapshot: any) => {
        const list: any[] = [];
        snapshot.docs.forEach((doc: any) => {
          list.push({ id: doc.id, ...doc.data() });
        });

        const sortedQueries = list.sort((a: any, b: any) => {
          const getTime = (ts: any) => {
            if (ts?.seconds) return ts.seconds * 1000;
            if (ts?.toDate) return ts.toDate().getTime();
            if (typeof ts === 'string') return new Date(ts).getTime();
            return 0;
          };
          return getTime(b.timestamp || b.createdAt) - getTime(a.timestamp || a.createdAt);
        });

        setQueries(sortedQueries);

        if (!isInitialQueries) {
          snapshot.docChanges().forEach((change: any) => {
            if (change.type === "added") {
              const data = change.doc.data();
              addToast(
                `New Inquiry: ${data.subject || "No Subject"}`,
                `From ${data.userName || data.userEmail || "Someone"}`,
                "query"
              );
            }
          });
        }
        isInitialQueries = false;
      });

      // 3. Real-time Leads Listener
      const qLeads = isSuperAdmin
        ? collection(db, "leads")
        : query(collection(db, "leads"), where("userId", "==", user.uid));

      let isInitialLeads = true;
      const unsubscribeLeads = onSnapshot(qLeads, (snapshot: any) => {
        const list: any[] = [];
        snapshot.docs.forEach((doc: any) => {
          list.push({ id: doc.id, ...doc.data() });
        });

        const sortedLeads = list.sort((a: any, b: any) => {
          const getTime = (ts: any) => {
            if (ts?.seconds) return ts.seconds * 1000;
            if (ts?.toDate) return ts.toDate().getTime();
            if (typeof ts === 'string') return new Date(ts).getTime();
            return 0;
          };
          return getTime(b.createdAt) - getTime(a.createdAt);
        });

        setLeads(sortedLeads);

        if (!isInitialLeads) {
          snapshot.docChanges().forEach((change: any) => {
            if (change.type === "added") {
              const data = change.doc.data();
              addToast(
                `New Business Lead!`,
                `${data.name || "Client"} is interested in ${data.interest || "collaboration"}`,
                "lead"
              );
            }
          });
        }
        isInitialLeads = false;
      });

      return () => {
        unsubscribeChat();
        unsubscribeQueries();
        unsubscribeLeads();
      };
    }
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
        await api.post("projects", projectData, targetId);
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
      await api.saveSettings(settings, targetId);
      // Removed redundant double-save since targetId already handles it
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

  const handleDiagnoseSmtp = async () => {
    setSmtpTestLoading(true);
    setSmtpTestError(null);
    setSmtpTestSuccess(false);
    setSmtpTestSteps(["Initiating live SMTP connection and handshake validation via server-side diagnostic route..."]);
    
    try {
      const resp = await fetch("/api/admin/diagnose-smtp");
      const data = await resp.json();
      
      if (data.steps && Array.isArray(data.steps)) {
        setSmtpTestSteps(data.steps);
      }
      
      if (resp.ok && data.success) {
        setSmtpTestSuccess(true);
      } else {
        setSmtpTestError(data.error || "SMTP check failed.");
      }
    } catch (err: any) {
      setSmtpTestError(err?.message || "Internal diagnostic dispatch failure");
      setSmtpTestSteps(prev => [...prev, `[FAIL] Transport layer connection exception: ${err?.message || err}`]);
    } finally {
      setSmtpTestLoading(false);
    }
  };

  const handleTestAiReply = async () => {
    setAiTestLoading(true);
    setAiTestError(null);
    setAiTestSuccess(false);
    setAiTestResultText("");
    setAiTestSteps(["Requesting automated draft test via server-side gemini integration check..."]);
    
    try {
      const resp = await fetch("/api/admin/test-auto-reply");
      const data = await resp.json();
      
      if (data.steps && Array.isArray(data.steps)) {
        setAiTestSteps(data.steps);
      }
      
      if (resp.ok && data.success) {
        setAiTestSuccess(true);
        setAiTestResultText(data.text || "");
      } else {
        setAiTestError(data.error || "AI Auto-reply generation test failed.");
      }
    } catch (err: any) {
      setAiTestError(err?.message || "Internal AI execution test failure");
      setAiTestSteps(prev => [...prev, `[FAIL] Connection layer error: ${err?.message || err}`]);
    } finally {
      setAiTestLoading(false);
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
        await api.post("certificates", certData, targetId);
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

  const handleSaveTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const testimonialData = {
        ...formData,
        text: formData.text || formData.message || "",
        message: formData.text || formData.message || "",
        company: formData.company || formData.role || "",
        role: formData.role || "",
        avatar: formData.avatar || "",
        rating: Number(formData.rating) || 5,
        order: Number(formData.order) || 0,
        approved: true,
        status: "approved",
        isApproved: true,
        visible: true,
        userId: targetId || "global"
      };

      if (isEditing === "new_testimonial") {
        await api.post("testimonials", testimonialData, targetId);
      } else if (isEditing) {
        await api.put("testimonials", isEditing, testimonialData);
      }

      setIsEditing(null);
      setFormData({});
      fetchData();
    } catch (error) {
      console.error("Failed to save testimonial:", error);
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (window.confirm("Delete this testimonial?")) {
      try {
        await api.delete("testimonials", id);
        fetchData();
      } catch (error) {
        console.error("Failed to delete testimonial:", error);
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

  const handleDraftWithAi = async (queryId: string, subject: string, message: string, userName: string, userEmail: string) => {
    setDraftingIds(prev => ({ ...prev, [queryId]: true }));
    try {
      const resp = await fetch("/api/queries/draft-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, userName, userEmail })
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.draft) {
        setReplyText(prev => ({ ...prev, [queryId]: data.draft }));
      } else {
        alert(data.error || "Failed to generate AI draft reply.");
      }
    } catch (err: any) {
      console.error("Failed to generate draft with AI:", err);
      alert(err?.message || "Failed to generate AI draft reply.");
    } finally {
      setDraftingIds(prev => ({ ...prev, [queryId]: false }));
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

      await api.saveKnowledgeEntry(data, targetId);
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
      <div className="flex flex-col items-center justify-center py-12 px-6">
        <Auth loginOnly={false} onSuccess={(u) => setUser(u)} />
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
    <div className={`admin-theme-wrapper ${theme === "light" ? "theme-light" : "theme-dark"} container mx-auto px-4 lg:px-6 pb-12`}>
      <style>{`
        /* Complete Light Mode Integration & Optimization */
        .theme-light {
          --bg-main: #f8fafc;
          --bg-sidebar: #ffffff;
          --bg-card: #ffffff;
          --border-color: rgba(148, 163, 184, 0.18);
          --text-primary: #0f172a;
          --text-muted: #475569;
          --glow-color: rgba(37, 99, 235, 0.05);
        }

        /* Root-level viewport style overrides when active */
        html:has(.theme-light) .min-h-screen,
        html:has(.theme-light) body {
          background-color: #f8fafc !important;
          color: #0f172a !important;
        }

        html:has(.theme-light) nav,
        html:has(.theme-light) header {
          background-color: rgba(255, 255, 255, 0.9) !important;
          border-color: rgba(148, 163, 184, 0.18) !important;
          backdrop-filter: blur(16px) !important;
        }

        html:has(.theme-light) nav *,
        html:has(.theme-light) header * {
          color: #0f172a !important;
        }

        /* Container wrappers */
        .admin-theme-wrapper.theme-light {
          background-color: #f8fafc !important;
          color: #0f172a !important;
        }

        /* Headings & general labels */
        .admin-theme-wrapper.theme-light h1,
        .admin-theme-wrapper.theme-light h2,
        .admin-theme-wrapper.theme-light h3,
        .admin-theme-wrapper.theme-light h4,
        .admin-theme-wrapper.theme-light h5,
        .admin-theme-wrapper.theme-light h6,
        .admin-theme-wrapper.theme-light label {
          color: #0f172a !important;
        }

        /* General paragraph and description text */
        .admin-theme-wrapper.theme-light p {
          color: #475569 !important;
        }

        /* Deep overrides for ALL cards/sections */
        .admin-theme-wrapper.theme-light .glass,
        .admin-theme-wrapper.theme-light [class*="bg-[#0a0b0d]"],
        .admin-theme-wrapper.theme-light [class*="bg-[#0c0d12]"],
        .admin-theme-wrapper.theme-light [class*="bg-[#0e0f12]"],
        .admin-theme-wrapper.theme-light [class*="bg-[#0e1014]"]:not(aside),
        .admin-theme-wrapper.theme-light [class*="bg-[#08090c]"],
        .admin-theme-wrapper.theme-light [class*="bg-black"]:not(.bg-accent):not(.bg-[#2563eb]):not(button):not(aside),
        .admin-theme-wrapper.theme-light [class*="bg-slate-900"],
        .admin-theme-wrapper.theme-light [class*="bg-slate-950"]:not(aside),
        .admin-theme-wrapper.theme-light [class*="bg-zinc-950"],
        .admin-theme-wrapper.theme-light [class*="bg-[#111]"]:not(button),
        .admin-theme-wrapper.theme-light [class*="bg-[#181a20]"]:not(button):not(aside),
        .admin-theme-wrapper.theme-light [class*="bg-neutral-900"] {
          background-color: #ffffff !important;
          border-color: rgba(148, 163, 184, 0.18) !important;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.02), 0 1px 3px rgba(15, 23, 42, 0.01) !important;
          color: #0f172a !important;
        }

        /* High-contrast Text styling: Convert white text tags into dark slate */
        .admin-theme-wrapper.theme-light .text-white:not(button):not(.bg-accent):not([class*="bg-accent"]):not([class*="bg-[#"]):not([class*="bg-blue"]):not([class*="bg-purple"]):not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-emerald"]) {
          color: #0f172a !important;
        }

        .admin-theme-wrapper.theme-light .text-secondary:not(button):not(.bg-slate-950):not([class*="bg-accent"]) {
          color: #475569 !important;
        }

        .admin-theme-wrapper.theme-light .text-[#94a3b8] {
          color: #475569 !important;
        }

        .admin-theme-wrapper.theme-light .text-white\/40,
        .admin-theme-wrapper.theme-light .text-white\/60,
        .admin-theme-wrapper.theme-light .text-secondary\/60 {
          color: #64748b !important;
          opacity: 1 !important;
        }

        /* SVG Lucide Icon visibility */
        .admin-theme-wrapper.theme-light svg:not(.text-green-500):not(.text-amber-400):not(.text-amber-500):not(.text-red-500):not(.text-[#2563eb]):not(.text-blue-500):not(.fill-amber-400):not(.text-purple-500) {
          color: #475569 !important;
        }

        /* Table & Lists Row Backgrounds */
        .admin-theme-wrapper.theme-light .bg-white\/\[0\.01\],
        .admin-theme-wrapper.theme-light .bg-white\/\[0\.02\],
        .admin-theme-wrapper.theme-light .bg-white\/5 {
          background-color: rgba(148, 163, 184, 0.05) !important;
        }

        .admin-theme-wrapper.theme-light .border-line,
        .admin-theme-wrapper.theme-light .border-white\/10,
        .admin-theme-wrapper.theme-light .border-white\/\[0\.04\],
        .admin-theme-wrapper.theme-light .border-white\/\[0\.08\] {
          border-color: rgba(148, 163, 184, 0.18) !important;
        }

        /* Inputs & textareas formatting */
        .admin-theme-wrapper.theme-light input,
        .admin-theme-wrapper.theme-light textarea,
        .admin-theme-wrapper.theme-light select {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid rgba(148, 163, 184, 0.3) !important;
        }

        .admin-theme-wrapper.theme-light input::placeholder,
        .admin-theme-wrapper.theme-light textarea::placeholder {
          color: #94a3b8 !important;
        }

        .admin-theme-wrapper.theme-light input:focus,
        .admin-theme-wrapper.theme-light textarea:focus,
        .admin-theme-wrapper.theme-light select:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1) !important;
        }

        /* Sidebar Theme styling overrides */
        .admin-theme-wrapper.theme-light aside {
          background-color: #ffffff !important;
          border-color: rgba(148, 163, 184, 0.18) !important;
          box-shadow: 0 15px 45px rgba(15, 23, 42, 0.04) !important;
        }

        .admin-theme-wrapper.theme-light aside button:not(.bg-white):not(.bg-[#2563eb]):not(.bg-accent) {
          color: #334155 !important;
        }

        .admin-theme-wrapper.theme-light aside button:not(.bg-white):not(.bg-[#2563eb]):not(.bg-accent):hover {
          background-color: rgba(37, 99, 235, 0.05) !important;
          color: #2563eb !important;
        }

        .admin-theme-wrapper.theme-light aside button.bg-[#2563eb] {
          background-color: #2563eb !important;
          color: #ffffff !important;
        }

        .admin-theme-wrapper.theme-light aside input {
          background-color: #f1f5f9 !important;
          border-color: rgba(148, 163, 184, 0.15) !important;
        }

        /* Buttons & Badges and Icons */
        .admin-theme-wrapper.theme-light button:not(.bg-accent):not(.bg-[#2563eb]):not(.bg-blue-600):not(.bg-purple-600):not(.bg-red-600):not(.bg-green-600):not(.bg-[#10b981]):not(.bg-white) {
          border-color: rgba(148, 163, 184, 0.25) !important;
          color: #0f172a !important;
          background-color: #ffffff !important;
        }

        .admin-theme-wrapper.theme-light .bg-accent\/10 {
          background-color: rgba(37, 99, 235, 0.08) !important;
        }

        .admin-theme-wrapper.theme-light .border-accent\/30 {
          border-color: rgba(37, 99, 235, 0.3) !important;
        }

        .admin-theme-wrapper.theme-light span:not(.font-mono):not(.text-green-500):not(.text-amber-500):not(.text-red-500):not(.text-[#2563eb]):not(.bg-accent):not([class*="bg-accent"]):not([class*="bg-[#2563eb]"]):not([class*="bg-blue"]):not([class*="bg-purple"]):not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-emerald"]) {
          color: #0f172a !important;
        }

        /* Recharts customize/Tooltip */
        .admin-theme-wrapper.theme-light .recharts-default-tooltip {
          background-color: #ffffff !important;
          border: 1px solid rgba(148, 163, 184, 0.3) !important;
          color: #0f172a !important;
        }

        /* Active Navigation pill */
        .admin-theme-wrapper.theme-light .bg-white\/\[0\.04\] {
          background-color: rgba(148, 163, 184, 0.08) !important;
        }
      `}</style>
      {/* MOBILE BAR */}
      <div className="lg:hidden flex items-center justify-between py-4 border-b border-[#111] bg-black sticky top-0 z-50 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[#222] bg-white/5 flex items-center justify-center">
            {user.photoURL ? <img src={user.photoURL} alt="Admin" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <LogIn size={14} />}
          </div>
          <div>
            <span className="text-xs font-display font-bold uppercase tracking-wider text-white">Console</span>
            <p className="text-[8px] font-mono text-secondary tracking-tight">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-2 border border-[#222] hover:border-accent text-secondary hover:text-white rounded-lg transition-all"
        >
          {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[85vh] gap-8">
        {/* SLEEK, VERTICAL LEFT SIDEBAR */}
        <aside
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          className={`
            fixed lg:sticky z-40 transition-all duration-300 ease-in-out flex flex-col justify-between shrink-0
            ${sidebarStyle === "floating-dock" 
              ? "top-0 lg:top-16 h-[100vh] lg:h-[calc(100vh-8rem)] bg-slate-950/40 backdrop-blur-xl border border-white/15 lg:rounded-[32px] lg:my-6 lg:ml-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)]" 
              : "top-0 lg:top-12 h-[100vh] lg:h-[calc(100vh-6rem)] bg-[#0e1014] border border-[#1b1e24] lg:rounded-[24px] shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
            }
            ${isSidebarCollapsed ? "lg:w-20 lg:p-3 p-5" : "w-64 lg:w-64 p-5"}
            ${mobileSidebarOpen ? "translate-x-0 left-0" : "-translate-x-full lg:translate-x-0 left-0 lg:left-auto"}
          `}
        >
          {/* SIDEBAR MAIN MENU */}
          <div className="space-y-5 flex-1 flex flex-col min-h-0">
            {/* macOS WINDOW CHROME DOTS & BRANDING LOGO */}
            <div className={`flex flex-col gap-4 border-b border-white/[0.04] pb-4 ${isSidebarCollapsed ? "items-center" : ""}`}>
              {/* macOS Window dots */}
              <div className="flex items-center gap-1.5 px-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e] block" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123] block" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-[#1aab29] block" />
              </div>

              {/* BRAND LOGO DESIGN */}
              <div className={`flex items-center gap-2 px-1 mt-2 ${isSidebarCollapsed ? "justify-center" : ""}`}>
                <div className="flex gap-0.5 items-end h-5 shrink-0">
                  <span className="w-1.5 h-3 rounded-full bg-accent animate-pulse" />
                  <span className="w-1.5 h-5 rounded-full bg-[#2563eb]" />
                  <span className="w-1.5 h-4 rounded-full bg-purple-500" />
                </div>
                {!isSidebarCollapsed && (
                  <span className="text-sm font-display font-black tracking-wider text-white uppercase bg-clip-text">
                    MingCute
                  </span>
                )}
              </div>
            </div>

            {/* MOCK SEARCH INPUT */}
            {!isSidebarCollapsed && (
              <div className="relative px-1">
                <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                  <Search size={13} className="text-[#475569]" />
                </span>
                <input
                  type="text"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full pl-8 pr-3 py-1.5 bg-[#181a20] hover:bg-[#1f2229] focus:bg-[#1f2229] border border-white/[0.04] focus:border-white/[0.12] rounded-xl font-mono text-[11px] text-white placeholder-[#475569] focus:outline-none transition-all"
                />
              </div>
            )}

            {/* NAV LINKS */}
            <nav className="space-y-1 overflow-y-auto scrollbar-none flex-1 pr-1">
              {[
                { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                { id: "projects", label: "Projects", icon: FolderKanban },
                { id: "about", label: "About Me", icon: Users },
                { id: "certificates", label: "Certificates", icon: Award },
                { id: "queries", label: (isSuperAdmin ? "Queries" : "My Queries"), icon: MessageSquare, badge: queries.filter(q => q.status === 'pending').length },
                ...(isSuperAdmin ? [{ id: "users", label: "Users", icon: Users }] : []),
                { id: "leads", label: (isSuperAdmin ? "Leads" : "My Leads"), icon: CheckCircle, badge: leads.length },
                { id: "chatHistory", label: "Chat History", icon: Bot },
                { id: "knowledgeBase", label: "Knowledge Base", icon: BookOpen },
                { id: "testimonials", label: "Testimonials", icon: Star },
                { id: "settings", label: "Settings", icon: SettingsIcon },
                ...(isSuperAdmin ? [{ id: "apiKeys", label: "Rotation", icon: RotateCcw }] : [])
              ]
              .filter(item => item.label.toLowerCase().includes(sidebarSearch.toLowerCase()))
              .map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setMobileSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-mono text-[10px] uppercase tracking-wider transition-all relative group
                      ${isActive 
                        ? 'bg-[#2563eb] text-white font-bold shadow-[0_4px_12px_rgba(37,99,235,0.25)]' 
                        : 'text-[#94a3b8] hover:text-white hover:bg-white/[0.04]'
                      }
                      ${isSidebarCollapsed ? "justify-center lg:px-2" : ""}
                    `}
                    title={item.label}
                  >
                    <IconComponent size={14} className={`${isActive ? "text-white" : "text-[#7f8ea3] group-hover:text-white"} shrink-0`} />
                    
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                    
                    {item.badge !== undefined && item.badge > 0 && !isSidebarCollapsed ? (
                      <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[8px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-white/[0.07] text-[#94a3b8]'}`}>
                        {item.badge}
                      </span>
                    ) : item.badge !== undefined && item.badge > 0 && isSidebarCollapsed ? (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* SIDEBAR FOOTER ACTION REQUISITES */}
          <div className="space-y-4 pt-4 border-t border-white/[0.04] mt-auto shrink-0">
            {/* PORTFOLIO USER PROFILE CARD FOOTER */}
            <div className={`flex items-center gap-3 ${isSidebarCollapsed ? "justify-center" : "justify-between"}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-[#27c93f]/20 bg-white/5 flex items-center justify-center shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Admin" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-[#2563eb] text-white flex items-center justify-center font-bold text-xs uppercase">
                      {user.email?.slice(0, 2)}
                    </div>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <div className="min-w-0 leading-tight">
                    <h4 className="text-[11px] font-sans font-bold text-white truncate">{user.displayName || "Admin"}</h4>
                    <p className="text-[9px] font-mono text-[#64748b] truncate">{user.email}</p>
                  </div>
                )}
              </div>

              {!isSidebarCollapsed && (
                <div className="flex items-center gap-1.5 ml-2">
                  {/* VIEW PUBLIC PORTFOLIO ICON */}
                  <a 
                    href={`/u/${user.uid}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1 px-1.5 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] text-accent rounded-lg transition-all"
                    title="Live Site"
                  >
                    <ExternalLink size={11} />
                  </a>

                  {/* LOGOUT EXIT ICON CHEVRON */}
                  <button
                    onClick={handleLogout}
                    className="p-1 px-1.5 bg-white/[0.03] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 text-[#94a3b8] hover:text-red-400 rounded-lg transition-all"
                    title="Logout"
                  >
                    <LogOut size={11} />
                  </button>
                </div>
              )}
            </div>

            {/* SIDEBAR LOCKER / COLLAPSER (DESKTOP ONLY) */}
            <button
              onClick={() => setIsPinned(!isPinned)}
              className="hidden lg:flex w-full items-center justify-center py-1.5 bg-[#181a20] border border-white/[0.04] hover:border-white/[0.12] text-[#94a3b8] hover:text-white rounded-xl transition-all"
              title={isPinned ? "Unlock & Auto-Collapse Sidebar" : "Pin & Keep Expanded"}
            >
              {isPinned ? <ChevronLeft size={13} className="text-[#2563eb]" /> : <ChevronRight size={13} />}
            </button>
          </div>
        </aside>

        {/* MOBILE OVERLAY */}
        {mobileSidebarOpen && (
          <div 
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
          />
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <div className="flex-1 space-y-8 min-w-0">
          
          {/* DASHBOARD TAB ACTIVE VIEW */}
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              {/* DASHBOARD TOP HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono text-accent uppercase tracking-widest font-semibold pb-1 block">SYSTEM STATUS</span>
                  <h1 className="text-3xl font-display font-medium uppercase tracking-tight text-white">
                    Dashboard Overview
                  </h1>
                  <p className="text-[10px] font-mono text-secondary uppercase tracking-widest mt-1">
                    System Node active &bull; Authenticated administrator
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={downloadLeadsCSV}
                    className="px-4 py-2 bg-[#181a20]/80 h-10 hover:bg-[#1f2229] active:scale-95 text-white border border-white/[0.04] focus:border-[#2563eb]/20 rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                    title="Export business leads data as CSV file"
                  >
                    Download Leads CSV
                  </button>
                  <button
                    onClick={downloadQueriesCSV}
                    className="px-4 py-2 bg-[#181a20]/80 h-10 hover:bg-[#1f2229] active:scale-95 text-white border border-white/[0.04] focus:border-[#2563eb]/20 rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                    title="Export inbox user inquiries as CSV file"
                  >
                    Download Queries CSV
                  </button>
                </div>
              </div>

              {/* STATS ANALYTICS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {/* 1. ACTIVE PROJECTS */}
                <div className="glass p-6 rounded-2xl border border-line flex flex-col justify-between relative overflow-hidden group hover:border-[#ffffff1c] transition-all duration-300">
                  <div className="absolute top-0 right-0 p-3 bg-white/[0.02] rounded-bl-xl">
                    <FolderKanban size={18} className="text-accent" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8] block">Projects</span>
                    <span className="text-4xl font-display font-bold text-white mt-1 block tracking-tight">
                      {projects.length.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between">
                    <span className="text-[8px] font-mono text-secondary uppercase tracking-tighter">Total items</span>
                    <button 
                      onClick={() => setActiveTab("projects")}
                      className="text-[9px] font-mono text-accent uppercase tracking-widest flex items-center gap-1 hover:underline"
                    >
                      Manage <ArrowUpRight size={10} />
                    </button>
                  </div>
                </div>

                {/* 2. LEADS CARD */}
                <div className="glass p-6 rounded-2xl border border-line flex flex-col justify-between relative overflow-hidden group hover:border-[#ffffff1c] transition-all duration-300">
                  <div className="absolute top-0 right-0 p-3 bg-white/[0.02] rounded-bl-xl">
                    <CheckCircle size={18} className="text-[#a581ff]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8] block">Leads</span>
                    <span className="text-4xl font-display font-bold text-white mt-1 block tracking-tight">
                      {leads.length.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between">
                    <span className="text-[8px] font-mono text-secondary uppercase tracking-tighter">Interest list</span>
                    <button 
                      onClick={() => setActiveTab("leads")}
                      className="text-[9px] font-mono text-[#a581ff] uppercase tracking-widest flex items-center gap-1 hover:underline"
                    >
                      View <ArrowUpRight size={10} />
                    </button>
                  </div>
                </div>

                {/* 3. TOTAL REGISTERED USERS CARD */}
                <div className="glass p-6 rounded-2xl border border-line flex flex-col justify-between relative overflow-hidden group hover:border-[#ffffff1c] transition-all duration-300">
                  <div className="absolute top-0 right-0 p-3 bg-white/[0.02] rounded-bl-xl">
                    <Users size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8] block">Total Users</span>
                    <span className="text-4xl font-display font-bold text-white mt-1 block tracking-tight">
                      {isSuperAdmin ? users.length.toString().padStart(2, '0') : "01"}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between">
                    <span className="text-[8px] font-mono text-secondary uppercase tracking-tighter">
                      {isSuperAdmin ? "User list" : "Staff level"}
                    </span>
                    {isSuperAdmin && (
                      <button 
                        onClick={() => setActiveTab("users")}
                        className="text-[9px] font-mono text-blue-400 uppercase tracking-widest flex items-center gap-1 hover:underline"
                      >
                        Manage <ArrowUpRight size={10} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. ALL QUERIES CARD */}
                <div className="glass p-6 rounded-2xl border border-line flex flex-col justify-between relative overflow-hidden group hover:border-[#ffffff1c] transition-all duration-300">
                  <div className="absolute top-0 right-0 p-3 bg-white/[0.02] rounded-bl-xl">
                    <MessageSquare size={18} className="text-[#38bdf8]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8] block">All Queries</span>
                    <span className="text-4xl font-display font-bold text-white mt-1 block tracking-tight">
                      {queries.length.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between">
                    <span className="text-[8px] font-mono text-secondary uppercase tracking-tighter">Total inbounds</span>
                    <button 
                      onClick={() => setActiveTab("queries")}
                      className="text-[9px] font-mono text-[#38bdf8] uppercase tracking-widest flex items-center gap-1 hover:underline"
                    >
                      History <ArrowUpRight size={10} />
                    </button>
                  </div>
                </div>

                {/* 5. PENDING QUERIES CARD */}
                <div className="glass p-6 rounded-2xl border border-line flex flex-col justify-between relative overflow-hidden group hover:border-[#ffffff1c] transition-all duration-300">
                  <div className={`absolute top-0 right-0 p-3 bg-white/[0.02] rounded-bl-xl ${queries.filter(q => q.status === 'pending').length > 0 ? 'animate-pulse' : ''}`}>
                    <Activity size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8] block">Pending Queries</span>
                    <span className={`text-4xl font-display font-bold mt-1 block tracking-tight ${queries.filter(q => q.status === 'pending').length > 0 ? 'text-amber-400 animate-pulse' : 'text-white'}`}>
                      {queries.filter(q => q.status === 'pending').length.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between">
                    <span className="text-[8px] font-mono text-secondary uppercase tracking-tighter">Needs response</span>
                    <button 
                      onClick={() => setActiveTab("queries")}
                      className="text-[9px] font-mono text-amber-300 uppercase tracking-widest flex items-center gap-1 hover:underline"
                    >
                      Resolve <ArrowUpRight size={10} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ANALYTICS VISUALIZATION & QUICK ACTIONS SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* AREA CHART DIVISION */}
                <div className="lg:col-span-2 glass p-6 rounded-3xl border border-line flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-sans font-medium text-white flex items-center gap-2">
                        <Activity size={16} className="text-[#2563eb]" /> System Activity Trends
                      </h3>
                      <p className="text-[9px] font-mono text-secondary uppercase tracking-wider mt-0.5">Lead Growth and Query volume over past 30 days</p>
                    </div>
                    <div className="flex items-center gap-4 text-[9px] font-mono uppercase tracking-wider text-secondary">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span>Lead Growth</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
                        <span>Query Volume</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="h-[250px] w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="date" 
                          stroke="#475569" 
                          fontSize={9} 
                          fontFamily="JetBrains Mono, monospace"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#475569" 
                          fontSize={9} 
                          fontFamily="JetBrains Mono, monospace"
                          tickLine={false}
                          axisLine={false}
                        />
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#0f172a', 
                            borderColor: 'rgba(255,255,255,0.08)', 
                            borderRadius: '12px',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '10px'
                          }} 
                          itemStyle={{ color: '#fff' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="Lead Growth" 
                          stroke="#a855f7" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorLeads)" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="Query Volume" 
                          stroke="#2563eb" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorQueries)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* QUICK ACTIONS CARD */}
                <div className="glass p-6 rounded-3xl border border-line flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-base font-sans font-medium text-white flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-400" /> Admin Quick Actions
                    </h3>
                    <p className="text-[9px] font-mono text-secondary uppercase tracking-wider mt-0.5">Speed up administrator execution</p>
                  </div>

                  <div className="space-y-3 flex-1 pt-2">
                    {/* Action 1: Create New Project */}
                    <button
                      onClick={() => {
                        setActiveTab("projects");
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.1] active:scale-98 transition-all group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl group-hover:scale-105 transition-transform">
                          <Plus size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-sans font-semibold text-white">Create New Project</h4>
                          <p className="text-[9px] font-mono text-secondary uppercase">Publish code repositories</p>
                        </div>
                      </div>
                      <ArrowUpRight size={12} className="text-secondary group-hover:text-white transition-colors" />
                    </button>

                    {/* Action 2: View All Leads */}
                    <button
                      onClick={() => setActiveTab("leads")}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.1] active:scale-98 transition-all group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl group-hover:scale-105 transition-transform">
                          <CheckCircle size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-sans font-semibold text-white">View All Leads</h4>
                          <p className="text-[9px] font-mono text-secondary uppercase">Browse business inquiries</p>
                        </div>
                      </div>
                      <ArrowUpRight size={12} className="text-secondary group-hover:text-white transition-colors" />
                    </button>

                    {/* Action 3: Site Settings */}
                    <button
                      onClick={() => setActiveTab("settings")}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.1] active:scale-98 transition-all group text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#2563eb]/10 border border-[#2563eb]/20 text-[#2563eb] rounded-xl group-hover:scale-105 transition-transform">
                          <SettingsIcon size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-sans font-semibold text-white">Site Settings</h4>
                          <p className="text-[9px] font-mono text-secondary uppercase">Configure automation & details</p>
                        </div>
                      </div>
                      <ArrowUpRight size={12} className="text-secondary group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>
              </div>

              {/* FEED AND QUICK CONTROL SPLIT LAYOUT */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* RECENT ACTIVITY FEED */}
                <div className="lg:col-span-2 glass p-8 rounded-3xl border border-line space-y-6">
                  <div className="flex items-center justify-between border-b border-[#111] pb-4">
                    <h3 className="text-base font-sans font-medium text-white flex items-center gap-2">
                      <Activity size={16} className="text-accent" /> Recent Activity Feed
                    </h3>
                    <span className="text-[9px] font-mono uppercase tracking-widest px-2.5 py-1 rounded bg-white/5 text-secondary">
                      Chronological Events
                    </span>
                  </div>

                  <div className="space-y-4">
                    {(() => {
                      const feedItems = [
                        ...queries.slice(0, 4).map(q => ({
                          id: `q-${q.id || q.timestamp}`,
                          type: "query",
                          icon: MessageSquare,
                          colorClass: "text-[#38bdf8] bg-[#38bdf8]/10 border-[#38bdf8]/20",
                          title: `New query: "${q.subject || "No Subject"}"`,
                          subtitle: `By ${q.userName || "Guest"} (${q.userEmail})`,
                          time: q.timestamp || q.createdAt,
                          badge: q.status === "pending" ? "Pending" : "Resolved",
                          badgeColor: q.status === "pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                          clickableTab: "queries"
                        })),
                        ...leads.slice(0, 4).map(l => ({
                          id: `l-${l.id || l.createdAt}`,
                          type: "lead",
                          icon: CheckCircle,
                          colorClass: "text-[#a581ff] bg-[#a581ff]/10 border-[#a581ff]/20",
                          title: `Lead from "${l.name || "Business Lead"}"`,
                          subtitle: `Interest: ${l.interest || "Collaboration"}`,
                          time: l.createdAt,
                          badge: "Active Lead",
                          badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                          clickableTab: "leads"
                        }))
                      ].sort((a, b) => {
                        const getT = (ts: any) => {
                          if (!ts) return 0;
                          if (typeof ts === 'string') return new Date(ts).getTime();
                          if (ts.seconds) return ts.seconds * 1000;
                          if (ts.toDate) return ts.toDate().getTime();
                          return 0;
                        };
                        return getT(b.time) - getT(a.time);
                      }).slice(0, 5);

                      if (feedItems.length === 0) {
                        return (
                          <div className="text-center py-12 text-secondary font-mono text-[10px] uppercase">
                            No recent activity found
                          </div>
                        );
                      }

                      return feedItems.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <div key={item.id} className="flex items-start gap-4 p-4 rounded-2xl border border-[#111] hover:border-line hover:bg-white/[0.01] transition-all group">
                            <div className={`p-2 rounded-xl border ${item.colorClass} shrink-0`}>
                              <ItemIcon size={12} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                <h4 className="text-xs font-sans text-white font-semibold truncate group-hover:text-accent transition-colors">{item.title}</h4>
                                <span className="text-[8px] font-mono text-secondary uppercase tracking-tighter">
                                  {(() => {
                                    const ts = item.time;
                                    if (!ts) return "Recently";
                                    if (typeof ts === 'string') return new Date(ts).toLocaleDateString();
                                    return ts?.toDate?.()?.toLocaleDateString() || "Recently";
                                  })()}
                                </span>
                              </div>
                              <p className="text-[9px] font-mono text-secondary truncate uppercase">{item.subtitle}</p>
                              
                              <div className="flex items-center gap-3 mt-3">
                                <span className={`text-[8px] font-mono uppercase tracking-wider px-2 py-0.5 border rounded-full ${item.badgeColor}`}>
                                  {item.badge}
                                </span>
                                <button
                                  onClick={() => setActiveTab(item.clickableTab as any)}
                                  className="text-[8px] font-mono uppercase tracking-widest text-white/50 hover:text-accent flex items-center gap-0.5 ml-auto font-bold"
                                >
                                  Go to view <ArrowUpRight size={8} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* AUTOMATION STATUS COLUMN */}
                <div className="space-y-6">
                  <div className="glass p-6 rounded-3xl border border-line space-y-4">
                    <h3 className="text-xs font-mono uppercase text-secondary tracking-widest font-bold">Automation Node</h3>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-sans font-medium text-white">AI Email Auto-Reply</h4>
                        <p className="text-[9px] font-[#94a3b8] text-secondary uppercase mt-0.5 leading-tight">
                          {settings.enableAutoReply ? "Responding live via Gemini AI" : "System currently offline"}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest border ${settings.enableAutoReply ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-[#e11d48]/10 text-rose-400 border-[#e11d48]/20'}`}>
                        {settings.enableAutoReply ? 'ACTIVE' : 'OFFLINE'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#111]">
                      <button 
                        onClick={() => setActiveTab("settings")}
                        className="w-full py-2 bg-white/5 border border-line hover:border-accent text-white font-mono text-[9px] uppercase tracking-widest rounded-xl transition-all"
                      >
                        Automation Settings
                      </button>
                    </div>
                  </div>

                  <div className="glass p-6 rounded-3xl border border-line space-y-4">
                    <h3 className="text-xs font-mono uppercase text-secondary tracking-widest font-bold">Access Controls</h3>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-[#111] leading-relaxed">
                      <span className="text-[9px] font-mono text-secondary uppercase block">Logged in as</span>
                      <span className="text-xs font-sans text-white font-bold mt-1 block truncate">
                        {isSuperAdmin ? "Administrator" : "Representative User"}
                      </span>
                    </div>

                    <a
                      href={`/u/${user.uid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-accent text-black hover:scale-[1.01] transition-all font-mono text-[9px] uppercase tracking-widest font-bold rounded-xl flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={11} /> View Public Landing page
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

        {activeTab === "projects" && (
          <AdminProjectManager userId={targetId} />
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

                <div className="space-y-4 md:col-span-2">
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-4">
                      <label className="font-mono text-[10px] uppercase text-secondary">Design Loop Control</label>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, heroDesignLoop: !settings.heroDesignLoop })}
                        className={`w-full py-3 rounded-xl border font-mono text-[10px] uppercase tracking-widest transition-all ${settings.heroDesignLoop ? 'border-accent bg-accent/10 text-accent font-bold' : 'border-line text-secondary hover:text-white'}`}
                      >
                        {settings.heroDesignLoop ? 'Design Loop: ON' : 'Design Loop: OFF'}
                      </button>
                      <p className="text-[8px] font-mono text-secondary/60 uppercase">Switch design version upon every page refresh</p>
                    </div>

                    <div className="flex-1 space-y-4">
                      <label className="font-mono text-[10px] uppercase text-secondary">Mobile-Specific Allocation</label>
                      <select
                        className="w-full bg-white/5 border border-line rounded-lg px-4 py-3 outline-none focus:border-accent text-[10px] uppercase font-mono tracking-widest text-white appearance-none cursor-pointer"
                        value={settings.mobileHeroStyle || "sameAsDesktop"}
                        onChange={e => setSettings({ ...settings, mobileHeroStyle: e.target.value })}
                      >
                        <option value="sameAsDesktop">Same as Desktop</option>
                        <option value="default">Default (Stars)</option>
                        <option value="particles">Particles (Interactive)</option>
                        <option value="aether">Aether (Flow)</option>
                        <option value="spline">Spline (3D Robot)</option>
                      </select>
                      <p className="text-[8px] font-mono text-secondary/60 uppercase">Lock hero design for mobile users</p>
                    </div>
                  </div>

                  {settings.heroDesignLoop && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-line/50">
                      <label className="font-mono text-[10px] uppercase text-secondary">Loop Sequence Priority</label>
                      <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-white/5 border border-line rounded-xl">
                        {(settings.heroLoopOrder || []).map((style: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 border border-accent/30 rounded-lg text-[8px] font-mono text-accent uppercase">
                            <span>{idx + 1}. {style}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                const newOrder = [...(settings.heroLoopOrder || [])];
                                newOrder.splice(idx, 1);
                                setSettings({...settings, heroLoopOrder: newOrder});
                              }}
                              className="text-secondary/60 hover:text-red-500"
                            >✕</button>
                          </div>
                        ))}
                        {(!settings.heroLoopOrder || settings.heroLoopOrder.length === 0) && (
                          <span className="text-[8px] font-mono text-secondary/40 uppercase self-center ml-2 italic">No sequence set (will be random)</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['default', 'particles', 'aether', 'spline'].map(style => (
                          <button
                            key={style}
                            type="button"
                            disabled={(settings.heroLoopOrder || []).includes(style)}
                            onClick={() => setSettings({...settings, heroLoopOrder: [...(settings.heroLoopOrder || []), style]})}
                            className={`px-3 py-1.5 rounded-lg border font-mono text-[8px] uppercase transition-all ${
                              (settings.heroLoopOrder || []).includes(style) 
                              ? 'opacity-20 cursor-not-allowed border-line' 
                              : 'border-line text-secondary hover:border-accent hover:text-white hover:bg-accent/5'
                            }`}
                          >
                            + {style}
                          </button>
                        ))}
                        {(settings.heroLoopOrder || []).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSettings({...settings, heroLoopOrder: []})}
                            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500/60 font-mono text-[8px] uppercase hover:bg-red-500/10 hover:text-red-500 transition-all ml-auto"
                          >
                            Reset Order
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Desktop / Manual Hero Style</label>
                  <div className="flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, heroStyle: 'default' })}
                      className={`flex-1 min-w-[120px] py-3 rounded-xl border font-mono text-[10px] uppercase tracking-widest transition-all ${(!settings.heroStyle || settings.heroStyle === 'default') ? 'border-accent bg-accent/10 text-accent' : 'border-line text-secondary hover:text-white'}`}
                    >
                      Default Design
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, heroStyle: 'particles' })}
                      className={`flex-1 min-w-[120px] py-3 rounded-xl border font-mono text-[10px] uppercase tracking-widest transition-all ${settings.heroStyle === 'particles' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-secondary hover:text-white'}`}
                    >
                      Particle Tech
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, heroStyle: 'aether' })}
                      className={`flex-1 min-w-[120px] py-3 rounded-xl border font-mono text-[10px] uppercase tracking-widest transition-all ${settings.heroStyle === 'aether' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-secondary hover:text-white'}`}
                    >
                      Aether Flow
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, heroStyle: 'spline' })}
                      className={`flex-1 min-w-[120px] py-3 rounded-xl border font-mono text-[10px] uppercase tracking-widest transition-all ${settings.heroStyle === 'spline' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-secondary hover:text-white'}`}
                    >
                      Spline 3D
                    </button>
                  </div>
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#111] pb-5">
              <div>
                <h2 className="text-3xl font-display uppercase">User Queries</h2>
                <p className="text-[#64748b] font-mono text-[9px] uppercase tracking-wider mt-1">Manage, filter, and draft AI responses to inbound messages</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Search Input */}
                <div className="relative flex-1 md:w-64">
                  <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <Search size={13} className="text-[#475569]" />
                  </span>
                  <input
                    type="text"
                    value={queriesFilter.search}
                    onChange={(e) => setQueriesFilter({ ...queriesFilter, search: e.target.value })}
                    placeholder="Search queries..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#181a20]/80 hover:bg-[#1f2229] focus:bg-[#1f2229] border border-white/[0.04] focus:border-[#2563eb]/30 rounded-xl font-mono text-[11px] text-white placeholder-[#475569] focus:outline-none transition-all"
                  />
                </div>
                {/* Status Dropdown */}
                <select
                  value={queriesFilter.status}
                  onChange={(e) => setQueriesFilter({ ...queriesFilter, status: e.target.value })}
                  className="bg-[#181a20]/80 hover:bg-[#1f2229] focus:outline-none border border-white/[0.04] rounded-xl px-3 py-1.5 font-mono text-[11px] text-white opacity-90 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="replied">Replied</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {queries.length === 0 ? (
                <div className="text-center py-20 glass rounded-3xl border border-line">
                  <p className="text-secondary font-mono text-xs uppercase">No queries received yet</p>
                </div>
              ) : filteredQueries.length === 0 ? (
                <div className="text-center py-20 glass rounded-3xl border border-line">
                  <p className="text-secondary font-mono text-xs uppercase">No queries match your search filters</p>
                </div>
              ) : (
                filteredQueries.map((q) => (
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

                    {(q.aiReplyText || q.autoReplyText) && (
                      <div className="bg-blue-500/5 p-6 rounded-xl border border-blue-500/20 mb-6 relative overflow-hidden">
                        {settings?.showAiIndicator ? (
                          <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-bl font-mono text-[9px] uppercase tracking-widest font-bold">
                            ✨ Auto-Replied by AI
                          </div>
                        ) : (
                          <div className="absolute top-0 right-0 p-2 bg-blue-500/10 rounded-bl font-mono text-[9px] text-[#5b8ff3] tracking-widest uppercase">
                            AI Auto Reply
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2 text-[#5b8ff3]">
                          <Bot size={16} />
                          <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Automated Response Sent</span>
                        </div>
                        <p className="text-secondary text-sm leading-relaxed italic">"{q.aiReplyText || q.autoReplyText}"</p>
                        {(q.autoRepliedAt || q.aiRepliedAt) && (
                          <p className="text-[10px] font-mono text-secondary/60 uppercase mt-4">
                            Generated on {(() => {
                              const ts = q.autoRepliedAt || q.aiRepliedAt;
                              if (typeof ts === 'string') return new Date(ts).toLocaleString();
                              return ts?.toDate?.()?.toLocaleString() || 'N/A';
                            })()}
                          </p>
                        )}
                      </div>
                    )}

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
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                          <button
                            type="button"
                            onClick={() => handleDraftWithAi(q.id, q.subject, q.message, q.userName, q.userEmail)}
                            disabled={draftingIds[q.id]}
                            className="w-full sm:w-auto px-6 py-2 bg-white/5 hover:bg-white/10 text-white font-mono text-[10px] border border-line hover:border-accent rounded-full transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
                          >
                            <Sparkles size={12} className={draftingIds[q.id] ? "animate-pulse text-accent" : "text-accent"} />
                            {draftingIds[q.id] ? "Drafting..." : "Draft Answer with AI"}
                          </button>

                          <button
                            onClick={() => handleReply(q.id, q.userEmail, q.subject)}
                            className="w-full sm:w-auto px-8 py-2 bg-accent text-white rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-transform"
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

            {/* VISUAL INTERFACE CUSTOMIZATION */}
            <div className="glass p-8 rounded-2xl space-y-6 border border-line mb-8">
              <div>
                <h3 className="text-lg font-display uppercase text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-[#2563eb]" /> Interface Customizer
                </h3>
                <p className="text-[10px] font-mono text-secondary uppercase tracking-widest mt-1">Configure layout themes and navigation style presets</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* GLOBAL STATE THEME SWITCHER */}
                <div className="space-y-3">
                  <label className="font-mono text-[10px] uppercase text-secondary block">Global Interface Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                        theme === "dark"
                          ? "border-[#2563eb] bg-[#2563eb]/10 text-white font-semibold"
                          : "border-white/[0.04] bg-white/[0.01] text-[#94a3b8] hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-[#0a0b0d] border border-white/20" />
                      <span className="text-[10px] font-mono uppercase tracking-widest">Dark Slate (Default)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                        theme === "light"
                          ? "border-[#2563eb] bg-blue-50 text-[#0f172a] font-semibold"
                          : "border-white/[0.04] bg-white/[0.01] text-[#94a3b8] hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-50 border border-slate-300" />
                      <span className="text-[10px] font-mono uppercase tracking-widest">High Contrast Light</span>
                    </button>
                  </div>
                </div>

                {/* SIDEBAR STYLE SWITCHER */}
                <div className="space-y-3">
                  <label className="font-mono text-[10px] uppercase text-secondary block">Navigation Sidebar Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSidebarStyle("hover-collapse")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                        sidebarStyle === "hover-collapse"
                          ? "border-[#2563eb] bg-[#2563eb]/10 text-white font-semibold"
                          : "border-white/[0.04] bg-white/[0.01] text-[#94a3b8] hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="text-[9px] font-mono uppercase tracking-tight">Hover Collapse</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSidebarStyle("expanded")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                        sidebarStyle === "expanded"
                          ? "border-[#2563eb] bg-[#2563eb]/10 text-white font-semibold"
                          : "border-white/[0.04] bg-white/[0.01] text-[#94a3b8] hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="text-[9px] font-mono uppercase tracking-tight">Always Open</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSidebarStyle("floating-dock")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                        sidebarStyle === "floating-dock"
                          ? "border-[#2563eb] bg-[#2563eb]/10 text-white font-semibold"
                          : "border-white/[0.04] bg-white/[0.01] text-[#94a3b8] hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="text-[9px] font-mono uppercase tracking-tight">Floating Dock</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

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
                <div className="space-y-4 md:col-span-2">
                  <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-4">
                      <label className="font-mono text-[10px] uppercase text-secondary">Design Loop Control</label>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, heroDesignLoop: !settings.heroDesignLoop })}
                        className={`w-full py-3 rounded-xl border font-mono text-[10px] uppercase tracking-widest transition-all ${settings.heroDesignLoop ? 'border-accent bg-accent/10 text-accent font-bold' : 'border-line text-secondary hover:text-white'}`}
                      >
                        {settings.heroDesignLoop ? 'Design Loop: ON' : 'Design Loop: OFF'}
                      </button>
                      <p className="text-[8px] font-mono text-secondary/60 uppercase">Switch design version upon every page refresh</p>
                    </div>

                    <div className="flex-1 space-y-4">
                      <label className="font-mono text-[10px] uppercase text-secondary">Mobile-Specific Allocation</label>
                      <select
                        className="w-full bg-white/5 border border-line rounded-lg px-4 py-3 outline-none focus:border-accent text-[10px] uppercase font-mono tracking-widest text-white appearance-none cursor-pointer"
                        value={settings.mobileHeroStyle || "sameAsDesktop"}
                        onChange={e => setSettings({ ...settings, mobileHeroStyle: e.target.value })}
                      >
                        <option value="sameAsDesktop">Same as Desktop</option>
                        <option value="default">Default (Stars)</option>
                        <option value="particles">Particles (Interactive)</option>
                        <option value="aether">Aether (Flow)</option>
                        <option value="spline">Spline (3D Robot)</option>
                      </select>
                      <p className="text-[8px] font-mono text-secondary/60 uppercase">Lock hero design for mobile users</p>
                    </div>
                  </div>

                  {settings.heroDesignLoop && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-line/50">
                      <label className="font-mono text-[10px] uppercase text-secondary">Loop Sequence Priority</label>
                      <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-white/5 border border-line rounded-xl">
                        {(settings.heroLoopOrder || []).map((style: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 border border-accent/30 rounded-lg text-[8px] font-mono text-accent uppercase">
                            <span>{idx + 1}. {style}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                const newOrder = [...(settings.heroLoopOrder || [])];
                                newOrder.splice(idx, 1);
                                setSettings({...settings, heroLoopOrder: newOrder});
                              }}
                              className="text-secondary/60 hover:text-red-500"
                            >✕</button>
                          </div>
                        ))}
                        {(!settings.heroLoopOrder || settings.heroLoopOrder.length === 0) && (
                          <span className="text-[8px] font-mono text-secondary/40 uppercase self-center ml-2 italic">No sequence set (will be random)</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['default', 'particles', 'aether', 'spline'].map(style => (
                          <button
                            key={style}
                            type="button"
                            disabled={(settings.heroLoopOrder || []).includes(style)}
                            onClick={() => setSettings({...settings, heroLoopOrder: [...(settings.heroLoopOrder || []), style]})}
                            className={`px-3 py-1.5 rounded-lg border font-mono text-[8px] uppercase transition-all ${
                              (settings.heroLoopOrder || []).includes(style) 
                              ? 'opacity-20 cursor-not-allowed border-line' 
                              : 'border-line text-secondary hover:border-accent hover:text-white hover:bg-accent/5'
                            }`}
                          >
                            + {style}
                          </button>
                        ))}
                        {(settings.heroLoopOrder || []).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSettings({...settings, heroLoopOrder: []})}
                            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500/60 font-mono text-[8px] uppercase hover:bg-red-500/10 hover:text-red-500 transition-all ml-auto"
                          >
                            Reset Order
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Desktop / Manual Hero Style</label>
                  <div className="flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, heroStyle: 'default' })}
                      className={`flex-1 min-w-[120px] py-3 rounded-xl border font-mono text-[10px] uppercase tracking-widest transition-all ${(!settings.heroStyle || settings.heroStyle === 'default') ? 'border-accent bg-accent/10 text-accent' : 'border-line text-secondary hover:text-white'}`}
                    >
                      Default Design
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, heroStyle: 'particles' })}
                      className={`flex-1 min-w-[120px] py-3 rounded-xl border font-mono text-[10px] uppercase tracking-widest transition-all ${settings.heroStyle === 'particles' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-secondary hover:text-white'}`}
                    >
                      Particle Tech
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, heroStyle: 'aether' })}
                      className={`flex-1 min-w-[120px] py-3 rounded-xl border font-mono text-[10px] uppercase tracking-widest transition-all ${settings.heroStyle === 'aether' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-secondary hover:text-white'}`}
                    >
                      Aether Flow
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, heroStyle: 'spline' })}
                      className={`flex-1 min-w-[120px] py-3 rounded-xl border font-mono text-[10px] uppercase tracking-widest transition-all ${settings.heroStyle === 'spline' ? 'border-accent bg-accent/10 text-accent' : 'border-line text-secondary hover:text-white'}`}
                    >
                      Spline 3D
                    </button>
                  </div>
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

                {/* AUTOMATED AI EMAIL REPLY OPTIONS */}
                <div className="col-span-1 md:col-span-2 pt-6 border-t border-line space-y-6">
                  <h3 className="text-lg font-display uppercase tracking-wider text-white">AI Auto-Reply Configuration</h3>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-line">
                    <div>
                      <h4 className="text-sm font-sans font-medium text-white mb-1">Enable Automated AI Email Replies</h4>
                      <p className="text-[10px] font-mono text-secondary uppercase">
                        Automatically draft and send professional responses using Gemini AI when a new inquiry is received.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, enableAutoReply: !settings.enableAutoReply })}
                      className={`px-4 py-2 rounded-xl border text-[10px] font-mono uppercase tracking-widest transition-all ${
                        settings.enableAutoReply 
                          ? 'border-accent bg-accent/20 text-accent font-bold' 
                          : 'border-line text-secondary hover:text-white'
                      }`}
                    >
                      {settings.enableAutoReply ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-line">
                    <div>
                      <h4 className="text-sm font-sans font-medium text-white mb-1">Show AI Generated Indicator on Queries</h4>
                      <p className="text-[10px] font-mono text-secondary uppercase">
                        Display a visual badge indicating that a response was generated automatically by the AI agent on client views.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, showAiIndicator: !settings.showAiIndicator })}
                      className={`px-4 py-2 rounded-xl border text-[10px] font-mono uppercase tracking-widest transition-all ${
                        settings.showAiIndicator 
                          ? 'border-accent bg-accent/20 text-accent font-bold' 
                          : 'border-line text-secondary hover:text-white'
                      }`}
                    >
                      {settings.showAiIndicator ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary block">AI Acknowledge Instructions</label>
                    <textarea
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-3 outline-none focus:border-accent text-sm resize-y"
                      rows={4}
                      value={settings.autoReplyInstruction === undefined 
                        ? "You are an automated AI assistant for Bilal Rasheed. Write a brief, polite, and professional email response acknowledging the user's inquiry, letting them know Bilal will review it shortly, and providing a preliminary helpful thought based on their message text."
                        : settings.autoReplyInstruction
                      }
                      onChange={e => setSettings({ ...settings, autoReplyInstruction: e.target.value })}
                      placeholder="E.g. You are an automated AI assistant for Bilal Rasheed. Write a brief, polite, and professional email response acknowledging the user's inquiry..."
                    />
                    <p className="text-[8px] font-mono text-secondary/60 uppercase">
                      This system instruction instructs the Gemini 3.5-flash model on how to draft the email response sent back to the inquirer.
                    </p>
                  </div>

                  {/* Live Systems Diagnostics Tool */}
                  <div className="bg-white/5 p-6 rounded-2xl border border-line space-y-6 mt-6">
                    <div>
                      <h4 className="text-sm font-sans font-medium text-white mb-1 flex items-center gap-2">
                        <Bot size={16} className="text-[#3b82f6]" /> Live System Diagnostics & Mail Tester
                      </h4>
                      <p className="text-[10px] font-mono text-secondary uppercase">
                        Verify communication and AI generation connections directly on the server to isolate issues.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* SMTP Handshake Diagnostics */}
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={handleDiagnoseSmtp}
                          disabled={smtpTestLoading}
                          className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-white font-mono text-[9px] border border-line hover:border-accent rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
                        >
                          {smtpTestLoading ? "Testing Connection..." : "Verify SMTP Connection"}
                        </button>

                        {smtpTestSteps.length > 0 && (
                          <div className="bg-black/40 p-3 rounded-lg border border-line/40 font-mono text-[9px] space-y-1 h-44 overflow-y-auto scrollbar-none text-secondary">
                            <div className="text-accent border-b border-line/30 pb-1 mb-1 uppercase tracking-wider font-bold">SMTP Mailer Logs:</div>
                            {smtpTestSteps.map((step, idx) => (
                              <div key={idx} className={step.includes("SUCCESS") ? "text-green-400 font-bold" : step.includes("ERROR") || step.includes("FAIL") ? "text-red-400" : ""}>
                                &gt; {step}
                              </div>
                            ))}
                            {smtpTestError && (
                              <div className="text-red-400 mt-2 p-1 bg-red-500/10 border border-red-500/20 rounded font-sans text-[10px]">
                                <strong>Diagnostic Failure:</strong> {smtpTestError}
                              </div>
                            )}
                            {smtpTestSuccess && (
                              <div className="text-green-400 mt-2 p-1 bg-green-500/10 border border-green-500/20 rounded font-sans text-[10px] font-bold">
                                ✓ Handshake Authenticated! NodeMailer is active.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* AI Draft Diagnostics */}
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={handleTestAiReply}
                          disabled={aiTestLoading}
                          className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-white font-mono text-[9px] border border-line hover:border-accent rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
                        >
                          {aiTestLoading ? "Testing AI Draft..." : "Test AI Generation"}
                        </button>

                        {aiTestSteps.length > 0 && (
                          <div className="bg-black/40 p-3 rounded-lg border border-line/40 font-mono text-[9px] space-y-1 h-44 overflow-y-auto scrollbar-none text-secondary">
                            <div className="text-accent border-b border-line/30 pb-1 mb-1 uppercase tracking-wider font-bold">Gemini AI Logs:</div>
                            {aiTestSteps.map((step, idx) => (
                              <div key={idx} className={step.includes("SUCCESS") ? "text-green-400 font-bold" : step.includes("ERROR") || step.includes("FAIL") ? "text-red-400" : ""}>
                                &gt; {step}
                              </div>
                            ))}
                            {aiTestResultText && (
                              <div className="text-white bg-white/5 max-h-20 overflow-y-auto p-2 border border-line/20 rounded text-[9px] mt-2 italic whitespace-pre-wrap">
                                Response Draft: "{aiTestResultText}"
                              </div>
                            )}
                            {aiTestError && (
                              <div className="text-red-400 mt-2 p-1 bg-red-500/10 border border-red-500/20 rounded font-sans text-[10px]">
                                <strong>AI Failure:</strong> {aiTestError}
                              </div>
                            )}
                            {aiTestSuccess && (
                              <div className="text-green-400 mt-2 p-1 bg-green-500/10 border border-green-500/20 rounded font-sans text-[10px] font-bold">
                                ✓ Gemini 3.5-flash generated content successfully!
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-display uppercase">Chat Insights & History</h2>
              <button 
                onClick={fetchData}
                className="px-4 py-2 border border-line rounded-full font-mono text-[10px] uppercase tracking-widest text-secondary hover:text-white transition-all"
              >
                <RotateCcw size={14} className="inline mr-2" /> Refresh Sessions
              </button>
            </div>
            
            <ChatHistoryManager 
              initialSessions={chatSessions} 
              onRefresh={fetchData} 
            />
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

        {activeTab === "testimonials" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-display uppercase">Manage Testimonials</h2>
              <button
                onClick={() => { setIsEditing("new_testimonial"); setFormData({ rating: 5, order: testimonials.length }); }}
                className="px-6 py-2 bg-accent text-white rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2"
              >
                <Plus size={14} /> Add Testimonial
              </button>
            </div>

            {(isEditing === "new_testimonial" || (isEditing && activeTab === "testimonials")) && (
              <div className="glass p-8 rounded-2xl border-accent/30">
                <form onSubmit={handleSaveTestimonial} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Client Name</label>
                    <input
                      required
                      placeholder="e.g., Jane Doe"
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent text-white"
                      value={formData.name || ""}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Client Role / Company</label>
                    <input
                      required
                      placeholder="e.g., CEO, TechCorp"
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent text-white"
                      value={formData.role || ""}
                      onChange={e => setFormData({ ...formData, role: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Avatar URL (Optional)</label>
                    <input
                      placeholder="https://images.unsplash.com/... or leave empty for default avatar"
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent text-white"
                      value={formData.avatar || ""}
                      onChange={e => setFormData({ ...formData, avatar: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Testimonial Text</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Write feedback..."
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent text-white"
                      value={formData.text || ""}
                      onChange={e => setFormData({ ...formData, text: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Rating Stars (1 - 5)</label>
                    <select
                      className="w-full bg-[#0a0a0a] border border-line rounded-lg px-4 py-2 outline-none focus:border-accent text-white"
                      value={formData.rating || 5}
                      onChange={e => setFormData({ ...formData, rating: Number(e.target.value) })}
                    >
                      <option value={5}>5 Stars</option>
                      <option value={4}>4 Stars</option>
                      <option value={3}>3 Stars</option>
                      <option value={2}>2 Stars</option>
                      <option value={1}>1 Star</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-secondary">Display Order</label>
                    <input
                      type="number"
                      className="w-full bg-white/5 border border-line rounded-lg px-4 py-2 outline-none focus:border-accent text-white"
                      value={formData.order ?? ""}
                      onChange={e => setFormData({ ...formData, order: Number(e.target.value) })}
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => { setIsEditing(null); setFormData({}); }}
                      className="px-6 py-2 border border-line rounded-full font-mono text-[10px] uppercase tracking-widest text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-2 bg-white text-black rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2"
                    >
                      <Save size={14} /> Save Testimonial
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <div key={t.id} className="glass rounded-2xl overflow-hidden border-line group relative p-6 flex flex-col justify-between h-full bg-white/[0.01]">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <img 
                          src={t.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&h=200"} 
                          alt="" 
                          className="w-10 h-10 rounded-full object-cover border border-white/10" 
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="text-sm font-medium text-white">{t.name}</h4>
                          <p className="text-[10px] font-mono text-secondary uppercase tracking-wider">{t.role}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setIsEditing(t.id); setFormData(t); }}
                          className="p-1.5 bg-white text-black rounded-lg hover:scale-110 transition-transform"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteTestimonial(t.id)}
                          className="p-1.5 bg-red-500 text-white rounded-lg hover:scale-110 transition-transform"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-secondary text-xs italic leading-relaxed">"{t.text}"</p>
                    <div className="flex items-center gap-0.5 pt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          className={i < (t.rating ?? 5) ? "fill-amber-400 text-amber-400" : "text-white/10"}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {testimonials.length === 0 && (
              <div className="text-center py-20 glass rounded-3xl border border-line">
                <p className="text-secondary font-mono text-xs uppercase">No testimonials added yet</p>
                <p className="text-secondary/55 text-[10px] mt-2">Displaying site default testimonials</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "apiKeys" && isSuperAdmin && (
          <KeyManager />
        )}
        </div>
      </div>

      {/* Real-time Toasts Layer */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl border bg-[#0a0b0d] border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-all duration-300 animate-slide-in flex gap-3 items-start relative select-none ${
              toast.type === "lead" ? "border-l-4 border-l-purple-500" : "border-l-4 border-l-[#2563eb]"
            }`}
          >
            <div className={`p-1.5 rounded-lg border ${
              toast.type === "lead" ? "text-purple-400 bg-purple-500/10 border-purple-400/20" : "text-blue-400 bg-[#2563eb]/10 border-blue-400/20"
            }`}>
              {toast.type === "lead" ? <CheckCircle size={14} /> : <MessageSquare size={14} />}
            </div>
            <div className="flex-1 pr-6">
              <h4 className="text-[11px] font-sans font-bold text-white uppercase tracking-wider">{toast.title}</h4>
              <p className="text-[10px] text-[#94a3b8] mt-1 leading-normal">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-[#475569] hover:text-white absolute top-3.5 right-3.5 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
