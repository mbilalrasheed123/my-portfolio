/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, useParams } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import About from "./components/About";
import Skills from "./components/Skills";
import Projects from "./components/Projects";
import Contact from "./components/Contact";
import Chatbot from "./components/Chatbot";
import Certificates from "./components/Certificates";
import Testimonials from "./components/Testimonials";

// Lazy load large/library-heavy graphic heros
const ParticleHero = lazy(() => import("./components/ui/particle-effect-for-hero"));
const AetherFlowHero = lazy(() => import("./components/ui/aether-flow-hero"));
const SplineHero = lazy(() => import("./components/ui/spline-hero"));
const BackgroundBoxesHero = lazy(() => import("./components/ui/background-boxes-hero"));

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
          : ['default', 'particles', 'aether', 'spline', 'boxes'];
        
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

  // Scroll Reveal Observer
  React.useEffect(() => {
    if (loading || !activeHeroStyle) return;

    // Use a small delay to make sure DOM is fully printed
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll(
        '.reveal, .reveal-left, .reveal-right, .reveal-scale, .heading-wrapper'
      );

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
            }
          });
        },
        {
          threshold: 0.1,
          rootMargin: '0px 0px -50px 0px'
        }
      );

      elements.forEach((el) => observer.observe(el));

      return () => {
        elements.forEach((el) => observer.unobserve(el));
      };
    }, 400);

    return () => clearTimeout(timer);
  }, [loading, activeHeroStyle, settings]);

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
          <Suspense fallback={HeroFallback}>
            <SplineHero title={settings.name} subtitle={settings.subtitle} type={settings.title} />
          </Suspense>
        ) : isAetherHero ? (
          <Suspense fallback={HeroFallback}>
            <AetherFlowHero title={settings.name} subtitle={settings.subtitle} type={settings.title} />
          </Suspense>
        ) : isParticleHero ? (
          <Suspense fallback={HeroFallback}>
            <ParticleHero title={settings.name} subtitle={settings.subtitle} type={settings.title} />
          </Suspense>
        ) : isBoxesHero ? (
          <Suspense fallback={HeroFallback}>
            <BackgroundBoxesHero title={settings.name} subtitle={settings.subtitle} type={settings.title} />
          </Suspense>
        ) : (
          <Hero userId={userId} />
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
