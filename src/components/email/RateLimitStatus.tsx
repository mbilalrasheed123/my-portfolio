import React from "react";
import { AlertCircle, CheckCircle, ShieldAlert, Zap } from "lucide-react";

interface RateLimitStatusProps {
  selectedModel: string;
  modelRPM: number;
  requestCountThisMinute: number;
  timeUntilRateLimitReset: string;
}

export default function RateLimitStatus({
  selectedModel = "flash-lite",
  modelRPM = 15,
  requestCountThisMinute = 0,
  timeUntilRateLimitReset = "Dynamic Reset Enabled"
}: RateLimitStatusProps) {
  const isCloseToLimit = requestCountThisMinute >= modelRPM - 2;
  const isOverLimit = requestCountThisMinute >= modelRPM;

  const modelLabel = (() => {
    switch (selectedModel) {
      case "flash-lite":
        return "Gemini 3.1 Flash-Lite (15 RPM)";
      case "flash":
        return "Gemini 3.5 Flash (10 RPM)";
      case "2.5-flash":
        return "Gemini 2.5 Flash (10 RPM)";
      case "2.5-pro":
        return "Gemini 2.5 Pro (2 RPM - Trial)";
      default:
        return selectedModel;
    }
  })();

  return (
    <div className="bg-[#111317] border border-white/[0.06] rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-white/[0.12] transition-all duration-300">
      <div className="absolute top-0 right-0 p-3 bg-white/[0.02] rounded-bl-xl">
        <Zap size={16} className={isOverLimit ? "text-red-400 animate-pulse" : "text-blue-400"} />
      </div>

      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl border ${
          isOverLimit 
            ? "bg-red-500/10 border-red-500/20 text-red-400" 
            : isCloseToLimit 
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400" 
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        }`}>
          {isOverLimit ? <ShieldAlert size={18} /> : isCloseToLimit ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
        </div>

        <div className="space-y-1.5 flex-1 min-w-0">
          <span className="text-[10px] font-mono text-secondary uppercase tracking-widest block font-semibold">Gemini Rate Limit Status</span>
          <h4 className="text-sm font-sans font-bold text-white truncate">{modelLabel}</h4>
          
          <div className="grid grid-cols-2 gap-4 mt-4 bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
            <div>
              <p className="text-[8px] font-mono text-secondary uppercase tracking-tighter">Used This Minute</p>
              <p className="text-lg font-mono font-bold text-white mt-1">
                {requestCountThisMinute} <span className="text-xs text-secondary font-normal">/ {modelRPM}</span>
              </p>
            </div>
            <div>
              <p className="text-[8px] font-mono text-secondary uppercase tracking-tighter">Cooldown Reset</p>
              <p className="text-xs font-mono font-bold text-secondary mt-2 truncate">
                {timeUntilRateLimitReset}
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${
              isOverLimit 
                ? "bg-red-500 animate-ping" 
                : isCloseToLimit 
                  ? "bg-amber-500 animate-pulse" 
                  : "bg-emerald-500"
            }`} />
            <span className="text-[9px] font-mono text-secondary uppercase tracking-wider">
              Status: <span className={isOverLimit ? "text-red-400 font-bold" : isCloseToLimit ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                {isOverLimit ? "RPM CAP HIT - COOING DOWN" : isCloseToLimit ? "WARN: NEAR RPM LIMIT" : "✅ SAFE"}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
