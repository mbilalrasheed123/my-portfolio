import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MousePointer2, Info, ArrowRight } from 'lucide-react';

// --- Types ---

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  angle: number; // For some organic oscillation
}

interface BackgroundParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

interface MouseState {
  x: number;
  y: number;
  isActive: boolean;
}

// --- Configuration Constants ---

const PARTICLE_DENSITY = 0.00025; // Increased density
const BG_PARTICLE_DENSITY = 0.0001; // Increased background density
const MOUSE_RADIUS = 180; // Radius of mouse influence
const RETURN_SPEED = 0.08; // How fast particles fly back to origin (spring constant)
const DAMPING = 0.90; // Friction (velocity decay)
const REPULSION_STRENGTH = 1.2; // Multiplier for mouse push force

// --- Helper Functions ---

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// --- Components ---

const AntiGravityCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mutable state refs to avoid re-renders during animation loop
  const particlesRef = useRef<Particle[]>([]);
  const backgroundParticlesRef = useRef<BackgroundParticle[]>([]);
  const mouseRef = useRef<MouseState>({ x: -1000, y: -1000, isActive: false });
  const frameIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Initialize Particles
  const initParticles = useCallback((width: number, height: number) => {
    // 1. Main Interactive Particles
    const particleCount = Math.floor(width * height * PARTICLE_DENSITY);
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      
      newParticles.push({
        x: x,
        y: y,
        originX: x,
        originY: y,
        vx: 0,
        vy: 0,
        size: randomRange(1, 2.5), 
        color: Math.random() > 0.9 ? '#4285F4' : '#ffffff', 
        angle: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = newParticles;

    // 2. Background Ambient Particles (Stars/Dust)
    const bgCount = Math.floor(width * height * BG_PARTICLE_DENSITY);
    const newBgParticles: BackgroundParticle[] = [];
    
    for (let i = 0; i < bgCount; i++) {
      newBgParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2, // Very slow drift
        vy: (Math.random() - 0.5) * 0.2,
        size: randomRange(0.5, 1.5),
        alpha: randomRange(0.1, 0.4),
        phase: Math.random() * Math.PI * 2 // For twinkling offset
      });
    }
    backgroundParticlesRef.current = newBgParticles;
  }, []);

  // Animation Loop
  const animate = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate Delta Time for smooth animation
    lastTimeRef.current = time;

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Background Effects ---
    
    // 1. Pulsating Radial Glow
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const pulseSpeed = 0.0008;
    const pulseOpacity = Math.sin(time * pulseSpeed) * 0.035 + 0.085; 
    
    const gradient = ctx.createRadialGradient(
        centerX, centerY, 0, 
        centerX, centerY, Math.max(canvas.width, canvas.height) * 0.7
    );
    gradient.addColorStop(0, `rgba(66, 133, 244, ${pulseOpacity})`); 
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Background Particles (Stars/Drift)
    const bgParticles = backgroundParticlesRef.current;
    ctx.fillStyle = "#ffffff";
    
    for (let i = 0; i < bgParticles.length; i++) {
      const p = bgParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      const twinkle = Math.sin(time * 0.002 + p.phase) * 0.5 + 0.5;
      const currentAlpha = p.alpha * (0.3 + 0.7 * twinkle);

      ctx.globalAlpha = currentAlpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // --- Main Foreground Physics ---

    const particles = particlesRef.current;
    const mouse = mouseRef.current;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (mouse.isActive && distance < MOUSE_RADIUS) {
        const forceDirectionX = dx / distance;
        const forceDirectionY = dy / distance;
        const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS; 
        const repulsion = force * REPULSION_STRENGTH;
        p.vx -= forceDirectionX * repulsion * 5; 
        p.vy -= forceDirectionY * repulsion * 5;
      }

      const springDx = p.originX - p.x;
      const springDy = p.originY - p.y;
      p.vx += springDx * RETURN_SPEED;
      p.vy += springDy * RETURN_SPEED;
    }

    // Resolve Collisions
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = p1.size + p2.size;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.01) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            const pushX = nx * overlap * 0.5;
            const pushY = ny * overlap * 0.5;
            p1.x -= pushX;
            p1.y -= pushY;
            p2.x += pushX;
            p2.y += pushY;
            const dvx = p1.vx - p2.vx;
            const dvy = p1.vy - p2.vy;
            const velocityAlongNormal = dvx * nx + dvy * ny;
            if (velocityAlongNormal > 0) {
              const m1 = p1.size;
              const m2 = p2.size;
              const restitution = 0.85;
              const impulseMagnitude = (-(1 + restitution) * velocityAlongNormal) / (1/m1 + 1/m2);
              const impulseX = impulseMagnitude * nx;
              const impulseY = impulseMagnitude * ny;
              p1.vx += impulseX / m1;
              p1.vy += impulseY / m1;
              p2.vx -= impulseX / m2;
              p2.vy -= impulseY / m2;
            }
          }
        }
      }
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.vx *= DAMPING;
      p.vy *= DAMPING;
      p.x += p.vx;
      p.y += p.vy;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      const velocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const opacity = Math.min(0.3 + velocity * 0.1, 1); 
      ctx.fillStyle = p.color === '#ffffff' ? `rgba(255, 255, 255, ${opacity})` : p.color;
      ctx.fill();
    }
    frameIdRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvasRef.current.width = width * dpr;
        canvasRef.current.height = height * dpr;
        canvasRef.current.style.width = `${width}px`;
        canvasRef.current.style.height = `${height}px`;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
        initParticles(width, height);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [initParticles]);

  useEffect(() => {
    frameIdRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [animate]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      isActive: true,
    };
  };

  const handleMouseLeave = () => {
    mouseRef.current.isActive = false;
  };

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 z-0 overflow-hidden bg-black cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

const HeroContent: React.FC<{ heroTitle?: string; heroSubtitle?: string; heroType?: string }> = ({ heroTitle, heroSubtitle, heroType }) => {
    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none px-4">
            <div className="max-w-4xl w-full text-center space-y-8">
                {heroType && (
                    <div className="inline-block">
                        <span className="py-1 px-3 border border-white/20 rounded-full text-xs font-mono text-white/60 tracking-widest uppercase bg-white/5 backdrop-blur-sm">
                            {heroType}
                        </span>
                    </div>
                )}
                
                <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-bold bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-transparent tracking-tight break-words whitespace-pre-line leading-none">
                    {heroTitle || "Zero\nGravity"}
                </h1>
                
                <p className="max-w-xl mx-auto text-sm md:text-lg leading-relaxed text-white/60 font-light px-4">
                    {heroSubtitle || "Experience the fluidity of data. A WebGL-inspired particle simulation running entirely on 2D Canvas for maximum compatibility and performance."}
                </p>

                <div className="pt-4 md:pt-8 pointer-events-auto">
                    <button 
                      onClick={() => document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })}
                      className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-bold tracking-wide overflow-hidden transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    >
                        <span className="relative z-10">Explore Work</span>
                        <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function ParticleHero({ title, subtitle, type }: { title?: string; subtitle?: string; type?: string }) {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden selection:bg-accent/30 selection:text-white" id="home">
      <AntiGravityCanvas />
      <HeroContent heroTitle={title} heroSubtitle={subtitle} heroType={type} />
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 animate-pulse pointer-events-none">
         <span className="text-[10px] uppercase tracking-[0.2em] font-mono">Interact</span>
         <MousePointer2 size={16} />
      </div>
    </div>
  );
}
