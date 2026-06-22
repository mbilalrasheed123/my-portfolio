/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, useParams, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { auth } from "./firebase";
// Pre-load components that should appear immediately
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Chatbot from "./components/Chatbot";
import VisitorCounter from "./components/VisitorCounter";
import About from "./components/About";
import Skills from "./components/Skills";
import Projects from "./components/Projects";
import Certificates from "./components/Certificates";
import Testimonials from "./components/Testimonials";
import Contact from "./components/Contact";

// Restore standard imports for hero sections to remove lazy loading states
import ParticleHero from "./components/ui/particle-effect-for-hero";
import AetherFlowHero from "./components/ui/aether-flow-hero";
import SplineHero from "./components/ui/spline-hero";
import BackgroundBoxesHero from "./components/ui/background-boxes-hero";

// Lazy load non-landing page elements or optional admin modules
const Admin = lazy(() => import("./components/Admin"));
const UserQueries = lazy(() => import("./components/UserQueries"));
const Settings = lazy(() => import("./components/Settings"));
const AnalyticsDashboard = lazy(() => import("./components/AnalyticsDashboard"));

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DataProvider, useData } from "./contexts/DataContext";
import LoadingSpinner from "./components/LoadingSpinner";
import AnalyticsDispatcher from "./components/AnalyticsDispatcher";
import CookieBanner from "./components/CookieBanner";

function getHeroStyle(settings: any, userId?: string) {
  if (!settings) return "default";

  // 1. Mobile Detection (Robust check)
  const isMobile = typeof window !== "undefined" && (window.innerWidth < 1024 || 
                  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

  // 2. Priority 1: Mobile-Specific Lock
  if (isMobile && settings.mobileHeroStyle && settings.mobileHeroStyle !== "sameAsDesktop") {
    return settings.mobileHeroStyle;
  }

  // 3. Priority 2: Design Loop (if enabled)
  if (settings.heroDesignLoop) {
    const order = settings.heroLoopOrder && settings.heroLoopOrder.length > 0
      ? settings.heroLoopOrder
      : ["default", "particles", "aether", "spline", "boxes"];

    // Use session storage to keep style consistent for the SESSION
    const sessionKey = `hero_session_style_${userId || "global"}`;
    let style = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(sessionKey) : null;

    if (!style) {
      const storageKey = `hero_loop_index_${userId || "global"}`;
      const currentIndex = parseInt((typeof localStorage !== "undefined" && localStorage.getItem(storageKey)) || "-1");
      const nextIndex = (currentIndex + 1) % order.length;

      style = order[nextIndex];
      if (typeof localStorage !== "undefined") localStorage.setItem(storageKey, nextIndex.toString());
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(sessionKey, style);
    }

    return style;
  }

  // 4. Priority 3: Manual Desktop Selection
  return settings.heroStyle || "default";
}

function PortfolioContent({ userId }: { userId?: string }) {
  const { loading, error, settings } = useData();
  const [isAppLoading, setIsAppLoading] = React.useState(true);

  // Use a single initial state check based on the settings context
  const [activeHeroStyle, setActiveHeroStyle] = React.useState<string>(() => {
    return getHeroStyle(settings, userId);
  });

  // Keep activeHeroStyle fully in sync when settings values are retrieved or changed
  React.useEffect(() => {
    if (settings) {
      setActiveHeroStyle(getHeroStyle(settings, userId));
    }
  }, [settings, userId]);

  // Wait for the window 'load' event to ensure all styles, fonts, and assets are parsed
  React.useEffect(() => {
    const handleLoad = () => {
      // Fallback delay to let the browser's main thread paint the background
      setTimeout(() => setIsAppLoading(false), 150);
    };

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad);
      return () => window.removeEventListener("load", handleLoad);
    }
  }, []);

  // Handle Resize for Hero stability
  React.useEffect(() => {
    const handleResize = () => {
      // Keep mobile styles and order stable on small layout adjustments
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Scroll Reveal Observer
  React.useEffect(() => {
    if (loading || !activeHeroStyle || isAppLoading) return;

    // Use a small delay to make sure DOM is fully printed
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll(
        ".reveal, .reveal-left, .reveal-right, .reveal-scale, .heading-wrapper"
      );

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
            }
          });
        },
        {
          threshold: 0.1,
          rootMargin: "0px 0px -50px 0px"
        }
      );

      elements.forEach((el) => observer.observe(el));

      return () => {
        elements.forEach((el) => observer.unobserve(el));
      };
    }, 400);

    return () => clearTimeout(timer);
  }, [loading, activeHeroStyle, settings, isAppLoading]);

  if (loading || !activeHeroStyle || isAppLoading) {
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
  const isBoxesHero = activeHeroStyle === 'boxes';

  const HeroFallback = (
    <div className="h-screen min-h-[600px] w-full bg-black flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

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
        ) : isBoxesHero ? (
          <BackgroundBoxesHero title={settings.name} subtitle={settings.subtitle} type={settings.title} />
        ) : (
          <Hero 
            userId={userId} 
            title={settings?.title} 
            name={settings?.name} 
            subtitle={settings?.subtitle} 
          />
        )}
        <About userId={userId} />
        <Skills userId={userId} />
        <Projects userId={userId} />
        <Certificates userId={userId} />
        <Testimonials />
        <Contact userId={userId} />
      </main>
      <Chatbot userId={userId} />
      <footer className="py-12 border-t border-line text-center">
        <div className="container mx-auto px-6">
          <p className="text-secondary text-xs font-mono uppercase tracking-widest">
            © {new Date().getFullYear()} Precision Portfolio. All rights reserved.
          </p>
          <VisitorCounter userId={userId} />
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

  // Strict Whitelist Check
  if (user && user.email !== "muhammadbilalrasheed78@gmail.com") {
    auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    return <Navigate to="/" replace />;
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
            <Route path="/admin" element={
              <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><LoadingSpinner /></div>}>
                <AdminRoute />
              </Suspense>
            } />
            <Route path="/queries" element={
              <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><LoadingSpinner /></div>}>
                <MultiUserPageWrapper>
                  <div className="min-h-screen bg-black text-white pt-24">
                    <Navbar />
                    <UserQueries />
                  </div>
                </MultiUserPageWrapper>
              </Suspense>
            } />
            <Route path="/settings" element={
              <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><LoadingSpinner /></div>}>
                <MultiUserPageWrapper>
                  <div className="min-h-screen bg-black text-white pt-24">
                    <Navbar />
                    <Settings />
                  </div>
                </MultiUserPageWrapper>
              </Suspense>
            } />
            <Route path="/admin/analytics" element={
              <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><LoadingSpinner /></div>}>
                <MultiUserPageWrapper>
                  <AnalyticsDashboard />
                </MultiUserPageWrapper>
              </Suspense>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
