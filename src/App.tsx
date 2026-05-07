/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter as Router, Routes, Route, useParams } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ParticleHero from "./components/ui/particle-effect-for-hero";
import AetherFlowHero from "./components/ui/aether-flow-hero";
import SplineHero from "./components/ui/spline-hero";
import About from "./components/About";
import Skills from "./components/Skills";
import Projects from "./components/Projects";
import Contact from "./components/Contact";
import Admin from "./components/Admin";
import UserQueries from "./components/UserQueries";
import Settings from "./components/Settings";
import Certificates from "./components/Certificates";
import Chatbot from "./components/Chatbot";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DataProvider, useData } from "./contexts/DataContext";
import LoadingSpinner from "./components/LoadingSpinner";
import AnalyticsDispatcher from "./components/AnalyticsDispatcher";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import CookieBanner from "./components/CookieBanner";

function PortfolioContent({ userId }: { userId?: string }) {
  const { loading, error, settings } = useData();
  const [activeHeroStyle, setActiveHeroStyle] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!settings) return;

    const determineHeroStyle = () => {
      // 1. Check for mobile lock
      const isMobile = window.innerWidth < 768;
      if (isMobile && settings.mobileHeroStyle && settings.mobileHeroStyle !== 'sameAsDesktop') {
        return settings.mobileHeroStyle;
      }

      // 2. Check for design loop
      if (settings.heroDesignLoop) {
        const styles = ['default', 'particles', 'aether', 'spline'];
        // We want it to be random but stable for this session (page refresh)
        // Using Math.random() once on mount/settings load is enough for "every page refresh"
        const randomIndex = Math.floor(Math.random() * styles.length);
        return styles[randomIndex];
      }

      // 3. Fallback to manual selection
      return settings.heroStyle || 'default';
    };

    setActiveHeroStyle(determineHeroStyle());
  }, [settings]);

  if (loading || !activeHeroStyle) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-display uppercase mb-4 text-red-500">Error Loading Portfolio</h1>
        <p className="text-secondary font-mono text-sm max-w-md">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-8 py-3 bg-white text-black rounded-full font-mono text-xs uppercase tracking-widest hover:bg-accent hover:text-white transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  const isParticleHero = activeHeroStyle === 'particles';
  const isAetherHero = activeHeroStyle === 'aether';
  const isSplineHero = activeHeroStyle === 'spline';

  return (
    <div className="min-h-screen selection:bg-accent/30 bg-black text-white">
      <Navbar userId={userId} />
      <main>
        {isSplineHero ? (
          <SplineHero title={settings.name} subtitle={settings.subtitle} type={settings.title} />
        ) : isAetherHero ? (
          <AetherFlowHero title={settings.name} subtitle={settings.subtitle} type={settings.title} />
        ) : isParticleHero ? (
          <ParticleHero title={settings.name} subtitle={settings.subtitle} type={settings.title} />
        ) : (
          <Hero userId={userId} />
        )}
        <About userId={userId} />
        <Skills userId={userId} />
        <Projects userId={userId} />
        <Certificates userId={userId} />
        <Contact userId={userId} />
      </main>
      <Chatbot userId={userId} />
      <footer className="py-12 border-t border-line text-center">
        <div className="container mx-auto px-6">
          <p className="text-secondary text-xs font-mono uppercase tracking-widest">
            © {new Date().getFullYear()} Precision Portfolio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Portfolio() {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuth();
  
  // If no userId in URL, use the logged-in user's ID.
  const targetUserId = userId || user?.uid || undefined; 

  if (authLoading) return <LoadingSpinner />;

  return (
    <DataProvider userId={targetUserId}>
      <PortfolioContent userId={targetUserId} />
    </DataProvider>
  );
}

function AdminRoute() {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  
  // If not logged in, Admin component shows Auth UI
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <Admin />
      </div>
    );
  }

  return (
    <DataProvider userId={user.uid}>
      <div className="min-h-screen bg-black text-white">
        <Navbar userId={user.uid} />
        <div className="pt-24 pb-12">
          <Admin />
        </div>
      </div>
    </DataProvider>
  );
}

function MultiUserPageWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  
  return (
    <DataProvider userId={user?.uid}>
      {children}
    </DataProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AnalyticsDispatcher />
          <Routes>
            <Route path="/" element={<Portfolio />} />
            <Route path="/u/:userId" element={<Portfolio />} />
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="/queries" element={
              <MultiUserPageWrapper>
                <div className="min-h-screen bg-black text-white pt-24">
                  <Navbar />
                  <UserQueries />
                </div>
              </MultiUserPageWrapper>
            } />
            <Route path="/settings" element={
              <MultiUserPageWrapper>
                <div className="min-h-screen bg-black text-white pt-24">
                  <Navbar />
                  <Settings />
                </div>
              </MultiUserPageWrapper>
            } />
            <Route path="/admin/analytics" element={
              <MultiUserPageWrapper>
                <AnalyticsDashboard />
              </MultiUserPageWrapper>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
