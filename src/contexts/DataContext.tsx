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
  const [projects, setProjects] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [experience, setExperience] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    // Only set loading true if we don't have settings yet (to avoid flicker on manual refresh if needed)
    // But since the requirement is to show fresh data after fetch, we set it true.
    setLoading(true);
    setError(null);
    try {
      console.log(`[DataProvider] Fetching data for userId: ${userId || 'global'}`);
      
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
      
      console.log(`[DataProvider] Data loaded successfully for ${userId || 'global'}`);
    } catch (err: any) {
      console.error("[DataProvider] Failed to fetch shared data:", err);
      setError(err.message || "Failed to load portfolio data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
