import { useState } from "react";
import { motion } from "motion/react";
import { LogIn, UserPlus, Mail, Lock, User, CheckCircle } from "lucide-react";
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "../firebase";

interface AuthProps {
  onSuccess?: (user: any) => void;
  loginOnly?: boolean;
}

export default function Auth({ onSuccess, loginOnly = false }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.(userCredential.user);
        }, 1500);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.(userCredential.user);
        }, 1500);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto glass p-8 rounded-3xl border border-line">
      {success ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-3xl font-display uppercase mb-2">Success!</h2>
          <p className="text-secondary text-sm font-mono uppercase tracking-widest">
            Redirecting you now...
          </p>
        </div>
      ) : (
        <>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-display uppercase mb-2">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-secondary text-sm font-mono uppercase tracking-widest">
              {isLogin ? "Sign in to manage your portfolio" : "Join us to start a conversation"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-line rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent transition-colors"
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-line rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent transition-colors"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-line rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent transition-colors"
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs font-mono">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-white text-black font-display uppercase tracking-widest text-sm rounded-xl hover:bg-accent hover:text-white transition-all disabled:opacity-50"
            >
              {loading ? "Processing..." : isLogin ? "Sign In" : "Sign Up"}
            </button>
          </form>

          {!loginOnly && (
            <p className="mt-8 text-center text-xs text-secondary font-mono uppercase">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-white hover:text-accent transition-colors"
              >
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}

