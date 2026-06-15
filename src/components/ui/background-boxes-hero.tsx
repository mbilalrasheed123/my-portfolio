"use client";
import React from "react";
import { Boxes } from "./background-boxes";
import { MousePointer2, ArrowRight } from "lucide-react";

interface BackgroundBoxesHeroProps {
  title?: string;
  subtitle?: string;
  type?: string;
}

export default function BackgroundBoxesHero({ title, subtitle, type }: BackgroundBoxesHeroProps) {
  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none selection:bg-accent/30 selection:text-white animate-fade-in" id="home">
      {/* Absolute container that holds background boxes */}
      <div className="absolute inset-0 w-full h-full bg-slate-950 z-0 overflow-hidden">
        <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-transparent via-[#0a0f1d]/20 to-slate-950 z-10 pointer-events-none" />
        <div className="absolute inset-0 w-full h-full bg-transparent z-10 [mask-image:radial-gradient(ellipse_at_center,transparent_10%,black_80%)] pointer-events-none" />
        <Boxes />
      </div>

      {/* Actual Hero Content over the boxes */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none px-4">
        <div className="max-w-4xl w-full text-center space-y-8">
          {type && (
            <div className="inline-block">
              <span className="py-1 px-3 border border-white/20 rounded-full text-xs font-mono text-white/60 tracking-widest uppercase bg-white/5 backdrop-blur-sm">
                {type}
              </span>
            </div>
          )}
          
          <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-bold bg-gradient-to-br from-white to-slate-400 bg-clip-text text-center text-transparent tracking-tight break-words whitespace-pre-line leading-none">
            {title || "Crafting Experiences"}
          </h1>
          
          <p className="max-w-xl mx-auto text-sm md:text-lg leading-relaxed text-slate-300/80 font-light px-4">
            {subtitle || "Interactive layout rendering utilizing Framer Motion grid dynamic responses."}
          </p>

          <div className="pt-4 md:pt-8 pointer-events-auto">
            <button 
              onClick={() => document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })}
              className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-bold tracking-wide overflow-hidden transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)] cursor-pointer"
            >
              <span className="relative z-10">Explore Work</span>
              <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 animate-pulse pointer-events-none z-10">
         <span className="text-[10px] uppercase tracking-[0.2em] font-mono">Hover Grid</span>
         <MousePointer2 size={16} />
      </div>
    </div>
  );
}
