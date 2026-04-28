import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Github, Loader2, AlertCircle } from "lucide-react";

interface ProjectPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    title: string;
    liveUrl: string;
    githubUrl?: string;
    showOpenInNewTab?: boolean;
  } | null;
}

export default function ProjectPreviewModal({ isOpen, onClose, project }: ProjectPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setHasError(false);
      
      // Set a timeout to detect if iframe failed to load / CORS issues
      const timeout = setTimeout(() => {
        if (isLoading) {
          // If still loading after 10s, it's likely a CORS block or very slow
          // Note: In a real app we might use postMessage or check if the iframe is actually reachable
          // but for CORS detection, a timeout is a common heuristic.
        }
      }, 10000);

      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleEsc);
      
      return () => {
        clearTimeout(timeout);
        window.removeEventListener("keydown", handleEsc);
      };
    }
  }, [isOpen, onClose]);

  if (!project) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/95 backdrop-blur-sm" 
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-7xl h-[90vh] bg-black border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-4">
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
                >
                  <X size={20} />
                </button>
                <h3 className="text-sm font-display uppercase tracking-widest text-white font-bold truncate max-w-[150px] md:max-w-none">
                  {project.title}
                </h3>
              </div>

              <div className="flex items-center gap-2 md:gap-4">
                {project.githubUrl && (
                  <a 
                    href={project.githubUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white flex items-center gap-2 text-xs uppercase font-mono"
                    title="View Source"
                  >
                    <Github size={18} />
                    <span className="hidden md:inline">Source</span>
                  </a>
                )}
                {project.showOpenInNewTab !== false && (
                  <a 
                    href={project.liveUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-white text-black px-4 py-2 rounded-full text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 hover:bg-[#00ffa3] transition-colors"
                  >
                    <ExternalLink size={14} />
                    Open in New Tab
                  </a>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 relative bg-[#0a0a0a] overflow-hidden">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-[#0a0a0a]">
                  <Loader2 className="w-10 h-10 text-white animate-spin opacity-50" />
                  <p className="font-mono text-[10px] uppercase tracking-widest text-secondary">Loading Preview...</p>
                </div>
              )}

              {hasError || !project.liveUrl ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center bg-[#0a0a0a]">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                    <AlertCircle size={32} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-display uppercase">
                      {!project.liveUrl ? "No Live URL Provided" : "Cannot Preview in Iframe"}
                    </h4>
                    <p className="text-secondary text-sm max-w-md mx-auto leading-relaxed">
                      {!project.liveUrl 
                        ? "This project does not have a live preview URL set."
                        : "This developer site might have security policies (CORS/X-Frame-Options) that prevent it from being shown here."}
                    </p>
                  </div>
                  {project.liveUrl && (
                    <a 
                      href={project.liveUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="px-8 py-3 bg-white text-black rounded-full font-mono text-[10px] uppercase tracking-widest hover:bg-[#00ffa3] transition-colors"
                    >
                      Open Live Site ↗
                    </a>
                  )}
                </div>
              ) : (
                <iframe
                  src={project.liveUrl}
                  className="w-full h-full border-none"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                  title={project.title}
                  sandbox="allow-popups allow-forms allow-scripts allow-same-origin"
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
