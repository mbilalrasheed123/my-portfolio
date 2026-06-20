import React from "react";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { api } from "../lib/api";

interface Testimonial {
  id?: string;
  name: string;
  role: string;
  avatar: string;
  text: string;
  rating?: number;
}

const defaultTestimonials: Testimonial[] = [
  {
    name: "Sarah Johnson",
    role: "Small Business Owner",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200&h=200",
    text: "Since integrating this solution into our workflow, we've experienced a significant improvement in efficiency and collaboration.",
    rating: 5
  },
  {
    name: "David Patel",
    role: "Project Manager",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200",
    text: "I've tested numerous options in this category, but one stands out for its intuitive design and comprehensive functionality.",
    rating: 5
  },
  {
    name: "Emily Carter",
    role: "Operations Manager",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200&h=200",
    text: "The tool we've adopted has surpassed our expectations, providing invaluable insights and support as our business continues to grow.",
    rating: 5
  }
];

export default function Testimonials() {
  const [dbTestimonials, setDbTestimonials] = React.useState<Testimonial[]>([]);

  React.useEffect(() => {
    const loadTestimonials = async () => {
      try {
        const fetched = await api.fetchList("testimonials");
        if (fetched && fetched.length > 0) {
          // Sort testimonals by order if provided, or default order
          const sorted = fetched.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          setDbTestimonials(sorted);
        }
      } catch (error) {
        console.error("Error loading testimonials:", error);
      }
    };
    loadTestimonials();
  }, []);

  const testimonialsList = dbTestimonials.length > 0 ? dbTestimonials : defaultTestimonials;

  return (
    <section id="testimonials" className="relative py-28 overflow-hidden bg-[#050716]">
      {/* Background radial gradient glow matching the attachment style */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(24,35,90,0.45)_0%,rgba(5,7,22,1)_75%)] pointer-events-none" />
      
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10 max-w-7xl">
        {/* Title Block */}
        <div className="text-center max-w-2xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="w-12 h-1 bg-gradient-to-r from-blue-500/0 via-blue-400 to-blue-500/0 mx-auto mb-6"
          />
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl md:text-5xl font-sans font-semibold tracking-tight text-white mb-4"
          >
            What people say
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-white/60 text-sm md:text-base leading-relaxed tracking-wide font-light max-w-xl mx-auto"
          >
            Discover what our satisfied customers have to say about their experiences with our products/services.
          </motion.p>
        </div>

        {/* Testimonials Auto-Playing Carousel Layout */}
        <div className="relative mt-12 w-full overflow-hidden group">
          {/* Fading edges for smooth enter/exit of the marquee */}
          <div className="absolute inset-y-0 left-0 w-12 md:w-32 bg-gradient-to-r from-[#050716] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-12 md:w-32 bg-gradient-to-l from-[#050716] to-transparent z-10 pointer-events-none" />

          <motion.div
            className="flex gap-6 md:gap-8 w-fit py-4"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              repeat: Infinity,
              ease: "linear",
              duration: testimonialsList.length * 10 || 30, // 10s per item to be slow and smooth
            }}
          >
            {[...testimonialsList, ...testimonialsList, ...testimonialsList, ...testimonialsList].map((t, idx) => (
              <div
                key={`${t.id || 't'}-${idx}`}
                className="relative p-8 rounded-3xl backdrop-blur-md bg-white/[0.02] border border-white/10 hover:border-white/35 hover:bg-white/[0.04] shadow-[0_4px_30px_rgba(0,0,0,0.1)] hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] transition-all duration-500 flex flex-col justify-between h-full group shrink-0 w-[300px] md:w-[400px]"
              >
                <div className="space-y-6">
                  {/* Custom Styled Avatar Container */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-[10px] scale-90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <div className="relative w-14 h-14 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
                      <img 
                        src={t.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&h=200"} 
                        alt={t.name} 
                        className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  {/* Identity */}
                  <div className="space-y-1">
                    <h4 className="text-base font-medium text-white tracking-wide">
                      {t.name}
                    </h4>
                    <p className="text-xs text-white/45 tracking-wider font-mono">
                      {t.role}
                    </p>
                  </div>

                  {/* Testimonial text */}
                  <p className="text-white/70 text-sm leading-relaxed font-light">
                    {t.text}
                  </p>

                  {/* Star Rating Display */}
                  <div className="flex items-center gap-1 pt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < (t.rating ?? 5) ? "fill-amber-400 text-amber-400" : "text-white/10"}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
