import React from "react";
import { Sparkles, Cpu, AlertTriangle } from "lucide-react";

interface ModelSelectorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({ value, onChange, disabled = false }: ModelSelectorProps) {
  const models = [
    {
      id: "flash-lite",
      name: "Gemini 3.1 Flash-Lite",
      rpm: 15,
      description: "Fastest response time, highest free tier rate limits (15 RPM). Highly recommended.",
      badge: "Fastest / Recommended"
    },
    {
      id: "flash",
      name: "Gemini 3.5 Flash",
      rpm: 10,
      description: "Excellent creative copywriting and structured JSON generation (10 RPM).",
      badge: "Balanced Copywriter"
    },
    {
      id: "2.5-flash",
      name: "Gemini 2.5 Flash",
      rpm: 10,
      description: "Great multi-turn instruction compliance. Reliable and fast (10 RPM).",
      badge: "Reliable"
    },
    {
      id: "2.5-pro",
      name: "Gemini 2.5 Pro",
      rpm: 2,
      description: "Deepest context reasoning. Extremely strict trials (2 RPM limit). Use for complex personalization.",
      badge: "Heavy Reasoning"
    }
  ];

  return (
    <div className="space-y-3">
      <label className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-semibold block">
        Select Gemini Generation Model
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((model) => {
          const isSelected = value === model.id;
          return (
            <button
              key={model.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(model.id)}
              className={`text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-36 ${
                isSelected
                  ? "bg-[#2563eb]/10 border-[#2563eb] shadow-[0_0_20px_rgba(37,99,235,0.15)]"
                  : "bg-[#111317] border-white/[0.04] hover:border-white/[0.12] hover:bg-white/[0.01]"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className={isSelected ? "text-[#2563eb]" : "text-secondary"} />
                    <span className="font-sans font-bold text-sm text-white">{model.name}</span>
                  </div>
                  <span className={`text-[8px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full font-bold ${
                    isSelected ? "bg-[#2563eb] text-white" : "bg-white/[0.06] text-secondary"
                  }`}>
                    {model.badge}
                  </span>
                </div>
                <p className="text-[10px] text-[#94a3b8] mt-2 leading-relaxed">
                  {model.description}
                </p>
              </div>

              <div className="flex items-center justify-between mt-auto border-t border-white/[0.04] pt-2 w-full">
                <span className="text-[9px] font-mono text-secondary uppercase tracking-wider">
                  Rate Limit: <span className="text-white font-bold">{model.rpm} RPM</span>
                </span>
                {model.id === "2.5-pro" && (
                  <span className="text-[8px] font-mono text-amber-500 uppercase flex items-center gap-1">
                    <AlertTriangle size={10} /> Free trial only
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
