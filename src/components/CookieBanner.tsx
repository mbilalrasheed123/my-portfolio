import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cookie, X } from 'lucide-react';

export default function CookieBanner() {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Delay showing to not interrupt first impression immediately
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    } else if (consent === 'true') {
      import('../lib/analytics').then(module => {
        module.initializeAnalytics();
      });
    }
  }, []);
  
  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'true');
    setShow(false);
    // Dynamic import to lazy load analytics library
    import('../lib/analytics').then(module => {
      module.initializeAnalytics();
    });
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'false');
    setShow(false);
  };
  
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[400px] z-[200] bg-zinc-900 border border-white/10 p-6 rounded-2xl shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-start gap-4">
            <div className="bg-accent/10 p-3 rounded-xl">
              <Cookie className="text-accent" size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-display uppercase tracking-widest text-white">Privacy Context</h3>
                <button onClick={() => setShow(false)} className="text-secondary hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-secondary font-mono leading-relaxed mb-6">
                We use cookies to measure engagement and optimize your terminal experience. No personal data is sold.
              </p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleAccept}
                  className="flex-1 bg-white text-black font-display uppercase tracking-widest text-[10px] py-3 rounded-lg hover:bg-accent hover:text-white transition-all cursor-pointer"
                >
                  Accept All
                </button>
                <button 
                  onClick={handleDecline}
                  className="flex-1 border border-white/10 text-secondary font-display uppercase tracking-widest text-[10px] py-3 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                >
                  Essential Only
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
