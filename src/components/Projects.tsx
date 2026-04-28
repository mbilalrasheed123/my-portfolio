import React, { useState } from "react";
import { useData } from "../contexts/DataContext";
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
  const { projects } = useData();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewProject = (project: Project) => {
    if (project.showInIframe) {
      setSelectedProject(project);
      setIsModalOpen(true);
    } else {
      window.open(project.liveUrl, "_blank");
    }
  };

  if (projects.length === 0) {
    return null;
  }

  return (
    <div id="projects">
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
