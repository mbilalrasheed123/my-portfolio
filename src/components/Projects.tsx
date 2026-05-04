import React, { useState } from "react";
import { useData } from "../contexts/DataContext";
import FeaturedProjects from "./FeaturedProjects";
import ProjectGrid from "./ProjectGrid";
import ProjectPreviewModal from "./ProjectPreviewModal";
import { useSectionTracking } from "../hooks/useSectionTracking";
import { trackClick } from "../lib/analytics";

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
  const sectionRef = useSectionTracking("projects");

  const handleViewProject = (project: Project) => {
    trackClick('view-project', { projectId: project.id, projectTitle: project.title, method: project.showInIframe ? 'iframe' : 'external' });
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
    <div id="projects" ref={sectionRef}>
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
