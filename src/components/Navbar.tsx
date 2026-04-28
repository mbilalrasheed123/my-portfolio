import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, User, LogOut, MessageSquare, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { auth, onAuthStateChanged, signOut } from "../firebase";
import { api } from "../lib/api";

const navLinks = [
  { name: "Home", href: "/#home" },
  { name: "About", href: "/#about" },
  { name: "Skills", href: "/#skills" },
  { name: "Projects", href: "/#projects" },
  { name: "Certificates", href: "/#certificates" },
  { name: "Contact", href: "/#contact" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    api.getSettings().then(setSettings);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const isHomePage = location.pathname === "/";

  const brandName = settings.logoText || (settings.name?.split(' ')[0] || "Bilal");

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled || !isHomePage || isMobileMenuOpen ? "bg-black/90 backdrop-blur-2xl py-4 border-b border-line" : "bg-transparent py-8"
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="group flex items-center gap-2">
          {settings.logoType === "image" && settings.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt={settings.logoAlt || "Logo"} 
              className="h-8 md:h-10 w-auto object-contain transition-transform group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-2xl font-display uppercase tracking-tighter">
              {brandName}<span className="text-accent">.</span>
            </span>
          )}
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-16">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-[10px] font-mono uppercase tracking-[0.2em] text-secondary hover:text-white transition-colors relative group"
            >
              {link.name}
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-accent transition-all group-hover:w-full" />
            </a>
          ))}
          {user && (
            <div className="flex items-center gap-8 border-l border-line pl-8">
              <Link
                to="/queries"
                className="text-[10px] font-mono uppercase tracking-[0.2em] text-secondary hover:text-white transition-colors relative group flex items-center gap-2"
              >
                <MessageSquare size={14} />
                Queries
                <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-accent transition-all group-hover:w-full" />
              </Link>
              <Link
                to="/settings"
                className="text-[10px] font-mono uppercase tracking-[0.2em] text-secondary hover:text-white transition-colors relative group flex items-center gap-2"
              >
                <Settings size={14} />
                Settings
                <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-accent transition-all group-hover:w-full" />
              </Link>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-4">
              <Link
                to="/settings"
                className="w-8 h-8 rounded-full overflow-hidden border border-line bg-white/10 flex items-center justify-center hover:border-accent transition-all"
                title="Account Settings"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={16} className="text-accent" />
                )}
              </Link>
              <span className="text-[10px] font-mono text-secondary uppercase tracking-widest hidden lg:block">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 text-secondary hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link
              to="/queries"
              className="px-6 py-2 border border-line rounded-full text-[10px] font-mono uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center gap-2"
            >
              <User size={14} /> Login
            </Link>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center md:hidden"
          >
            <button 
              className="absolute top-8 right-6 text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={32} />
            </button>
            <div className="flex flex-col items-center gap-8">
              {navLinks.map((link, i) => (
                <motion.a
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={link.name}
                  href={link.href}
                  className="text-5xl font-display uppercase hover:text-accent transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </motion.a>
              ))}
              {user && (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: navLinks.length * 0.1 }}
                  >
                    <Link
                      to="/queries"
                      className="text-5xl font-display uppercase hover:text-accent transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Queries
                    </Link>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (navLinks.length + 1) * 0.1 }}
                  >
                    <Link
                      to="/settings"
                      className="text-5xl font-display uppercase hover:text-accent transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Settings
                    </Link>
                  </motion.div>
                </>
              )}
              {user ? (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (navLinks.length + 2) * 0.1 }}
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                  className="text-2xl font-mono uppercase tracking-widest text-red-500"
                >
                  Logout
                </motion.button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: navLinks.length * 0.1 }}
                >
                  <Link
                    to="/queries"
                    className="text-5xl font-display uppercase hover:text-accent transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
