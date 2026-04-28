import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { auth } from "../firebase";

export default function Contact() {
  const [settings, setSettings] = useState<any>({
    email: "muhammadbilalrasheed78@gmail.com",
    phone: "+92 3XX XXXXXXX",
    location: "Pakistan (Remote)"
  });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (!formData.message.trim()) newErrors.message = "Message is required";
    else if (formData.message.length < 10) newErrors.message = "Message must be at least 10 characters";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    api.getSettings().then((data) => {
      if (data) {
        setSettings(data);
      }
    }).catch((error) => {
      console.error("Failed to fetch settings:", error);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setStatus("idle");

    try {
      const user = auth.currentUser;
      await api.post("contactMessages", {
        userName: formData.name,
        userEmail: formData.email,
        subject: `Inquiry from ${formData.name}`,
        message: formData.message,
        status: "pending",
        userUid: user?.uid || null
      });

      // Send email notification to admin
      api.sendEmail(
        settings.email || "muhammadbilalrasheed78@gmail.com",
        `New Inquiry: ${formData.name}`,
        `You have a new message from ${formData.name} (${formData.email}):\n\n${formData.message}`,
        `<h3>New Inquiry from Professional Portfolio</h3>
         <p><strong>Name:</strong> ${formData.name}</p>
         <p><strong>Email:</strong> ${formData.email}</p>
         <p><strong>Message:</strong></p>
         <p>${formData.message}</p>`
      ).catch(err => console.warn("Admin email notification failed:", err));

      setStatus("success");
      setFormData({ name: "", email: "", message: "" });
    } catch (error) {
      console.error("Failed to submit query:", error);
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-24 bg-black border-t border-line">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-accent mb-4 block">Get in Touch</span>
            <h2 className="text-5xl md:text-8xl font-display uppercase leading-none mb-12">
              Let's Create<br />Together
            </h2>
            
            <div className="space-y-12">
              {[
                { label: "Email", value: settings.email || "muhammadbilalrasheed78@gmail.com", href: `mailto:${settings.email || "muhammadbilalrasheed78@gmail.com"}` },
                { label: "Phone", value: settings.phone || "+92 3XX XXXXXXX", href: `tel:${settings.phone || "+923000000000"}` },
                { label: "Location", value: settings.location || "Pakistan (Remote)", href: "#" },
              ].map((item) => (
                <div key={item.label} className="group">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-secondary block mb-2">{item.label}</span>
                  <a 
                    href={item.href} 
                    className="text-2xl md:text-3xl font-light hover:text-accent transition-colors"
                  >
                    {item.value}
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <form className="space-y-8" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="border-b border-line pb-4 group focus-within:border-white transition-colors relative">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-secondary block mb-2">Name</label>
                  <input 
                    type="text" 
                    placeholder="Your Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-transparent outline-none text-xl font-light placeholder:text-white/10"
                  />
                  {errors.name && <span className="absolute bottom-0 left-0 text-[8px] text-red-500 font-mono uppercase translate-y-full">{errors.name}</span>}
                </div>
                <div className="border-b border-line pb-4 group focus-within:border-white transition-colors relative">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-secondary block mb-2">Email</label>
                  <input 
                    type="email" 
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-transparent outline-none text-xl font-light placeholder:text-white/10"
                  />
                  {errors.email && <span className="absolute bottom-0 left-0 text-[8px] text-red-500 font-mono uppercase translate-y-full">{errors.email}</span>}
                </div>
              </div>
              
              <div className="border-b border-line pb-4 group focus-within:border-white transition-colors relative">
                <label className="font-mono text-[10px] uppercase tracking-widest text-secondary block mb-2">Message</label>
                <textarea 
                  rows={4}
                  placeholder="Tell me about your project"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-transparent outline-none text-xl font-light placeholder:text-white/10 resize-none"
                />
                {errors.message && <span className="absolute bottom-0 left-0 text-[8px] text-red-500 font-mono uppercase translate-y-full">{errors.message}</span>}
              </div>

              {status === "success" && (
                <p className="text-accent font-mono text-xs uppercase tracking-widest">Message sent successfully!</p>
              )}
              {status === "error" && (
                <p className="text-red-500 font-mono text-xs uppercase tracking-widest">Failed to send message. Please try again.</p>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isSubmitting}
                className="w-full py-6 bg-white text-black font-display uppercase tracking-widest text-sm flex items-center justify-center gap-4 group disabled:opacity-50"
              >
                {isSubmitting ? "Sending..." : "Send Message"} <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
              </motion.button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
