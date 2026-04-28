import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import FeaturedProjects from "./FeaturedProjects";
import ProjectGrid from "./ProjectGrid";
import ProjectPreviewModal from "./ProjectPreviewModal";

interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  technologies: string[];
  thumbnailUrl: string;
  liveUrl: string;
  githubUrl?: string;
  showInIframe: boolean;
  featured: boolean;
  order: number;
}

interface ProjectProps {
  userId?: string;
}

export default function Projects({ userId }: ProjectProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, [userId]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchProjects(userId);
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewProject = (project: Project) => {
    if (project.showInIframe) {
      setSelectedProject(project);
      setIsModalOpen(true);
    } else {
      window.open(project.liveUrl, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 bg-black flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-white/10 border-t-[#00ffa3] rounded-full animate-spin" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-secondary">Decrypting Repository...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <div id="projects-showcase">
      {/* 1. Featured Carousel (Hero Section for Projects) */}
      <FeaturedProjects 
        projects={projects.filter(p => p.featured)} 
        onViewProject={handleViewProject} 
      />

      {/* 2. All Projects Grid */}
      <ProjectGrid 
        projects={projects} 
        onViewProject={handleViewProject} 
      />

      {/* 3. Global Preview Modal */}
      <ProjectPreviewModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        project={selectedProject}
      />
    </div>
  );
}
