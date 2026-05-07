"use client";

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';

interface AetherFlowHeroProps {
  title?: string;
  subtitle?: string;
  type?: string;
}

const AetherFlowHero: React.FC<AetherFlowHeroProps> = ({ title, subtitle, type }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: Particle[] = [];
        const mouse: { x: number | null; y: number | null; radius: number } = { x: null, y: null, radius: 200 };

        class Particle {
            x: number;
            y: number;
            directionX: number;
            directionY: number;
            size: number;
            color: string;

            constructor(x: number, y: number, directionX: number, directionY: number, size: number, color: string) {
                this.x = x;
                this.y = y;
                this.directionX = directionX;
                this.directionY = directionY;
                this.size = size;
                this.color = color;
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
                ctx.fillStyle = this.color;
                ctx.fill();
            }

            update() {
                if (!canvas) return;
                if (this.x > canvas.width || this.x < 0) {
                    this.directionX = -this.directionX;
                }
                if (this.y > canvas.height || this.y < 0) {
                    this.directionY = -this.directionY;
                }

                // Mouse collision detection
                if (mouse.x !== null && mouse.y !== null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < mouse.radius + this.size) {
                        const forceDirectionX = dx / distance;
                        const forceDirectionY = dy / distance;
                        const force = (mouse.radius - distance) / mouse.radius;
                        this.x -= forceDirectionX * force * 5;
                        this.y -= forceDirectionY * force * 5;
                    }
                }

                this.x += this.directionX;
                this.y += this.directionY;
                this.draw();
            }
        }

        function init() {
            if (!canvas) return;
            particles = [];
            let numberOfParticles = (canvas.height * canvas.width) / 9000;
            for (let i = 0; i < numberOfParticles; i++) {
                let size = (Math.random() * 2) + 1;
                let x = (Math.random() * ((window.innerWidth - size * 2) - (size * 2)) + size * 2);
                let y = (Math.random() * ((window.innerHeight - size * 2) - (size * 2)) + size * 2);
                let directionX = (Math.random() * 0.4) - 0.2;
                let directionY = (Math.random() * 0.4) - 0.2;
                let color = 'rgba(191, 128, 255, 0.8)'; // Brighter purple
                particles.push(new Particle(x, y, directionX, directionY, size, color));
            }
        }

        const resizeCanvas = () => {
            if (!canvas) return;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            init(); 
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const connect = () => {
            if (!ctx || !canvas) return;
            let opacityValue = 1;
            for (let a = 0; a < particles.length; a++) {
                for (let b = a; b < particles.length; b++) {
                    let distance = ((particles[a].x - particles[b].x) * (particles[a].x - particles[b].x))
                        + ((particles[a].y - particles[b].y) * (particles[a].y - particles[b].y));
                    
                    if (distance < (canvas.width / 7) * (canvas.height / 7)) {
                        opacityValue = 1 - (distance / 20000);
                        
                        let mouseX = mouse.x || 0;
                        let mouseY = mouse.y || 0;
                        let dx_mouse_a = particles[a].x - mouseX;
                        let dy_mouse_a = particles[a].y - mouseY;
                        let distance_mouse_a = Math.sqrt(dx_mouse_a*dx_mouse_a + dy_mouse_a*dy_mouse_a);

                        if (mouse.x && distance_mouse_a < mouse.radius) {
                             ctx.strokeStyle = `rgba(255, 255, 255, ${opacityValue})`;
                        } else {
                             ctx.strokeStyle = `rgba(200, 150, 255, ${opacityValue})`;
                        }
                        
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                    }
                }
            }
        };

        const animate = () => {
            if (!ctx) return;
            animationFrameId = requestAnimationFrame(animate);
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
            }
            connect();
        };
        
        const handleMouseMove = (event: MouseEvent) => {
            mouse.x = event.clientX;
            mouse.y = event.clientY;
        };
        
        const handleMouseOut = () => {
            mouse.x = null;
            mouse.y = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseout', handleMouseOut);

        init();
        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseout', handleMouseOut);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    const fadeUpVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: i * 0.2 + 0.5,
                duration: 0.8,
                ease: "easeInOut" as any,
            },
        }),
    };

    return (
        <div className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-black" id="home">
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full opacity-60"></canvas>
            
            <div className="relative z-10 text-center p-6 max-w-4xl px-4 pointer-events-none">
                {type && (
                  <motion.div
                      custom={0}
                      variants={fadeUpVariants}
                      initial="hidden"
                      animate="visible"
                      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6 backdrop-blur-sm"
                  >
                      <Zap className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-gray-200">
                          {type}
                      </span>
                  </motion.div>
                )}

                <motion.h1
                    custom={1}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="text-5xl md:text-8xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 whitespace-pre-line"
                >
                    {title || "Aether Flow"}
                </motion.h1>

                <motion.p
                    custom={2}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="max-w-2xl mx-auto text-lg text-gray-400 mb-10 leading-relaxed"
                >
                    {subtitle || "An intelligent, adaptive framework for creating fluid digital experiences that feel alive and respond to user interaction in real-time."}
                </motion.p>

                <motion.div
                    custom={3}
                    variants={fadeUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="pointer-events-auto"
                >
                    <button 
                      onClick={() => document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })}
                      className="px-8 py-4 bg-white text-black font-bold rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-gray-200 transition-all duration-300 flex items-center gap-2 mx-auto active:scale-95"
                    >
                        Explore Projects
                        <ArrowRight className="h-5 w-5" />
                    </button>
                </motion.div>
            </div>
        </div>
    );
};

export default AetherFlowHero;
