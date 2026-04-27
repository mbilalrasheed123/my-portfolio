/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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

function Portfolio() {
  return (
    <div className="min-h-screen selection:bg-accent/30">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Skills />
        <Projects />
        <Certificates />
        <Contact />
      </main>
      <Chatbot />
      <footer className="py-12 border-t border-line text-center">
        <div className="container mx-auto px-6">
          <p className="text-secondary text-xs font-mono uppercase tracking-widest">
            © {new Date().getFullYear()} Muhammad Bilal Rasheed. Crafted with precision.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Portfolio />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/queries" element={
            <div className="min-h-screen bg-black text-white pt-24">
              <Navbar />
              <UserQueries />
            </div>
          } />
          <Route path="/settings" element={
            <div className="min-h-screen bg-black text-white pt-24">
              <Navbar />
              <Settings />
            </div>
          } />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
