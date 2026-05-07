'use client'

import React from 'react';
import { SplineScene } from "./splite";
import { SpotlightAceternity } from "./spotlight-aceternity";
import { SpotlightIbelick } from "./spotlight-ibelick";
import { motion } from 'framer-motion';
import { ArrowRight, Zap, MousePointer2 } from 'lucide-react';

interface SplineHeroProps {
  title?: string;
  subtitle?: string;
  type?: string;
}

export default function SplineHero({ title, subtitle, type }: SplineHeroProps) {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col items-center justify-center pt-20" id="home">
      <SpotlightAceternity
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      
      <SpotlightIbelick size={400} />

      {/* Full screen interactive Spline background - Shifted to position robot on the right */}
      <div className="absolute inset-0 z-0 pointer-events-auto translate-x-0 md:translate-x-[20%] lg:translate-x-[25%] scale-110 md:scale-100 will-change-transform">
        <SplineScene 
          scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
          className="w-full h-full"
        />
      </div>

      <div className="container relative z-10 flex flex-col md:flex-row items-center justify-between gap-12 px-6 pointer-events-none">
        {/* Left content */}
        <div className="flex-1 text-center md:text-left space-y-8 pointer-events-auto">
          {type && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 backdrop-blur-sm"
            >
              <Zap className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-gray-200">
                {type}
              </span>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-8xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 whitespace-pre-line leading-none"
          >
            {title || "Interactive\n3D Project"}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base md:text-xl text-gray-400 max-w-xl leading-relaxed"
          >
            {subtitle || "Bring your UI to life with beautiful 3D scenes. Create immersive experiences that capture attention and enhance your design."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-wrap gap-4 justify-center md:justify-start"
          >
            <button 
              onClick={() => document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-white text-black font-bold rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:bg-gray-200 transition-all duration-300 flex items-center gap-2 active:scale-95"
            >
              Explore Experience
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        </div>

        {/* Right content spacer (Robot will likely appear in center/right of full screen spline) */}
        <div className="flex-1 w-full h-[300px] md:h-[500px]"></div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20 animate-pulse pointer-events-none">
         <span className="text-[10px] uppercase tracking-[0.2em] font-mono">Interact in 3D</span>
         <MousePointer2 size={14} />
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(66,133,244,0.05),transparent_70%)] pointer-events-none"></div>
    </div>
  )
}
