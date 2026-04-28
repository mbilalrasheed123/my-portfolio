import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Save, X, Upload, Image as ImageIcon, ExternalLink, Github, Monitor, Star, Layers, Loader2, GripVertical } from "lucide-react";
import { api } from "../lib/api";
import { FileUpload } from "./FileUpload";

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
  showOpenInNewTab: boolean;
  featured: boolean;
  order: number;
}

interface ProjectManagerProps {
  userId: string;
}

export default function AdminProjectManager({ userId }: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Project>>({
    technologies: [],
    showInIframe: true,
    showOpenInNewTab: true,
    featured: false,
    order: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProjects();
  }, [userId]);

  const fetchProjects = async () => {
    if (!userId) return;
    setIsLoading(true);
    const data = await api.fetchProjects(userId);
    setProjects(data);
    setIsLoading(false);
  };

  const handleEdit = (project: Project) => {
    setFormData(project);
    setIsEditing(project.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddNew = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      technologies: [],
      thumbnailUrl: "",
      liveUrl: "",
      githubUrl: "",
      showInIframe: true,
      showOpenInNewTab: true,
      featured: false,
      order: projects.length
    });
    setIsEditing("new");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Handled by FileUpload component
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.saveProject(formData, userId);
      setIsEditing(null);
      setFormData({});
      fetchProjects();
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this project and its thumbnail?")) {
      await api.deleteProject(id);
      fetchProjects();
    }
  };

  const handleTechAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = e.currentTarget.value.trim();
      if (val && !formData.technologies?.includes(val)) {
        setFormData({
          ...formData,
          technologies: [...(formData.technologies || []), val]
        });
        e.currentTarget.value = "";
      }
    }
  };

  const removeTech = (tech: string) => {
    setFormData({
      ...formData,
      technologies: formData.technologies?.filter(t => t !== tech)
    });
  };

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-3xl font-display uppercase tracking-tight">Project Management</h2>
          <p className="text-secondary text-xs font-mono uppercase opacity-50">Manage your portfolio showcase and interactive previews</p>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-[#00ffa3] text-black px-6 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <Plus size={14} /> Add New Project
        </button>
      </div>

      {isEditing && (
        <div className="glass p-8 rounded-3xl border-[#00ffa3]/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#00ffa3]" />
          
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-display uppercase">
              {isEditing === "new" ? "Create New Project" : `Edit Project: ${formData.title}`}
            </h3>
            <button onClick={() => setIsEditing(null)} className="text-secondary hover:text-white">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase text-secondary">Project Title</label>
                <input
                  required
                  placeholder="e.g. Desert Expedition App"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#00ffa3] transition-colors"
                  value={formData.title || ""}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase text-secondary">Description</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Tell the story of how you built this..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#00ffa3] transition-colors resize-none"
                  value={formData.description || ""}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Category</label>
                  <input
                    required
                    placeholder="Full Stack Development"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#00ffa3]"
                    value={formData.category || ""}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-secondary">Display Order</label>
                  <input
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#00ffa3]"
                    value={formData.order || 0}
                    onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase text-secondary">Technologies (Press Enter to add)</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 min-h-[50px] flex flex-wrap gap-2 focus-within:border-[#00ffa3] transition-colors">
                  {formData.technologies?.map(tech => (
                    <span key={tech} className="bg-white/10 px-2 py-1 rounded text-[10px] flex items-center gap-1">
                      {tech} <button type="button" onClick={() => removeTech(tech)}><X size={12} /></button>
                    </span>
                  ))}
                  <input
                    placeholder="e.g. Next.js"
                    className="flex-1 bg-transparent border-none outline-none text-sm min-w-[100px]"
                    onKeyDown={handleTechAdd}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase text-secondary">Live Project URL</label>
                <div className="relative">
                  <input
                    required
                    type="url"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#00ffa3] pr-12"
                    value={formData.liveUrl || ""}
                    onChange={e => setFormData({ ...formData, liveUrl: e.target.value })}
                  />
                  <Monitor className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase text-secondary">GitHub URL (Optional)</label>
                <div className="relative">
                  <input
                    type="url"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#00ffa3] pr-12"
                    value={formData.githubUrl || ""}
                    onChange={e => setFormData({ ...formData, githubUrl: e.target.value })}
                  />
                  <Github className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={formData.featured || false}
                    onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-[#00ffa3] focus:ring-[#00ffa3]"
                  />
                  <label htmlFor="featured" className="font-mono text-[10px] uppercase text-white cursor-pointer flex items-center gap-2">
                    <Star size={14} className={formData.featured ? "text-yellow-400 fill-yellow-400" : ""} /> Featured Project (Show in Hero Carousel)
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="iframe"
                    checked={formData.showInIframe || false}
                    onChange={e => setFormData({ ...formData, showInIframe: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-[#00ffa3] focus:ring-[#00ffa3]"
                  />
                  <label htmlFor="iframe" className="font-mono text-[10px] uppercase text-white cursor-pointer flex items-center gap-2">
                    <Layers size={14} /> Enable Interactive Iframe Preview
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="openInNewTab"
                    checked={formData.showOpenInNewTab ?? true}
                    onChange={e => setFormData({ ...formData, showOpenInNewTab: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-[#00ffa3] focus:ring-[#00ffa3]"
                  />
                  <label htmlFor="openInNewTab" className="font-mono text-[10px] uppercase text-white cursor-pointer flex items-center gap-2">
                    <ExternalLink size={14} /> Show "Open in New Tab" Button
                  </label>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <label className="font-mono text-[10px] uppercase text-secondary">Thumbnail Image</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="relative group aspect-video bg-white/5 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center overflow-hidden hover:border-[#00ffa3]/50 transition-colors">
                    {formData.thumbnailUrl ? (
                      <div className="relative w-full h-full">
                        <img src={formData.thumbnailUrl} className="w-full h-full object-cover" alt="Preview" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button" 
                            onClick={() => setFormData({ ...formData, thumbnailUrl: "" })}
                            className="p-3 bg-red-500 text-white rounded-full hover:bg-red-400 transition-colors"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 p-8">
                        <ImageIcon className="text-secondary/20" size={32} />
                        <span className="font-mono text-[8px] uppercase text-secondary">No Preview</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <FileUpload 
                      folder="projects"
                      onUpload={(urls) => setFormData({ ...formData, thumbnailUrl: urls[0] })}
                      label="Upload & Auto-Compress"
                    />
                    <div className="space-y-2">
                       <label className="font-mono text-[8px] uppercase text-secondary">Or use direct image URL</label>
                       <input
                        placeholder="https://example.com/image.jpg"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-[10px] outline-none focus:border-[#00ffa3]"
                        value={formData.thumbnailUrl || ""}
                        onChange={e => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                      />
                    </div>
                    <ul className="text-[7px] font-mono text-secondary/60 uppercase space-y-1">
                      <li>• Maximum size: 200KB</li>
                      <li>• Recommended ratio: 16:10</li>
                      <li>• Formats: JPG, PNG, WEBP</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 pt-10 border-t border-white/5 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setIsEditing(null)}
                className="px-8 py-3 border border-white/10 rounded-full font-mono text-[10px] uppercase tracking-widest hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-10 py-3 bg-white text-black rounded-full font-mono text-[10px] uppercase tracking-widest font-bold hover:bg-[#00ffa3] disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isEditing === "new" ? "Create Project" : "Update Project"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Projects Table */}
      <div className="glass rounded-[32px] border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h3 className="font-display uppercase tracking-widest text-sm flex items-center gap-2">
            <Layers size={16} className="text-[#00ffa3]" /> 
            Active Repository ({projects.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 font-mono text-[10px] uppercase text-white/30 tracking-[0.2em] bg-black/20">
                <th className="px-6 py-4 font-normal">#</th>
                <th className="px-6 py-4 font-normal">Preview</th>
                <th className="px-6 py-4 font-normal">Details</th>
                <th className="px-6 py-4 font-normal">Stack</th>
                <th className="px-6 py-4 font-normal">Status</th>
                <th className="px-6 py-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[...projects].sort((a,b) => a.order - b.order).map((project, idx) => (
                <tr key={project.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4 text-secondary font-mono text-[10px]">{idx + 1}</td>
                  <td className="px-6 py-4">
                    <div className="w-32 aspect-video rounded-xl bg-white/5 overflow-hidden border border-white/10 group-hover:border-[#00ffa3]/30 transition-colors relative">
                      {project.thumbnailUrl ? (
                        <img src={project.thumbnailUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-mono text-secondary uppercase">No Image</div>
                      )}
                      {project.featured && (
                        <div className="absolute top-1 right-1">
                          <Star size={10} className="text-[#00ffa3] fill-[#00ffa3]" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-white text-sm mb-1">{project.title}</div>
                    <div className="text-[9px] font-mono uppercase text-secondary tracking-widest">{project.category}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {project.technologies?.slice(0, 3).map(tech => (
                        <span key={tech} className="px-1.5 py-0.5 bg-white/5 rounded text-[8px] text-white/40 uppercase font-mono">
                          {tech}
                        </span>
                      ))}
                      {project.technologies?.length > 3 && (
                        <span className="text-[8px] text-white/20 uppercase font-mono">+{project.technologies.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      {project.showInIframe && (
                        <span className="text-[8px] font-mono text-[#00ffa3] uppercase tracking-tighter flex items-center gap-1">
                          <Monitor size={10} /> Iframe Ready
                        </span>
                      )}
                      {project.showOpenInNewTab !== false && (
                        <span className="text-[8px] font-mono text-blue-400 uppercase tracking-tighter flex items-center gap-1">
                          <ExternalLink size={10} /> Link Enabled
                        </span>
                      )}
                      {project.featured && (
                        <span className="text-[8px] font-mono text-yellow-400 uppercase tracking-tighter flex items-center gap-1">
                          <Star size={10} /> Hero Showcase
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       <a 
                          href={project.liveUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 text-secondary hover:text-[#00ffa3] transition-colors"
                          title="Visit Site"
                        >
                          <ExternalLink size={16} />
                        </a>
                      <button 
                        onClick={() => handleEdit(project)}
                        className="p-2 text-secondary hover:text-white transition-colors"
                        title="Edit Project"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(project.id)}
                        className="p-2 text-secondary hover:text-red-500 transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {projects.length === 0 && !isLoading && (
            <div className="text-center py-20">
              <span className="font-mono text-xs text-secondary/30 uppercase tracking-widest">No Projects Found In Repository</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
