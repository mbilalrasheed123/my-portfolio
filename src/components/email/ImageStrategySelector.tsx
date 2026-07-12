import React from "react";
import { ImageIcon, Eye, Globe } from "lucide-react";

interface ImageStrategySelectorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export default function ImageStrategySelector({ value, onChange, disabled = false }: ImageStrategySelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-semibold block">
        Personalized Image Strategy
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* OPTION 1: KEYWORD-BASED */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("option1-keyword")}
          className={`text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-40 ${
            value === "option1-keyword"
              ? "bg-[#2563eb]/10 border-[#2563eb] shadow-[0_0_20px_rgba(37,99,235,0.15)]"
              : "bg-[#111317] border-white/[0.04] hover:border-white/[0.12] hover:bg-white/[0.01]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon size={14} className={value === "option1-keyword" ? "text-[#2563eb]" : "text-secondary"} />
                <span className="font-sans font-bold text-sm text-white">Option 1: Keyword-Based</span>
              </div>
              <span className="text-[8px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest px-2 py-0.5 rounded-full font-bold">
                Recommended
              </span>
            </div>
            <p className="text-[10px] text-[#94a3b8] mt-2 leading-relaxed">
              Gemini generates high-precision context keywords (e.g., <i>"cozy-bakery-interiors"</i>). We inject this into the Source Unsplash API, serving a fresh, relevant, eye-catching image every single time the recipient opens the email.
            </p>
          </div>
          <div className="flex items-center gap-1 mt-auto border-t border-white/[0.04] pt-2 w-full text-[9px] font-mono text-secondary uppercase">
            <Eye size={10} /> Output example: <span className="text-white font-bold ml-1">"modern-dental-clinic"</span>
          </div>
        </button>

        {/* OPTION 2: DIRECT URL */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("option2-direct-url")}
          className={`text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-40 ${
            value === "option2-direct-url"
              ? "bg-[#2563eb]/10 border-[#2563eb] shadow-[0_0_20px_rgba(37,99,235,0.15)]"
              : "bg-[#111317] border-white/[0.04] hover:border-white/[0.12] hover:bg-white/[0.01]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe size={14} className={value === "option2-direct-url" ? "text-[#2563eb]" : "text-secondary"} />
                <span className="font-sans font-bold text-sm text-white">Option 2: Direct Photo URL</span>
              </div>
            </div>
            <p className="text-[10px] text-[#94a3b8] mt-2 leading-relaxed">
              Instructs Gemini to retrieve static photo URLs directly matching Unsplash's structured database. The image content remains completely fixed, locking down the layout but requiring stricter verification to avoid dead links.
            </p>
          </div>
          <div className="flex items-center gap-1 mt-auto border-t border-white/[0.04] pt-2 w-full text-[9px] font-mono text-secondary uppercase truncate">
            <Eye size={10} /> Output example: <span className="text-white font-bold ml-1 truncate">"https://images.unsplash.com/photo-X..."</span>
          </div>
        </button>
      </div>
    </div>
  );
}
