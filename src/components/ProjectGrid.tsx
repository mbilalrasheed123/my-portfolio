import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Github, ExternalLink, ArrowUpRight, Filter, X } from "lucide-react";

interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  technologies: string[];
  thumbnailUrl: string;
  liveUrl: string;
  githubUrl?: string;
  featured: boolean;
  order: number;
}

interface ProjectGridProps {
  projects: Project[];
  onViewProject: (project: Project) => void;
}

export default function ProjectGrid({ projects, onViewProject }: ProjectGridProps) {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeTech, setActiveTech] = useState<string>("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Get unique categories and technologies
  const categories = useMemo(() => {
    const cats = new Set(projects.map(p => p.category).filter(Boolean));
    return ["All", ...Array.from(cats)].sort();
  }, [projects]);

  const allTechnologies = useMemo(() => {
    const techs = new Set<string>();
    projects.forEach(p => {
      if (p.technologies) {
        p.technologies.forEach(t => techs.add(t));
      }
    });
    return ["All", ...Array.from(techs)].sort();
  }, [projects]);

  // Sort and Filter projects
  const filteredProjects = useMemo(() => {
    return projects
      .filter(p => {
        const catMatch = activeCategory === "All" || p.category === activeCategory;
        const techMatch = activeTech === "All" || (p.technologies && p.technologies.includes(activeTech));
        return catMatch && techMatch;
      })
      .sort((a, b) => {
        // Featured stay at top regardless of alphabetical order if we want, 
        // but often filters look better if they just follow the order
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return (a.order || 0) - (b.order || 0);
      });
  }, [projects, activeCategory, activeTech]);

  return (
    <section className="bg-black py-24 px-4" id="all-projects">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div className="space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#00ffa3]">Explore Everything</span>
            <h2 className="text-4xl md:text-6xl font-display font-medium text-white uppercase tracking-tight">
              All Projects
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-secondary text-sm max-w-sm font-light">
              A comprehensive list of works ranging from full-stack applications to small experimental prototypes.
            </p>
            
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 self-start md:self-end px-4 py-2 border rounded-full font-mono text-[10px] uppercase tracking-wider transition-all ${
                isFilterOpen || activeCategory !== "All" || activeTech !== "All"
                ? "border-[#00ffa3] text-[#00ffa3] bg-[#00ffa3]/5"
                : "border-white/10 text-secondary hover:border-white/30"
              }`}
            >
              <Filter size={14} />
              Filter Projects
              {(activeCategory !== "All" || activeTech !== "All") && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#00ffa3] text-black text-[8px] font-bold">
                  !
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-12"
            >
              <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-8 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-white/40 tracking-widest">By Category</span>
                    {activeCategory !== "All" && (
                      <button onClick={() => setActiveCategory("All")} className="text-[10px] text-white/20 hover:text-white flex items-center gap-1">
                        <X size={10} /> Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all border ${
                          activeCategory === cat
                          ? "bg-[#00ffa3] border-[#00ffa3] text-black"
                          : "bg-white/5 border-white/5 text-secondary hover:border-white/20"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-white/40 tracking-widest">By Technology</span>
                    {activeTech !== "All" && (
                      <button onClick={() => setActiveTech("All")} className="text-[10px] text-white/20 hover:text-white flex items-center gap-1">
                        <X size={10} /> Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allTechnologies.map(tech => (
                      <button
                        key={tech}
                        onClick={() => setActiveTech(tech)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all border ${
                          activeTech === tech
                          ? "bg-white text-black border-white"
                          : "bg-white/5 border-white/5 text-secondary hover:border-white/20"
                        }`}
                      >
                        {tech}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((project, i) => (
                <motion.div
                  layout
                  key={project.id}
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ 
                    duration: 0.6, 
                    delay: (i % 3) * 0.1,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                  className="group"
                >
                  <div 
                    className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden h-full flex flex-col hover:border-[#00ffa3]/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer"
                    onClick={() => onViewProject(project)}
                  >
                    {/* Image Wrap */}
                    <div className="relative aspect-video overflow-hidden bg-white/5">
                      {project.thumbnailUrl ? (
                        <img 
                          src={project.thumbnailUrl} 
                          alt={project.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="font-mono text-[10px] text-secondary">No Preview</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                      
                      {/* Category Tag Overlay */}
                      <span className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md border border-white/10 rounded-full text-[8px] font-mono text-white tracking-widest uppercase">
                        {project.category || "General"}
                      </span>
                      
                      {project.featured && (
                        <span className="absolute top-4 right-4 bg-[#00ffa3] text-black px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tight">
                          Featured
                        </span>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                          <ArrowUpRight size={20} />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 flex-1 flex flex-col">
                      <h3 className="text-xl font-display font-medium text-white mb-3 group-hover:text-[#00ffa3] transition-colors uppercase tracking-tight">
                        {project.title}
                      </h3>
                      <p className="text-secondary text-[10px] leading-relaxed line-clamp-2 mb-6 font-light uppercase tracking-wide opacity-60">
                        {project.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-8">
                        {project.technologies?.slice(0, 4).map(tech => (
                          <span key={tech} className="text-[7px] font-mono text-white/40 uppercase tracking-wider px-2 py-1 bg-white/5 border border-white/5 rounded">
                            {tech}
                          </span>
                        ))}
                        {project.technologies?.length > 4 && (
                          <span className="text-[7px] font-mono text-white/20 uppercase tracking-wider px-2 py-1">
                            +{project.technologies.length - 4} More
                          </span>
                        )}
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-6 border-t border-white/5">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewProject(project);
                          }}
                          className="text-[9px] font-mono uppercase tracking-[0.2em] text-white hover:text-[#00ffa3] transition-colors flex items-center gap-1.5"
                        >
                          View Project <ExternalLink size={10} />
                        </button>
                        
                        {project.githubUrl && (
                          <a 
                            href={project.githubUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-white/40 hover:text-white transition-colors"
                          >
                            <Github size={16} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="py-24 text-center border border-dashed border-white/10 rounded-3xl">
            <span className="font-mono text-xs text-secondary uppercase tracking-widest">No projects match the selected filters.</span>
          </div>
        )}
      </div>
    </section>
  );
}
