import { useState } from "react";
import { motion } from "motion/react";
import { LogIn, UserPlus, Mail, Lock, User, CheckCircle } from "lucide-react";

interface AuthProps {
  onSuccess?: (user: any) => void;
  loginOnly?: boolean;
}

export default function Auth({ onSuccess, loginOnly = false }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [success, setSuccess] = useState(false);

  const requestOtp = async () => {
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      
      const result = await response.json();
      if (response.ok) {
        if (result.status === "skipped" && result.otp) {
          console.warn("Email service not configured. OTP is:", result.otp);
          // In a real app, we wouldn't return the OTP to the client, but for demo purposes:
          alert(`DEMO MODE: OTP is ${result.otp}`);
        }
        setVerificationStep(true);
      } else {
        setError(result.error || "Failed to send verification code.");
      }
    } catch (err) {
      console.error("Failed to request OTP:", err);
      setError("An error occurred. Please try again.");
    }
  };

  const verifyOtp = async () => {
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, name })
      });
      
      const result = await response.json();
      if (response.ok) {
        setSuccess(true);
        // Store user in local storage for persistence
        localStorage.setItem("portfolio_user", JSON.stringify(result.user));
        setTimeout(() => {
          onSuccess?.(result.user);
        }, 1500);
      } else {
        setError(result.error || "Invalid verification code.");
      }
    } catch (err) {
      console.error("Failed to verify OTP:", err);
      setError("An error occurred. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (verificationStep) {
      await verifyOtp();
    } else {
      await requestOtp();
    }
    
    setLoading(false);
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
              {verificationStep ? "Verify Email" : isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-secondary text-sm font-mono uppercase tracking-widest">
              {verificationStep 
                ? `Enter the code sent to ${email}` 
                : isLogin ? "Sign in to manage your queries" : "Join us to start a conversation"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {verificationStep ? (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                <input
                  type="text"
                  placeholder="6-Digit Code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full bg-white/5 border border-line rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent transition-colors"
                  required
                />
              </div>
            ) : (
              <>
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
              </>
            )}

            {error && (
              <p className="text-red-500 text-xs font-mono">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-white text-black font-display uppercase tracking-widest text-sm rounded-xl hover:bg-accent hover:text-white transition-all disabled:opacity-50"
            >
              {loading ? "Processing..." : verificationStep ? "Verify" : isLogin ? "Sign In" : "Sign Up"}
            </button>
          </form>

          {!verificationStep && !loginOnly && (
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
