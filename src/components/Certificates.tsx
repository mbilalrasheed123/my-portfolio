import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api";
import { Award, ExternalLink, Calendar, ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

interface Certificate {
  id: string;
  title: string;
  issuer: string;
  date: string;
  image: string;
  link?: string;
  verify?: string;
  description?: string;
  order: number;
}

export default function Certificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    api.get("certificates").then((data) => {
      if (Array.isArray(data)) {
        setCertificates(data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));
      } else {
        console.error("Expected array for certificates, got:", data);
        setCertificates([]);
      }
      setLoading(false);
    }).catch((error) => {
      console.error("Failed to fetch certificates:", error);
      setLoading(false);
    });
  }, []);

  const nextCertificate = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % certificates.length);
  };

  const prevCertificate = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + certificates.length) % certificates.length);
  };

  const currentCert = certificates[currentIndex];

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  if (loading) {
    return (
      <section id="certificates" className="py-24 bg-black min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </section>
    );
  }

  if (certificates.length === 0) {
    return (
      <section id="certificates" className="py-24 bg-black min-h-screen flex items-center justify-center">
        <p className="text-secondary font-mono uppercase tracking-widest">No certificates found.</p>
      </section>
    );
  }

  return (
    <section id="certificates" className="py-24 bg-black min-h-screen flex items-center">
      <div className="container mx-auto px-6">
        <div className="mb-16">
          <Reveal>
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-mono text-xs uppercase tracking-[0.3em] text-accent mb-4 block"
            >
              Achievements
            </motion.span>
          </Reveal>
          <Reveal width="100%">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-display uppercase leading-none"
            >
              Certificates
            </motion.h2>
          </Reveal>
        </div>

        <div className="relative overflow-hidden min-h-[500px] flex items-center">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              {/* Left Side: Image */}
              <div className="relative aspect-[4/3] lg:aspect-auto lg:h-[500px] rounded-3xl overflow-hidden border border-line group">
                <img 
                  src={currentCert.image} 
                  alt={currentCert.title}
                  className="w-full h-full object-contain bg-white/5"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              </div>

              {/* Right Side: Content */}
              <div className="flex flex-col justify-center relative h-full">
                <div className="mb-8">
                  <div className="flex items-center gap-2 text-accent mb-4">
                    <Award size={20} />
                    <span className="text-xs font-mono uppercase tracking-widest">{currentCert.issuer}</span>
                  </div>
                  
                  <h3 className="text-4xl md:text-6xl font-display uppercase mb-6 text-white leading-tight">
                    {currentCert.title}
                  </h3>

                  <div className="flex items-center gap-4 text-secondary text-sm font-mono mb-8">
                    <Calendar size={18} />
                    <span>{currentCert.date}</span>
                  </div>

                  <div className="prose prose-invert max-w-none">
                    <p className="text-secondary text-lg leading-relaxed font-light">
                      {currentCert.description || "No description provided for this certificate."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 mt-auto">
                  {currentCert.verify && (
                    <a 
                      href={currentCert.verify}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full font-mono text-xs uppercase tracking-widest hover:bg-accent hover:text-white transition-all"
                    >
                      Verify Certificate <ExternalLink size={16} />
                    </a>
                  )}
                  {currentCert.link && (
                    <a 
                      href={currentCert.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-8 py-4 border border-line text-white rounded-full font-mono text-xs uppercase tracking-widest hover:border-accent hover:text-accent transition-all"
                    >
                      View Details <ArrowRight size={16} />
                    </a>
                  )}
                </div>

                {/* Bottom Right Navigation */}
                <div className="absolute bottom-0 right-0 flex gap-4">
                  <button 
                    onClick={prevCertificate}
                    className="w-14 h-14 rounded-full border border-line flex items-center justify-center hover:bg-white hover:text-black transition-all group"
                  >
                    <ArrowRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={24} />
                  </button>
                  <button 
                    onClick={nextCertificate}
                    className="w-14 h-14 rounded-full border border-line flex items-center justify-center hover:bg-white hover:text-black transition-all group"
                  >
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={24} />
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Counter */}
        <div className="mt-12 flex items-center gap-4 font-mono text-xs text-secondary uppercase tracking-widest">
          <span className="text-white">{String(currentIndex + 1).padStart(2, '0')}</span>
          <div className="w-12 h-[1px] bg-line" />
          <span>{String(certificates.length).padStart(2, '0')}</span>
        </div>
      </div>
    </section>
  );
}
