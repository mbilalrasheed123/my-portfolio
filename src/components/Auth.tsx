import { useState } from "react";
import { motion } from "motion/react";
import { LogIn, UserPlus, Mail, Lock, User, CheckCircle } from "lucide-react";
import { api } from "../lib/api";
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signInWithPopup, 
  googleProvider,
  sendEmailVerification,
  signOut
} from "../firebase";

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
  const [verificationSent, setVerificationSent] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setVerificationSent(false);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Save profile if name provided
        if (name) {
          await updateProfile(user, { displayName: name });
        }

        await api.saveUser(user);

        setSuccess(true);
        setTimeout(() => {
          onSuccess?.(user);
        }, 1500);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (name) {
          await updateProfile(user, { displayName: name });
        }

        // Send verification email in background
        sendEmailVerification(user).catch(err => console.error("Verification email failed:", err));
        
        await api.saveUser(user);
        
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.(user);
        }, 1500);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = err.message || "Authentication failed. Please try again.";
      if (err.code === "auth/invalid-credential") {
        msg = "Invalid credentials. Please check your email and password, or use Google Sign-In if you previously used it.";
      } else if (msg.includes("requests-from-referer") || err.code?.includes("referer")) {
        msg = "Domain Blocked: Please add this domain to 'Authorized domains' in Firebase Console (Authentication > Settings) and check API Key restrictions in Google Cloud Console.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setError("");
    try {
      // We can't resend if logged out unless we sign in again, 
      // but usually we can tell them to try signing in which triggers the message again.
      setError("Please try signing in with your credentials to receive a new verification prompt if needed.");
    } catch (err: any) {
      setError(err.message || "Failed to resend verification email.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await api.saveUser(result.user);
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.(result.user);
      }, 1500);
    } catch (err: any) {
      console.error("Google Auth error:", err);
      let msg = err.message || "Google authentication failed.";
      if (msg.includes("requests-from-referer") || err.code?.includes("referer")) {
        msg = "Domain Blocked: Please add this domain to 'Authorized domains' in Firebase Console (Authentication > Settings) and check API Key restrictions in Google Cloud Console.";
      }
      setError(msg);
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
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-4">
                <p className="text-red-500 text-xs font-mono">{error}</p>
                {verificationSent && isLogin && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="mt-2 text-white hover:text-accent font-mono text-[10px] uppercase underline"
                  >
                    Resend verification email?
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-white text-black font-display uppercase tracking-widest text-sm rounded-xl hover:bg-accent hover:text-white transition-all disabled:opacity-50"
            >
              {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-line"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black px-2 text-secondary font-mono">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 bg-white/5 border border-line text-white font-display uppercase tracking-widest text-xs rounded-xl hover:bg-white hover:text-black transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
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

