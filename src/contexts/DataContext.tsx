import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

interface DataContextType {
  projects: any[];
  settings: any;
  skills: any[];
  certificates: any[];
  experience: any[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children, userId }: { children: React.ReactNode, userId?: string }) {
  const idKey = userId || "global";

  const [projects, setProjects] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem(`cache_projects_${idKey}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [settings, setSettings] = useState<any>(() => {
    try {
      const cached = localStorage.getItem(`cache_settings_${idKey}`);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [skills, setSkills] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem(`cache_skills_${idKey}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [certificates, setCertificates] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem(`cache_certificates_${idKey}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [experience, setExperience] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem(`cache_experience_${idKey}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setError(null);
    const currentIdKey = userId || "global";
    try {
      console.log(`[DataProvider] Fetching data for userId: ${currentIdKey}`);
      
      const [p, s, sk, c, e] = await Promise.all([
        api.fetchProjects(userId),
        api.fetchSettings(userId),
        api.fetchSkills(userId),
        api.fetchCertificates(userId),
        api.fetchExperience(userId)
      ]);
      
      setProjects(p);
      setSettings(s);
      setSkills(sk);
      setCertificates(c);
      setExperience(e);
      
      try {
        localStorage.setItem(`cache_projects_${currentIdKey}`, JSON.stringify(p));
        localStorage.setItem(`cache_settings_${currentIdKey}`, JSON.stringify(s));
        localStorage.setItem(`cache_skills_${currentIdKey}`, JSON.stringify(sk));
        localStorage.setItem(`cache_certificates_${currentIdKey}`, JSON.stringify(c));
        localStorage.setItem(`cache_experience_${currentIdKey}`, JSON.stringify(e));
      } catch (cacheErr) {
        console.warn("[DataProvider] Local cache write failed:", cacheErr);
      }

      console.log(`[DataProvider] Data loaded successfully for ${currentIdKey}`);
    } catch (err: any) {
      console.error("[DataProvider] Failed to fetch shared data:", err);
      // Only show error screen if we don't even have cached settings
      if (!localStorage.getItem(`cache_settings_${currentIdKey}`)) {
        setError(err.message || "Failed to load portfolio data.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentIdKey = userId || "global";
    setLoading(true); // Always start loading as true for fresh fetches
    try {
      const cachedP = localStorage.getItem(`cache_projects_${currentIdKey}`);
      const cachedS = localStorage.getItem(`cache_settings_${currentIdKey}`);
      const cachedSk = localStorage.getItem(`cache_skills_${currentIdKey}`);
      const cachedC = localStorage.getItem(`cache_certificates_${currentIdKey}`);
      const cachedE = localStorage.getItem(`cache_experience_${currentIdKey}`);

      setProjects(cachedP ? JSON.parse(cachedP) : []);
      setSettings(cachedS ? JSON.parse(cachedS) : null);
      setSkills(cachedSk ? JSON.parse(cachedSk) : []);
      setCertificates(cachedC ? JSON.parse(cachedC) : []);
      setExperience(cachedE ? JSON.parse(cachedE) : []);
    } catch (e) {
      setProjects([]);
      setSettings(null);
      setSkills([]);
      setCertificates([]);
      setExperience([]);
    }

    fetchData();
  }, [userId]);

  return (
    <DataContext.Provider value={{
      projects,
      settings,
      skills,
      certificates,
      experience,
      loading,
      error,
      refreshData: fetchData
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
