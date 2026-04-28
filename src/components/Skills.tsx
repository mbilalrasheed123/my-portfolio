import { motion } from "motion/react";

const skillCategories = [
  {
    title: "Frontend",
    skills: ["React", "Next.js", "TypeScript", "Tailwind CSS", "Framer Motion", "Redux", "Three.js"]
  },
  {
    title: "Backend",
    skills: ["Node.js", "Express", "Python", "Go", "PostgreSQL", "MongoDB", "Redis", "GraphQL"]
  },
  {
    title: "CMS / WordPress",
    skills: ["WordPress", "PHP", "ACF", "Elementor", "WooCommerce", "Headless WP", "Custom Themes"]
  },
  {
    title: "Tools",
    skills: ["Docker", "AWS", "Git", "Vercel", "Linux", "CI/CD", "Kubernetes"]
  }
];

interface SkillsProps {
  userId?: string;
}

export default function Skills({ userId }: SkillsProps) {
  // Currently static, but could use userId later
  return (
    <section id="skills" className="py-24 bg-black border-y border-line overflow-hidden">
      <div className="container mx-auto px-6 mb-16">
        <span className="font-mono text-xs uppercase tracking-widest text-accent mb-4 block">Expertise</span>
        <h2 className="text-5xl md:text-7xl font-display uppercase leading-none">
          Technical<br />Stack
        </h2>
      </div>

      <div className="flex flex-col gap-12">
        {skillCategories.map((category, idx) => (
          <div key={category.title} className="flex flex-col gap-4">
            <div className="container mx-auto px-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
                {category.title}
              </span>
            </div>
            
            <div className="relative flex overflow-hidden">
              <div className="flex whitespace-nowrap animate-scroll py-4">
                {[...category.skills, ...category.skills, ...category.skills].map((skill, i) => (
                  <div 
                    key={i} 
                    className="mx-8 text-4xl md:text-6xl font-display uppercase text-white/20 hover:text-white transition-colors cursor-default"
                  >
                    {skill}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        .animate-scroll:nth-child(even) {
          animation-direction: reverse;
        }
      `}</style>
    </section>
  );
}
