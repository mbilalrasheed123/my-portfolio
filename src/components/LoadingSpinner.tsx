import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingSpinner() {
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
      <motion.div
        animate={{
          rotate: 360,
          borderRadius: ["25%", "25%", "50%", "50%", "25%"],
        }}
        transition={{
          duration: 2,
          ease: "linear",
          repeat: Infinity,
        }}
        className="w-16 h-16 border-2 border-accent border-t-transparent rounded-full mb-8"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <h2 className="text-2xl font-display uppercase tracking-widest text-white mb-2">Loading</h2>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
              className="w-1 h-1 bg-accent rounded-full"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
