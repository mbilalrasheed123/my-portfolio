import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, User, LogOut, MessageSquare, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { auth, onAuthStateChanged, signOut } from "../firebase";
import { useData } from "../contexts/DataContext";

interface NavbarProps {
  userId?: string;
}

export default function Navbar({ userId }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { settings } = useData();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      unsubscribe();
    };
  }, []);

  const activeNavLinks = [
    { name: "Home", href: userId ? `/u/${userId}#home` : "/#home" },
    { name: "About", href: userId ? `/u/${userId}#about` : "/#about" },
    { name: "Skills", href: userId ? `/u/${userId}#skills` : "/#skills" },
    { name: "Projects", href: userId ? `/u/${userId}#projects` : "/#projects" },
    { name: "Certificates", href: userId ? `/u/${userId}#certificates` : "/#certificates" },
    { name: "Contact", href: userId ? `/u/${userId}#contact` : "/#contact" },
  ];

  const handleLogout = async () => {
    await signOut(auth);
  };

  const isHomePage = location.pathname === "/";

  const brandName = settings?.logoText || (settings?.name?.split(' ')[0] || "Bilal");
  const logoType = settings?.logoType;
  const logoUrl = settings?.logoUrl;
  const logoAlt = settings?.logoAlt;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
        isScrolled || !isHomePage || isMobileMenuOpen ? "bg-black/90 backdrop-blur-2xl py-4 border-b border-line" : "bg-transparent py-8"
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="group flex items-center gap-2 relative z-[110]" onClick={() => setIsMobileMenuOpen(false)}>
          {logoType === "image" && logoUrl ? (
            <img 
              src={logoUrl} 
              alt={logoAlt || "Logo"} 
              className="h-8 md:h-10 w-auto object-contain transition-transform group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-2xl font-display uppercase tracking-tighter text-white">
              {brandName}<span className="text-accent">.</span>
            </span>
          )}
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-10 lg:gap-16">
          {activeNavLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-[10px] font-mono uppercase tracking-[0.2em] text-secondary hover:text-white transition-colors relative group"
            >
              {link.name}
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-accent transition-all group-hover:w-full" />
            </a>
          ))}
        </div>

        {/* Action Button */}
        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-4 relative group">
              <div className="flex items-center gap-4 p-1 rounded-full hover:bg-white/5 transition-all cursor-pointer">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-line bg-white/10 flex items-center justify-center">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={16} className="text-accent" />
                  )}
                </div>
                <span className="text-[10px] font-mono text-secondary uppercase tracking-widest hidden lg:block pr-2">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>
              
              {/* Profile Dropdown */}
              <div className="absolute top-full right-0 mt-2 w-48 glass border border-line rounded-2xl py-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-50 shadow-2xl">
                <div className="px-4 mb-4 pb-4 border-b border-line">
                  <p className="text-[10px] font-mono text-white truncate">{user.displayName || 'User'}</p>
                  <p className="text-[8px] font-mono text-secondary truncate">{user.email}</p>
                </div>
                <Link to="/queries" className="flex items-center gap-3 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-secondary hover:text-accent hover:bg-white/5 transition-all">
                  <MessageSquare size={14} /> Queries
                </Link>
                <Link to="/settings" className="flex items-center gap-3 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-secondary hover:text-accent hover:bg-white/5 transition-all">
                  <Settings size={14} /> Settings
                </Link>
                <div className="mt-4 pt-4 border-t border-line">
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-red-500 hover:bg-red-500/10 w-full text-left transition-all"
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              </div>
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
          className="md:hidden text-white p-2 relative z-[110]"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isMobileMenuOpen ? "close" : "menu"}
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </motion.div>
          </AnimatePresence>
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[105] bg-black/95 backdrop-blur-3xl overflow-hidden md:hidden h-screen w-screen flex flex-col items-center justify-center"
          >
            <div className="container mx-auto px-6 h-full flex flex-col items-center justify-center">
              <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                {activeNavLinks.map((link, i) => (
                  <motion.a
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
                    key={link.name}
                    href={link.href}
                    className="text-4xl sm:text-5xl font-display uppercase tracking-tighter text-white hover:text-accent transition-all duration-300 transform"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </motion.a>
                ))}
                
                {user && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: activeNavLinks.length * 0.1, duration: 0.5 }}
                    className="flex flex-col items-center gap-6 border-t border-white/10 pt-8 mt-6 w-full"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-accent font-bold">Account</span>
                    <div className="flex flex-col items-center gap-4">
                      <Link
                        to="/queries"
                        className="text-2xl font-display uppercase tracking-widest text-secondary hover:text-white transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Queries
                      </Link>
                      <Link
                        to="/settings"
                        className="text-2xl font-display uppercase tracking-widest text-secondary hover:text-white transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <button
                        onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                        className="text-2xl font-display uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </motion.div>
                )}
                
                {!user && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: activeNavLinks.length * 0.1, duration: 0.5 }}
                    className="mt-8"
                  >
                    <Link
                      to="/queries"
                      className="text-5xl font-display uppercase tracking-tighter text-white hover:text-accent transition-all hover:scale-110"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Login
                    </Link>
                  </motion.div>
                )}
              </div>
            </div>
            
            {/* Background Accent for Mobile Menu */}
            <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] -z-10 animate-pulse" />
            <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] -z-10 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
