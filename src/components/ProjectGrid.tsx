import React from "react";
import { motion } from "framer-motion";
import { Github, ExternalLink, ArrowUpRight } from "lucide-react";

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
}

interface ProjectGridProps {
  projects: Project[];
  onViewProject: (project: Project) => void;
}

export default function ProjectGrid({ projects, onViewProject }: ProjectGridProps) {
  // Sort projects: Featured first, then by order
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return (a as any).order - (b as any).order;
  });

  return (
    <section className="bg-black py-24 px-4" id="all-projects">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="space-y-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#00ffa3]">Explore Everything</span>
            <h2 className="text-4xl md:text-6xl font-display font-medium text-white uppercase tracking-tight">
              All Projects
            </h2>
          </div>
          <p className="text-secondary text-sm max-w-sm font-light">
            A comprehensive list of works ranging from full-stack applications to small experimental prototypes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {sortedProjects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i % 3 * 0.1 }}
              className="group"
            >
              <div 
                className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden h-full flex flex-col hover:border-[#00ffa3]/30 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                onClick={() => onViewProject(project)}
              >
                {/* Image Wrap */}
                <div className="relative aspect-video overflow-hidden bg-white/5">
                  {project.thumbnailUrl ? (
                    <img 
                      src={project.thumbnailUrl} 
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-mono text-[10px] text-secondary">No Preview</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                  
                  {/* Category Tag Overlay */}
                  <span className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md border border-white/10 rounded-full text-[8px] font-mono text-white/70 uppercase tracking-widest">
                    {project.category}
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
                  <h3 className="text-xl font-display font-bold text-white mb-3 group-hover:text-[#00ffa3] transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-secondary text-xs leading-relaxed line-clamp-2 mb-6 font-light">
                    {project.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-8">
                    {project.technologies.slice(0, 4).map(tech => (
                      <span key={tech} className="text-[8px] font-mono text-white/40 uppercase tracking-wider px-2 py-1 bg-white/5 rounded">
                        {tech}
                      </span>
                    ))}
                    {project.technologies.length > 4 && (
                      <span className="text-[8px] font-mono text-white/20 uppercase tracking-wider px-2 py-1">
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
                      className="text-[10px] font-mono uppercase tracking-[0.2em] text-white hover:text-[#00ffa3] transition-colors flex items-center gap-1.5"
                    >
                      View Live <ExternalLink size={12} />
                    </button>
                    
                    {project.githubUrl && (
                      <a 
                        href={project.githubUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                        <Github size={18} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
