import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight, Github, ExternalLink } from "lucide-react";

interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  technologies: string[];
  thumbnailUrl: string;
  liveUrl: string;
  githubUrl?: string;
  showOpenInNewTab?: boolean;
  featured: boolean;
}

interface FeaturedProjectsProps {
  projects: Project[];
  onViewProject: (project: Project) => void;
}

export default function FeaturedProjects({ projects, onViewProject }: FeaturedProjectsProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const featured = projects.filter(p => p.featured);

  useEffect(() => {
    if (featured.length === 0) return;
    const interval = setInterval(() => {
      nextProject();
    }, 8000);
    return () => clearInterval(interval);
  }, [index, featured.length]);

  const nextProject = () => {
    setDirection(1);
    setIndex((prev) => (prev + 1) % featured.length);
  };

  const prevProject = () => {
    setDirection(-1);
    setIndex((prev) => (prev - 1 + featured.length) % featured.length);
  };

  if (featured.length === 0) return null;

  const current = featured[index];

  return (
    <section className="bg-black py-24 px-4 overflow-hidden" id="featured">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="text-4xl md:text-7xl font-display font-black text-white uppercase tracking-tighter"
          >
            Featured<br /><span className="text-secondary">Projects</span>
          </motion.h2>
          
          <div className="hidden md:flex gap-4 mb-4">
            <button 
              onClick={prevProject}
              className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={nextProject}
              className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        <div className="relative min-h-[500px] md:min-h-[600px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -100 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16 items-center"
            >
              {/* Image Side */}
              <div className="lg:col-span-7 group cursor-pointer" onClick={() => onViewProject(current)}>
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl md:rounded-[40px] shadow-2xl">
                  {current.thumbnailUrl && (
                    <motion.img 
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      src={current.thumbnailUrl} 
                      alt={current.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                  {!current.thumbnailUrl && (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      <span className="font-mono text-[10px] text-secondary">No Preview</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-500" />
                  
                  {/* Overlay Play Button Concept */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center scale-75 group-hover:scale-100 transition-transform">
                      <ExternalLink size={32} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Details Side */}
              <div className="lg:col-span-5 space-y-6 md:space-y-8">
                <div className="space-y-2">
                  <span className="font-mono text-[10px] md:text-xs uppercase tracking-[0.3em] text-[#00ffa3]">
                    {current.category}
                  </span>
                  <h3 className="text-4xl md:text-6xl font-display font-bold text-white leading-none">
                    {current.title}
                  </h3>
                </div>

                <p className="text-secondary text-sm md:text-lg leading-relaxed font-light line-clamp-3 md:line-clamp-none">
                  {current.description}
                </p>

                <div className="flex flex-wrap gap-2 md:gap-3">
                  {current.technologies?.map(tech => (
                    <span key={tech} className="px-3 py-1 md:px-4 md:py-2 bg-white/5 border border-white/10 rounded-full text-[9px] md:text-[10px] font-mono text-white uppercase tracking-widest">
                      {tech}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <button 
                    onClick={() => onViewProject(current)}
                    className="group bg-white text-black px-8 py-4 rounded-full text-xs font-mono uppercase tracking-widest font-bold flex items-center gap-3 hover:bg-[#00ffa3] transition-all"
                  >
                    View Project <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </button>
                  
                  <div className="flex gap-2">
                    {current.githubUrl && (
                      <a 
                        href={current.githubUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                        title="GitHub Repository"
                      >
                        <Github size={20} />
                      </a>
                    )}
                    {current.showOpenInNewTab !== false && (
                      <a 
                        href={current.liveUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                        title="Live Site"
                      >
                        <ExternalLink size={20} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Indicators and Counter */}
        <div className="mt-12 md:mt-24 flex items-center gap-8">
          <div className="flex gap-2">
            {featured.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > index ? 1 : -1);
                  setIndex(i);
                }}
                className={`h-1 transition-all duration-500 rounded-full ${i === index ? 'w-12 bg-white' : 'w-4 bg-white/20'}`}
              />
            ))}
          </div>
          <div className="font-mono text-xs text-secondary tracking-widest">
            <span className="text-white">{(index + 1).toString().padStart(2, '0')}</span> / {featured.length.toString().padStart(2, '0')}
          </div>
        </div>
      </div>
    </section>
  );
}
