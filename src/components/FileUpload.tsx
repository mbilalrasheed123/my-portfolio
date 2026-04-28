/// <reference types="vite/client" />
import React, { useState, useRef } from "react";
import { Upload, Clock, Image as ImageIcon, CheckCircle, AlertCircle } from "lucide-react";

interface FileUploadProps {
  onUpload: (urls: string[]) => void;
  folder?: string;
  multiple?: boolean;
  accept?: string;
  label?: string;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onUpload, 
  folder = "portfolio", 
  multiple = false,
  accept = "image/*",
  label,
  className = ""
}) => {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      console.error("Cloudinary config missing:", { cloudName, uploadPreset });
      setStatus("error");
      setErrorMsg("Cloudinary (Cloud Name or Preset) not configured in .env");
      return;
    }

    setStatus("uploading");
    setUploading(true);
    setErrorMsg("");
    const urls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);
        formData.append("folder", folder);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Cloudinary upload failed");
        }

        const data = await response.json();
        urls.push(data.secure_url);
      }
      
      onUpload(urls);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (error: any) {
      console.error("Cloudinary upload failed:", error);
      setStatus("error");
      setErrorMsg(error.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        ref={fileInputRef}
      />
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-2 px-4 py-2 bg-white/5 border border-line rounded-lg hover:bg-white/10 transition-all disabled:opacity-50 group ${status === 'error' ? 'border-red-500/50' : status === 'success' ? 'border-green-500/50' : ''}`}
        >
          {status === 'uploading' ? (
            <Clock className="animate-spin text-accent" size={16} />
          ) : status === 'success' ? (
            <CheckCircle className="text-green-500" size={16} />
          ) : status === 'error' ? (
            <AlertCircle className="text-red-500" size={16} />
          ) : (
            <Upload className="text-secondary group-hover:text-white transition-colors" size={16} />
          )}
          
          <span className="font-mono text-[10px] uppercase tracking-widest text-secondary group-hover:text-white transition-colors">
            {status === 'uploading' ? "Uploading..." : label || (multiple ? "Upload Images" : "Upload Image")}
          </span>
        </button>
        
        {status === 'error' && (
          <p className="text-[8px] font-mono text-red-500 uppercase tracking-tighter">{errorMsg}</p>
        )}
      </div>
    </div>
  );
};
