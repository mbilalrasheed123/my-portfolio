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
      // 1. Mobile Detection (Robust check)
      const isMobile = window.innerWidth < 1024 || 
                      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // 2. Priority 1: Mobile-Specific Lock
      if (isMobile && settings.mobileHeroStyle && settings.mobileHeroStyle !== 'sameAsDesktop') {
        return settings.mobileHeroStyle;
      }

      // 3. Priority 2: Design Loop (if enabled)
      if (settings.heroDesignLoop) {
        const order = settings.heroLoopOrder && settings.heroLoopOrder.length > 0
          ? settings.heroLoopOrder
          : ['default', 'particles', 'aether', 'spline'];
        
        // Use session storage to keep style consistent for the SESSION
        const sessionKey = `hero_session_style_${userId || 'global'}`;
        let style = sessionStorage.getItem(sessionKey);
        
        if (!style) {
          const storageKey = `hero_loop_index_${userId || 'global'}`;
          const currentIndex = parseInt(localStorage.getItem(storageKey) || '-1');
          const nextIndex = (currentIndex + 1) % order.length;
          
          style = order[nextIndex];
          localStorage.setItem(storageKey, nextIndex.toString());
          sessionStorage.setItem(sessionKey, style);
        }
        
        return style;
      }

      // 4. Priority 3: Manual Desktop Selection
      return settings.heroStyle || 'default';
    };

    const newStyle = determineHeroStyle();
    if (newStyle !== activeHeroStyle) {
      setActiveHeroStyle(newStyle);
    }
  }, [settings, userId, activeHeroStyle]);

  // Handle Resize for Hero stability
  React.useEffect(() => {
    const handleResize = () => {
      // If we're already on a locked mobile hero, don't flicker back and forth too easily 
      // unless it's a major change
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

// The main portfolio ID that everyone sees by default on the landing page
const DEFAULT_PORTFOLIO_ID = "global"; 

function Portfolio() {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuth();
  
  // 1. If we are on a specific user's URL (/u/xyz), use that ID.
  // 2. Otherwise, use DEFAULT_PORTFOLIO_ID so the site shows the main content.
  const targetUserId = userId || DEFAULT_PORTFOLIO_ID; 

  if (authLoading) return <LoadingSpinner />;

  return (
    <DataProvider userId={targetUserId}>
      <PortfolioContent userId={targetUserId} />
    </DataProvider>
  );
}

function AdminRoute() {
  const { user, loading, isAdmin } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  
  // If not logged in, Admin component shows Auth UI
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <Admin />
      </div>
    );
  }

  // The Super Admin edits the "global" site data. 
  // Regular users edit their own unique UID-based data.
  const targetId = isAdmin ? "global" : user.uid;

  return (
    <DataProvider userId={targetId}>
      <div className="min-h-screen bg-black text-white">
        <Navbar userId={targetId} />
        <div className="pt-24 pb-12">
          <Admin />
        </div>
      </div>
    </DataProvider>
  );
}

function MultiUserPageWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  
  const targetId = isAdmin ? "global" : user?.uid;

  return (
    <DataProvider userId={targetId}>
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
