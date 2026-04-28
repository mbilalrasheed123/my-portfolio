import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Reveal } from "./Reveal";

interface AboutProps {
  userId?: string;
}

export default function About({ userId }: AboutProps) {
  const [settings, setSettings] = useState<any>({
    aboutText: "Welcome to my portfolio! I'm a dedicated developer focused on creating impactful digital experiences.",
    experienceYears: "00+",
    education: "Professional Developer",
    location: "Global / Remote"
  });

  useEffect(() => {
    api.getSettings(userId).then((data) => {
      if (data) {
        setSettings(data);
      }
    }).catch((error) => {
      console.error("Failed to fetch settings:", error);
    });
  }, [userId]);

  return (
    <section id="about" className="py-24 bg-black">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative order-2 lg:order-1"
          >
            <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-line animate-float bg-white/5">
              <img
                src={settings.aboutImage || `https://picsum.photos/seed/${userId || 'default'}/1200/1600`}
                alt="Profile"
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-10 -right-10 hidden md:block">
              <div className="glass p-8 rounded-2xl border border-line">
                <span className="font-display text-4xl block mb-2">{settings.experienceYears || "03+"}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-secondary">Experience Level</span>
              </div>
            </div>
          </motion.div>

          <div className="order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Reveal>
                <span className="font-mono text-xs uppercase tracking-widest text-accent mb-4 block">The Story</span>
              </Reveal>
              <Reveal width="100%">
                <h2 className="text-4xl md:text-6xl font-display uppercase leading-tight mb-8">
                  {settings.aboutTitle || "Driven by Innovation"}
                </h2>
              </Reveal>
              
              <div className="space-y-6 text-secondary text-lg font-light leading-relaxed">
                <Reveal width="100%">
                  <p className="whitespace-pre-line">
                    {settings.aboutText}
                  </p>
                </Reveal>
              </div>

              <div className="mt-12 grid grid-cols-2 gap-8 border-t border-line pt-12">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-secondary block mb-2">Education</span>
                  <p className="text-white font-medium">{settings.education || "BS Computer Science"}</p>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-secondary block mb-2">Location</span>
                  <p className="text-white font-medium">{settings.location || "Pakistan (Remote)"}</p>
                </div>
              </div>

              <motion.div 
                className="mt-12"
                whileHover={{ x: 10 }}
              >
                <a href="#contact" className="inline-flex items-center gap-4 text-white font-display uppercase tracking-widest text-sm group">
                  Start a conversation <ArrowRight size={20} className="text-accent group-hover:translate-x-2 transition-transform" />
                </a>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
