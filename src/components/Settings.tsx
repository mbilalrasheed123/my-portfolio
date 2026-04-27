import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { User, Mail, Phone, Lock, Save, AlertCircle, CheckCircle } from "lucide-react";
import { 
  auth, 
  updateProfile, 
  updateEmail, 
  updatePassword, 
  reauthenticateWithCredential,
  EmailAuthProvider 
} from "../firebase";
import { api } from "../lib/api";

export default function Settings() {
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const u = auth.currentUser;
    if (u) {
      setUser(u);
      setDisplayName(u.displayName || "");
      setEmail(u.email || "");
      // Mocking phone as it's not stored in base Auth profile easily without custom claims or database
      // Let's assume we store it in a 'users' collection too
      api.get("users").then(users => {
        const userData = users?.find((curr: any) => curr.email === u.email);
        if (userData?.phone) setPhone(userData.phone);
      });
    }
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!auth.currentUser) return;

      // Update Firebase Auth Profile
      await updateProfile(auth.currentUser, { displayName });

      // Update Email if changed
      if (email !== auth.currentUser.email) {
        if (!currentPassword) {
          throw new Error("Current password is required to change email.");
        }
        const credential = EmailAuthProvider.credential(auth.currentUser.email || "", currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updateEmail(auth.currentUser, email);
      }

      // Update Password if provided
      if (newPassword) {
        if (!currentPassword) {
          throw new Error("Current password is required to change password.");
        }
        const credential = EmailAuthProvider.credential(auth.currentUser.email || "", currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
      }

      // Sync with users collection
      const users = await api.get("users");
      const existingUser = users?.find((u: any) => u.email === auth.currentUser?.email);
      
      const userData = {
        displayName,
        email,
        phone,
        lastUpdated: new Date().toISOString()
      };

      if (existingUser) {
        await api.put("users", existingUser.id, userData);
      } else {
        await api.post("users", { ...userData, createdAt: new Date().toISOString() });
      }

      setSuccess("Profile updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      console.error("Update error:", err);
      setError(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secondary font-mono text-xs uppercase tracking-widest">Please sign in to view settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-4xl font-display uppercase mb-4">Account Settings</h2>
        <p className="text-secondary font-mono text-xs uppercase tracking-widest">
          Manage your profile and security preferences
        </p>
      </div>

      <form onSubmit={handleUpdateProfile} className="glass p-8 rounded-3xl border border-line space-y-8">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-500 text-sm">
            <CheckCircle size={18} />
            {success}
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-lg font-display uppercase border-b border-line pb-2">Profile Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-mono text-secondary uppercase tracking-widest">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white/5 border border-line rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent transition-colors"
                  placeholder="Your Name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-mono text-secondary uppercase tracking-widest">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white/5 border border-line rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent transition-colors"
                  placeholder="+1 234 567 890"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-mono text-secondary uppercase tracking-widest">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={16} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-line rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent transition-colors"
                placeholder="your@email.com"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-display uppercase border-b border-line pb-2">Security</h3>
          <p className="text-[10px] font-mono text-secondary uppercase leading-relaxed">
            Leave "New Password" blank if you don't want to change it. Your current password is required for email/password changes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-mono text-secondary uppercase tracking-widest">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-white/5 border border-line rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-mono text-secondary uppercase tracking-widest">New Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-line rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-white text-black font-display uppercase tracking-widest text-sm rounded-xl hover:bg-accent hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? "Updating..." : (
            <>
              Save Changes <Save size={16} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
