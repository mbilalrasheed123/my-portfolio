import { Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import React, { useEffect } from "react";
import { FiArrowRight } from "react-icons/fi";
import {
  useMotionTemplate,
  useMotionValue,
  motion,
  animate,
} from "framer-motion";
import { useData } from "../contexts/DataContext";
import { useSectionTracking } from "../hooks/useSectionTracking";
import { trackClick } from "../lib/analytics";

const COLORS_TOP = ["#13FFAA", "#1E67C6", "#CE84CF", "#DD335C"];

interface HeroProps {
  userId?: string;
}

export default function Hero({ userId }: HeroProps) {
  const { settings } = useData();
  const color = useMotionValue(COLORS_TOP[0]);
  const sectionRef = useSectionTracking("hero");

  useEffect(() => {
    animate(color, COLORS_TOP, {
      ease: "easeInOut",
      duration: 10,
      repeat: Infinity,
      repeatType: "mirror",
    });
  }, []);

  const backgroundImage = useMotionTemplate`radial-gradient(125% 125% at 50% 0%, #020617 50%, ${color})`;
  const border = useMotionTemplate`1px solid ${color}`;
  const boxShadow = useMotionTemplate`0px 4px 24px ${color}`;

  return (
    <motion.section
      ref={sectionRef}
      style={{
        backgroundImage,
      }}
      id="home"
      className="relative grid min-h-screen place-content-center overflow-hidden bg-gray-950 px-4 py-24 text-gray-200"
    >
      <div className="relative z-10 flex flex-col items-center">
        <motion.span 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4 inline-block rounded-full bg-gray-600/50 px-3 py-1.5 text-xs font-mono uppercase tracking-widest"
        >
          {settings.title}
        </motion.span>
        
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-4xl bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-4xl font-bold leading-tight text-transparent sm:text-7xl sm:leading-tight md:text-8xl md:leading-tight font-display uppercase break-words"
        >
          {settings.name}
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="my-8 max-w-xl text-center text-base leading-relaxed md:text-lg md:leading-relaxed text-secondary font-light"
        >
          {settings.subtitle?.replace(/,vmvmvmvm/g, '')}
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <motion.button
            style={{
              border,
              boxShadow,
            }}
            whileHover={{
              scale: 1.05,
            }}
            whileTap={{
              scale: 0.95,
            }}
            onClick={() => {
              trackClick('hero-cta-button', { target: 'projects' });
              document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group relative flex w-fit items-center gap-2 rounded-full bg-gray-950/10 px-8 py-4 text-gray-50 transition-colors hover:bg-gray-950/50 font-display uppercase tracking-widest text-sm"
          >
            Explore My Work
            <FiArrowRight className="transition-transform group-hover:-rotate-45 group-active:-rotate-12" />
          </motion.button>
        </motion.div>
      </div>

      <div className="absolute inset-0 z-0">
        <Canvas>
          <Stars radius={50} count={2500} factor={4} fade speed={2} />
        </Canvas>
      </div>
    </motion.section>
  );
}
