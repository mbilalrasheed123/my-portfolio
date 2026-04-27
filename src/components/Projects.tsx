import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, ExternalLink, Github } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Reveal } from "./Reveal";

interface Project {
  id: string;
  title: string;
  category: string;
  description: string;
  image?: string;
  images?: string[];
  tags: string[];
  link?: string;
  github?: string;
  order: number;
}

function ProjectImageSlider({ images }: { images: string[] }) {
  const [imgIndex, setImgIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((prev) => (prev + 1) % images.length);
  };

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="relative w-full h-full group/slider">
      <AnimatePresence mode="wait">
        <motion.img
          key={imgIndex}
          src={images[imgIndex]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </AnimatePresence>
      
      {images.length > 1 && (
        <>
          <div className="absolute inset-y-0 left-0 flex items-center px-4 opacity-0 group-hover/slider:opacity-100 transition-opacity">
            <button 
              onClick={prevImg}
              className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center px-4 opacity-0 group-hover/slider:opacity-100 transition-opacity">
            <button 
              onClick={nextImg}
              className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <div 
                key={i} 
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === imgIndex ? 'bg-accent w-4' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const DEFAULT_PROJECTS: Project[] = [
  {
    id: "01",
    title: "E-Commerce Platform",
    category: "Full Stack Development",
    description: "A high-performance e-commerce solution with real-time inventory management and secure payment integration.",
    image: "https://picsum.photos/seed/shop/1200/800",
    tags: ["Next.js", "TypeScript", "Stripe", "PostgreSQL"],
    order: 1
  },
  {
    id: "02",
    title: "WordPress Business Portal",
    category: "WordPress / PHP",
    description: "Custom WordPress theme development for a global logistics firm with complex CMS requirements.",
    image: "https://picsum.photos/seed/wp/1200/800",
    tags: ["WordPress", "PHP", "Tailwind", "ACF"],
    order: 2
  },
  {
    id: "03",
    title: "Collaborative Workspace",
    category: "SaaS / Productivity",
    description: "Real-time collaborative environment for teams to manage tasks, documents, and communications seamlessly.",
    image: "https://picsum.photos/seed/task/1200/800",
    tags: ["React", "Firebase", "WebSockets", "Framer"],
    order: 3
  }
];

export default function Projects() {
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    api.get("projects").then((data) => {
      if (data && data.length > 0) {
        setProjectsList(data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
      } else {
        setProjectsList(DEFAULT_PROJECTS);
      }
    }).catch((error) => {
      console.error("Failed to fetch projects:", error);
      setProjectsList(DEFAULT_PROJECTS);
    });
  }, []);

  const next = () => setCurrentIndex((prev) => (prev + 1) % projectsList.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + projectsList.length) % projectsList.length);

  if (projectsList.length === 0) return null;

  const currentProject = projectsList[currentIndex];

  return (
    <section id="projects" className="py-24 bg-black overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="max-w-xl">
            <Reveal>
              <span className="font-mono text-xs uppercase tracking-widest text-accent mb-4 block">Selected Works</span>
            </Reveal>
            <Reveal width="100%">
              <h2 className="text-5xl md:text-7xl font-display uppercase leading-none">
                Featured<br />Projects
              </h2>
            </Reveal>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={prev}
              className="w-14 h-14 rounded-full border border-line flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-90"
            >
              <ArrowLeft size={24} />
            </button>
            <button 
              onClick={next}
              className="w-14 h-14 rounded-full border border-line flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-90"
            >
              <ArrowRight size={24} />
            </button>
          </div>
        </div>

        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentProject.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                {currentProject.images && currentProject.images.length > 0 ? (
                  <ProjectImageSlider images={currentProject.images} />
                ) : (
                  <img 
                    src={currentProject.image} 
                    alt={currentProject.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute top-6 left-6 glass px-4 py-2 rounded-full text-xs font-mono uppercase tracking-widest">
                  {currentProject.category}
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <span className="text-8xl md:text-[10rem] font-display text-white/5 absolute -top-12 right-0 pointer-events-none">
                  {currentIndex + 1 < 10 ? `0${currentIndex + 1}` : currentIndex + 1}
                </span>
                
                <h3 className="text-4xl md:text-6xl font-display uppercase mb-6 leading-none">
                  {currentProject.title}
                </h3>
                
                <p className="text-secondary text-lg mb-8 max-w-lg font-light leading-relaxed">
                  {currentProject.description}
                </p>

                <div className="flex flex-wrap gap-3 mb-10">
                  {currentProject.tags.map((tag) => (
                    <span key={tag} className="px-4 py-1 rounded-full border border-line text-xs font-mono text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-6">
                  {currentProject.link && (
                    <a href={currentProject.link} className="flex items-center gap-2 text-white font-medium group">
                      View Project <ExternalLink size={18} className="group-hover:translate-x-1 transition-transform" />
                    </a>
                  )}
                  {currentProject.github && (
                    <a href={currentProject.github} className="flex items-center gap-2 text-secondary hover:text-white transition-colors">
                      <Github size={18} /> Source
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress Bar */}
        <div className="mt-20 w-full h-[1px] bg-line relative">
          <motion.div 
            className="absolute top-0 left-0 h-full bg-white"
            initial={false}
            animate={{ width: `${((currentIndex + 1) / projectsList.length) * 100}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </section>
  );
}
