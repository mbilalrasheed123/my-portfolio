/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, useParams } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import About from "./components/About";
import Skills from "./components/Skills";
import Projects from "./components/Projects";
import Contact from "./components/Contact";
import Admin from "./components/Admin";
import UserQueries from "./components/UserQueries";
import Settings from "./components/Settings";
import Certificates from "./components/Certificates";
import Chatbot from "./components/Chatbot";

import { DataProvider, useData } from "./contexts/DataContext";
import LoadingSpinner from "./components/LoadingSpinner";

function PortfolioContent({ userId }: { userId?: string }) {
  const { loading, error } = useData();

  if (loading) {
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

  return (
    <div className="min-h-screen selection:bg-accent/30 bg-black text-white">
      <Navbar userId={userId} />
      <main>
        <Hero userId={userId} />
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
  const targetUserId = userId || undefined; 

  return (
    <DataProvider userId={targetUserId}>
      <PortfolioContent userId={targetUserId} />
    </DataProvider>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      {children}
    </DataProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Portfolio />} />
          <Route path="/u/:userId" element={<Portfolio />} />
          <Route path="/admin" element={
            <PageWrapper>
              <div className="min-h-screen bg-black text-white">
                <Navbar />
                <div className="pt-24 pb-12">
                  <Admin />
                </div>
              </div>
            </PageWrapper>
          } />
          <Route path="/queries" element={
            <PageWrapper>
              <div className="min-h-screen bg-black text-white pt-24">
                <Navbar />
                <UserQueries />
              </div>
            </PageWrapper>
          } />
          <Route path="/settings" element={
            <PageWrapper>
              <div className="min-h-screen bg-black text-white pt-24">
                <Navbar />
                <Settings />
              </div>
            </PageWrapper>
          } />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
